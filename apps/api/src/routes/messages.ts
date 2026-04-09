import type { FastifyInstance } from "fastify";
import { createClerkClient } from "@clerk/backend";
import { requireAuth } from "../plugins/auth.js";
import { db } from "../lib/db.js";
import { messages, topics, communityMembers, messageReactions } from "@klip/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { z } from "zod";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY ?? "" });

const sendMessageSchema = z.object({
  topicId: z.string().uuid(),
  content: z.string().min(1).max(4000),
});

export async function messagesRoutes(fastify: FastifyInstance) {
  // Get messages for a topic (paginated)
  fastify.get<{ Querystring: { topicId: string; cursor?: string } }>(
    "/",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { topicId } = req.query;

      // Verify access via community membership
      const [topic] = await db
        .select()
        .from(topics)
        .where(eq(topics.id, topicId))
        .limit(1);

      if (!topic) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      const member = await db
        .select()
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, topic.communityId),
            eq(communityMembers.userId, req.userId)
          )
        )
        .limit(1);

      if (member.length === 0) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.topicId, topicId))
        .orderBy(asc(messages.createdAt))
        .limit(50);

      // Hydrate author names from Clerk
      const uniqueAuthorIds = [...new Set(rows.map((m) => m.authorId))];
      const authorMap = new Map<string, string>();
      if (uniqueAuthorIds.length > 0) {
        try {
          const { data: clerkUsers } = await clerk.users.getUserList({
            userId: uniqueAuthorIds,
            limit: uniqueAuthorIds.length,
          });
          for (const u of clerkUsers) {
            authorMap.set(
              u.id,
              u.fullName ?? u.firstName ?? u.emailAddresses[0]?.emailAddress ?? u.id
            );
          }
        } catch {
          // non-fatal — fall back to authorId
        }
      }

      return rows.map((m) => ({
        ...m,
        authorName: authorMap.get(m.authorId) ?? m.authorId,
      }));
    }
  );

  // Send message
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

    const member = await db
      .select()
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, topic.communityId),
          eq(communityMembers.userId, req.userId)
        )
      )
      .limit(1);

    if (member.length === 0) {
      return reply.status(403).send({ error: "Not a member" });
    }

    const [message] = await db
      .insert(messages)
      .values({ topicId, authorId: req.userId, content })
      .returning();

    // Update topic last activity — atomic increment to avoid race conditions
    await db
      .update(topics)
      .set({ lastActivityAt: new Date(), messageCount: sql`${topics.messageCount} + 1` })
      .where(eq(topics.id, topicId));

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
        return reply.status(500).send({ error: msg });
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
    async (req, _reply) => {
      const rows = await db
        .select()
        .from(messageReactions)
        .where(eq(messageReactions.messageId, req.params.id));
      return rows;
    }
  );
}
