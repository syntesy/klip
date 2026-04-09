import type { FastifyInstance } from "fastify";
import { createClerkClient } from "@clerk/backend";
import { requireAuth } from "../plugins/auth.js";
import { db } from "../lib/db.js";
import { topics, communityMembers, messages } from "@klip/db/schema";
import { eq, and, desc, ilike, isNull } from "drizzle-orm";
import { z } from "zod";

// Used only for bulk getUserList in search — individual lookups go through clerkCache
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY ?? "" });

const createTopicSchema = z.object({
  communityId: z.string().uuid(),
  title: z.string().min(2).max(200),
  description: z.string().max(1000).optional(),
});

export async function topicsRoutes(fastify: FastifyInstance) {
  // List topics for a community
  fastify.get<{ Querystring: { communityId: string } }>(
    "/",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { communityId } = req.query;

      // Verify membership
      const member = await db
        .select()
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, communityId),
            eq(communityMembers.userId, req.userId)
          )
        )
        .limit(1);

      if (member.length === 0) {
        return reply.status(403).send({ error: "Not a member" });
      }

      return db
        .select()
        .from(topics)
        .where(and(eq(topics.communityId, communityId), eq(topics.status, "active")))
        .orderBy(desc(topics.isPinned), desc(topics.lastActivityAt));
    }
  );

  // Get single topic by id
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

    // Verify membership and permission (owner or moderator can create)
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
  fastify.post<{ Params: { id: string }; Body: { messageId: string; content: string; authorName: string } }>(
    "/:id/pin",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { messageId, content, authorName } = req.body ?? {};
      if (!messageId) return reply.status(400).send({ error: "messageId required" });

      const [topic] = await db.select().from(topics).where(eq(topics.id, req.params.id)).limit(1);
      if (!topic) return reply.status(404).send({ error: "Topic not found" });

      const [member] = await db
        .select()
        .from(communityMembers)
        .where(and(eq(communityMembers.communityId, topic.communityId), eq(communityMembers.userId, req.userId)))
        .limit(1);

      if (!member || (member.role !== "owner" && member.role !== "moderator")) {
        return reply.status(403).send({ error: "Only owner or moderator can pin" });
      }

      const [updated] = await db
        .update(topics)
        .set({ pinnedMessageId: messageId, pinnedMessageContent: content ?? null, pinnedMessageAuthor: authorName ?? null })
        .where(eq(topics.id, req.params.id))
        .returning();

      return updated;
    }
  );

  // Unpin — owner/moderator only
  fastify.delete<{ Params: { id: string } }>(
    "/:id/pin",
    { preHandler: requireAuth },
    async (req, reply) => {
      const [topic] = await db.select().from(topics).where(eq(topics.id, req.params.id)).limit(1);
      if (!topic) return reply.status(404).send({ error: "Topic not found" });

      const [member] = await db
        .select()
        .from(communityMembers)
        .where(and(eq(communityMembers.communityId, topic.communityId), eq(communityMembers.userId, req.userId)))
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
  fastify.get<{ Params: { id: string }; Querystring: { q: string } }>(
    "/:id/messages/search",
    { preHandler: requireAuth },
    async (req, reply) => {
      const q = (req.query.q ?? "").trim();
      if (q.length < 2) return reply.send([]);

      const [topic] = await db.select().from(topics).where(eq(topics.id, req.params.id)).limit(1);
      if (!topic) return reply.status(404).send({ error: "Topic not found" });

      const [member] = await db
        .select()
        .from(communityMembers)
        .where(and(eq(communityMembers.communityId, topic.communityId), eq(communityMembers.userId, req.userId)))
        .limit(1);
      if (!member) return reply.status(403).send({ error: "Access denied" });

      const rows = await db
        .select()
        .from(messages)
        .where(and(
          eq(messages.topicId, req.params.id),
          ilike(messages.content, `%${q}%`),
          isNull(messages.deletedAt)
        ))
        .orderBy(desc(messages.createdAt))
        .limit(20);

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
            authorMap.set(u.id, u.fullName ?? u.firstName ?? u.emailAddresses[0]?.emailAddress ?? u.id);
          }
        } catch { /* non-fatal */ }
      }

      return rows.map((m) => ({
        id: m.id,
        content: m.content,
        authorId: m.authorId,
        authorName: authorMap.get(m.authorId) ?? m.authorId,
        createdAt: m.createdAt,
      }));
    }
  );
}
