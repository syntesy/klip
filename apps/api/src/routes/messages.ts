import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { db } from "../lib/db.js";
import { bulkGetClerkDisplayNames } from "../lib/clerkCache.js";
import { messages, topics, communityMembers, messageReactions } from "@klip/db/schema";
import { eq, and, asc, sql, isNull } from "drizzle-orm";
import { z } from "zod";

const sendMessageSchema = z.object({
  topicId: z.string().uuid(),
  content: z.string().min(1).max(4000),
});

export async function messagesRoutes(fastify: FastifyInstance) {
  // Get messages for a topic
  // Soft-deleted messages are excluded from the response.
  // Author names are resolved from the communityMembers.displayName cache first,
  // and only fall back to a Clerk bulk-lookup for any that are missing.
  fastify.get<{ Querystring: { topicId: string } }>(
    "/",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { topicId } = req.query;

      if (!topicId) {
        return reply.status(400).send({ error: "topicId is required" });
      }

      // Verify access via community membership
      const [topic] = await db
        .select()
        .from(topics)
        .where(eq(topics.id, topicId))
        .limit(1);

      if (!topic) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      const [member] = await db
        .select()
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, topic.communityId),
            eq(communityMembers.userId, req.userId)
          )
        )
        .limit(1);

      if (!member) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Fetch messages excluding soft-deleted ones
      const rows = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.topicId, topicId),
            isNull(messages.deletedAt)   // ← exclude soft-deleted messages
          )
        )
        .orderBy(asc(messages.createdAt))
        .limit(50);

      if (rows.length === 0) return [];

      // Resolve author names: prefer cached displayName from communityMembers,
      // only call Clerk for IDs not in the local cache.
      const communityMemberRows = await db
        .select({ userId: communityMembers.userId, displayName: communityMembers.displayName })
        .from(communityMembers)
        .where(eq(communityMembers.communityId, topic.communityId));

      const memberNameMap = new Map<string, string>(
        communityMemberRows
          .filter((m) => m.displayName != null)
          .map((m) => [m.userId, m.displayName as string])
      );

      // For any author ID not in memberNameMap, fall back to Clerk bulk-lookup
      const uniqueAuthorIds = [...new Set(rows.map((m) => m.authorId))];
      const unknownIds = uniqueAuthorIds.filter((id) => !memberNameMap.has(id));
      if (unknownIds.length > 0) {
        const clerkNames = await bulkGetClerkDisplayNames(unknownIds);
        for (const [id, name] of clerkNames) memberNameMap.set(id, name);
      }

      return rows.map((m) => ({
        ...m,
        authorName: memberNameMap.get(m.authorId) ?? m.authorId,
      }));
    }
  );

  // Send message (HTTP fallback — WebSocket is preferred path)
  // Wrapped in a transaction: message insert + topic stats update are atomic.
  fastify.post("/", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = sendMessageSchema.safeParse(req.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { topicId, content } = parsed.data;

    const [topic] = await db
      .select()
      .from(topics)
      .where(eq(topics.id, topicId))
      .limit(1);

    if (!topic) {
      return reply.status(404).send({ error: "Topic not found" });
    }

    const [member] = await db
      .select()
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, topic.communityId),
          eq(communityMembers.userId, req.userId)
        )
      )
      .limit(1);

    if (!member) {
      return reply.status(403).send({ error: "Not a member" });
    }

    // Atomic: if the stats update fails the message insert is rolled back too
    const message = await db.transaction(async (tx) => {
      const [msg] = await tx
        .insert(messages)
        .values({ topicId, authorId: req.userId, content })
        .returning();

      if (!msg) throw new Error("insert returned no rows");

      await tx
        .update(topics)
        .set({
          lastActivityAt: new Date(),
          messageCount: sql`${topics.messageCount} + 1`,
        })
        .where(eq(topics.id, topicId));

      return msg;
    });

    return reply.status(201).send(message);
  });

  // Add reaction
  fastify.post<{ Params: { id: string }; Body: { emoji: string } }>(
    "/:id/reactions",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { emoji } = req.body ?? {};
      if (!emoji) return reply.status(400).send({ error: "emoji required" });

      try {
        await db.insert(messageReactions).values({
          messageId: req.params.id,
          clerkUserId: req.userId,
          emoji,
        });
        return reply.status(201).send({ ok: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("message_reactions_unique") || msg.includes("duplicate key")) {
          return reply.status(409).send({ error: "already reacted" });
        }
        fastify.log.error({ err }, "POST /:id/reactions failed");
        return reply.status(500).send({ error: "Internal error" });
      }
    }
  );

  // Remove reaction
  fastify.delete<{ Params: { id: string }; Body: { emoji: string } }>(
    "/:id/reactions",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { emoji } = req.body ?? {};
      if (!emoji) return reply.status(400).send({ error: "emoji required" });

      await db
        .delete(messageReactions)
        .where(
          and(
            eq(messageReactions.messageId, req.params.id),
            eq(messageReactions.clerkUserId, req.userId),
            eq(messageReactions.emoji, emoji)
          )
        );

      return { ok: true };
    }
  );

  // Get reactions for a message
  fastify.get<{ Params: { id: string } }>(
    "/:id/reactions",
    { preHandler: requireAuth },
    async (_req, _reply) => {
      const rows = await db
        .select()
        .from(messageReactions)
        .where(eq(messageReactions.messageId, _req.params.id));
      return rows;
    }
  );
}
