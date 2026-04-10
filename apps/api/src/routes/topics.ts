import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { db } from "../lib/db.js";
import { bulkGetClerkDisplayNames } from "../lib/clerkCache.js";
import { topics, communityMembers, messages } from "@klip/db/schema";
import { eq, and, desc, ilike, isNull } from "drizzle-orm";
import { z } from "zod";

const createTopicSchema = z.object({
  communityId: z.string().uuid(),
  title: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
});

const pinMessageSchema = z.object({
  messageId: z.string().uuid(),
  content: z.string().max(2000).optional(),
  authorName: z.string().max(200).optional(),
});

export async function topicsRoutes(fastify: FastifyInstance) {
  // List topics for a community
  fastify.get<{ Querystring: { communityId: string } }>(
    "/",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { communityId } = req.query;

      if (!communityId) {
        return reply.status(400).send({ error: "communityId is required" });
      }

      // Verify membership
      const [member] = await db
        .select()
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, communityId),
            eq(communityMembers.userId, req.userId)
          )
        )
        .limit(1);

      if (!member) {
        return reply.status(403).send({ error: "Not a member" });
      }

      return db
        .select()
        .from(topics)
        .where(and(eq(topics.communityId, communityId), eq(topics.status, "active")))
        .orderBy(desc(topics.isPinned), desc(topics.lastActivityAt));
    }
  );

  // Get single topic by id — verifies both topic existence AND community membership
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const [topic] = await db
        .select()
        .from(topics)
        .where(eq(topics.id, req.params.id))
        .limit(1);

      if (!topic) {
        return reply.status(404).send({ error: "Topic not found" });
      }

      // Check membership in the community this topic belongs to.
      // This prevents cross-community data leakage if a topic ID is guessed.
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

      return topic;
    }
  );

  // Create topic
  fastify.post("/", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = createTopicSchema.safeParse(req.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { communityId, title, description } = parsed.data;

    // Any member can create a topic
    const [member] = await db
      .select()
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.userId, req.userId)
        )
      )
      .limit(1);

    if (!member) {
      return reply.status(403).send({ error: "Not a member" });
    }

    const [topic] = await db
      .insert(topics)
      .values({ communityId, title, description, createdBy: req.userId })
      .returning();

    return reply.status(201).send(topic);
  });

  // Pin a message to a topic — owner/moderator only
  fastify.post<{ Params: { id: string }; Body: { messageId: string; content?: string; authorName?: string } }>(
    "/:id/pin",
    { preHandler: requireAuth },
    async (req, reply) => {
      const pinParsed = pinMessageSchema.safeParse(req.body);
      if (!pinParsed.success) {
        return reply.status(400).send({ error: pinParsed.error.flatten() });
      }
      const { messageId, content, authorName } = pinParsed.data;

      const [topic] = await db
        .select()
        .from(topics)
        .where(eq(topics.id, req.params.id))
        .limit(1);
      if (!topic) return reply.status(404).send({ error: "Topic not found" });

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

      if (!member || (member.role !== "owner" && member.role !== "moderator")) {
        return reply.status(403).send({ error: "Only owner or moderator can pin" });
      }

      const [updated] = await db
        .update(topics)
        .set({
          pinnedMessageId: messageId,
          pinnedMessageContent: content ?? null,
          pinnedMessageAuthor: authorName ?? null,
        })
        .where(eq(topics.id, req.params.id))
        .returning();

      return updated;
    }
  );

  // Delete topic — owner/moderator only
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const [topic] = await db
        .select()
        .from(topics)
        .where(eq(topics.id, req.params.id))
        .limit(1);
      if (!topic) return reply.status(404).send({ error: "Topic not found" });

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

      if (!member || (member.role !== "owner" && member.role !== "moderator")) {
        return reply.status(403).send({ error: "Only owner or moderator can delete topics" });
      }

      await db.delete(topics).where(eq(topics.id, req.params.id));
      return reply.status(204).send();
    }
  );

  // Unpin — owner/moderator only
  fastify.delete<{ Params: { id: string } }>(
    "/:id/pin",
    { preHandler: requireAuth },
    async (req, reply) => {
      const [topic] = await db
        .select()
        .from(topics)
        .where(eq(topics.id, req.params.id))
        .limit(1);
      if (!topic) return reply.status(404).send({ error: "Topic not found" });

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

      if (!member || (member.role !== "owner" && member.role !== "moderator")) {
        return reply.status(403).send({ error: "Only owner or moderator can unpin" });
      }

      const [updated] = await db
        .update(topics)
        .set({ pinnedMessageId: null, pinnedMessageContent: null, pinnedMessageAuthor: null })
        .where(eq(topics.id, req.params.id))
        .returning();

      return updated;
    }
  );

  // Search messages in a topic
  // Search term is length-capped to prevent resource exhaustion.
  // Soft-deleted messages are excluded. Author names come from the member cache.
  fastify.get<{ Params: { id: string }; Querystring: { q: string } }>(
    "/:id/messages/search",
    { preHandler: requireAuth },
    async (req, reply) => {
      // Sanitise and cap the query string to prevent resource exhaustion
      const q = (req.query.q ?? "").trim().substring(0, 100);
      if (q.length < 2) return reply.send([]);

      const [topic] = await db
        .select()
        .from(topics)
        .where(eq(topics.id, req.params.id))
        .limit(1);
      if (!topic) return reply.status(404).send({ error: "Topic not found" });

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
      if (!member) return reply.status(403).send({ error: "Access denied" });

      const rows = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.topicId, req.params.id),
            ilike(messages.content, `%${q}%`),
            isNull(messages.deletedAt)      // exclude soft-deleted
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(20);

      if (rows.length === 0) return [];

      // Resolve author names from the community member cache
      const memberRows = await db
        .select({ userId: communityMembers.userId, displayName: communityMembers.displayName })
        .from(communityMembers)
        .where(eq(communityMembers.communityId, topic.communityId));

      const memberNameMap = new Map<string, string>(
        memberRows
          .filter((m) => m.displayName != null)
          .map((m) => [m.userId, m.displayName as string])
      );

      // Bulk-fetch Clerk names for any IDs not in the member cache
      const unknownIds = [...new Set(rows.map((r) => r.authorId))].filter(
        (id) => !memberNameMap.has(id)
      );
      if (unknownIds.length > 0) {
        const clerkNames = await bulkGetClerkDisplayNames(unknownIds);
        for (const [id, name] of clerkNames) memberNameMap.set(id, name);
      }

      return rows.map((m) => ({
        id: m.id,
        content: m.content,
        authorId: m.authorId,
        authorName: memberNameMap.get(m.authorId) ?? m.authorId,
        createdAt: m.createdAt,
      }));
    }
  );
}
