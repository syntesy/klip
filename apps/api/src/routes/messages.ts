import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { db } from "../lib/db.js";
import { getIo } from "../lib/io.js";
import { bulkGetClerkDisplayNames } from "../lib/clerkCache.js";
import { messages, topics, communityMembers, messageReactions, savedMessages } from "@klip/db/schema";
import { eq, and, asc, desc, sql, isNull, lt, inArray } from "drizzle-orm";
import { z } from "zod";

const sendMessageSchema = z.object({
  topicId: z.string().uuid(),
  content: z.string().min(1).max(4000),
});

/**
 * Verifies the requesting user is a member of the community that owns the
 * given message. Uses a single JOIN query instead of 3 sequential round-trips.
 * Returns { ok: true } on success, or { ok: false, status } on failure.
 */
async function assertMessageMembership(
  messageId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; status: 403 | 404 }> {
  // Single query: messages JOIN topics JOIN communityMembers
  // If the message doesn't exist the outer result is empty → 404
  // If the user isn't a member the member join yields nothing → 403
  const [row] = await db
    .select({ memberId: communityMembers.id, messageExists: messages.id })
    .from(messages)
    .innerJoin(topics, eq(topics.id, messages.topicId))
    .leftJoin(
      communityMembers,
      and(
        eq(communityMembers.communityId, topics.communityId),
        eq(communityMembers.userId, userId)
      )
    )
    .where(eq(messages.id, messageId))
    .limit(1);

  if (!row) return { ok: false, status: 404 };
  if (!row.memberId) return { ok: false, status: 403 };
  return { ok: true };
}

export async function messagesRoutes(fastify: FastifyInstance) {
  // Get messages for a topic — cursor-based pagination via `before` (messageId).
  // Soft-deleted messages are excluded from the response.
  // Author names are resolved from the communityMembers.displayName cache first,
  // and only fall back to a Clerk bulk-lookup for any that are missing.
  fastify.get<{ Querystring: { topicId: string; before?: string; limit?: string } }>(
    "/",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { topicId, before } = req.query;
      const pageSize = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 100);

      // Validate `before` as a UUID to prevent silent fallback to page 1 on bad input
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (before !== undefined && !UUID_RE.test(before)) {
        return reply.status(400).send({ error: "invalid cursor: before must be a valid UUID" });
      }

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

      // Fetch messages excluding soft-deleted ones.
      // `before` is a message UUID used as a cursor: returns the page of messages
      // with createdAt strictly before that message, enabling infinite-scroll backwards.
      // We fetch pageSize+1 to detect whether a previous page exists.
      let beforeTimestamp: Date | undefined;
      if (before) {
        const [cursorMsg] = await db
          .select({ createdAt: messages.createdAt })
          .from(messages)
          .where(eq(messages.id, before))
          .limit(1);
        if (cursorMsg) beforeTimestamp = cursorMsg.createdAt;
      }

      // Fetch messages — plain select() to avoid any JOIN breaking the core query
      const rows = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.topicId, topicId),
            isNull(messages.deletedAt),
            beforeTimestamp ? lt(messages.createdAt, beforeTimestamp) : undefined
          )
        )
        .orderBy(before ? desc(messages.createdAt) : asc(messages.createdAt))
        .limit(pageSize + 1); // fetch one extra to determine if there's a previous page

      if (rows.length === 0) return { messages: [], hasPreviousPage: false, nextCursor: null };

      const hasPreviousPage = rows.length > pageSize;
      const page = hasPreviousPage ? rows.slice(0, pageSize) : rows;
      // When paginating backwards (before cursor), results come newest-first; reverse for UI
      if (before) page.reverse();

      // Fetch which messages the current user has saved — separate query so a missing
      // saved_messages table or any other error never breaks the main message list.
      const pageIds = page.map((m) => m.id);
      let savedSet = new Set<string>();
      try {
        const savedRows = await db
          .select({ messageId: savedMessages.messageId })
          .from(savedMessages)
          .where(
            and(
              eq(savedMessages.clerkUserId, req.userId),
              inArray(savedMessages.messageId, pageIds)
            )
          );
        savedSet = new Set(savedRows.map((r) => r.messageId));
      } catch {
        // Non-fatal — savedByCurrentUser defaults to false
      }

      // Resolve author names: prefer cached displayName from communityMembers.
      // Only fetch members whose userId appears in this page — not the entire community —
      // so the query stays O(page authors) instead of O(community size).
      const uniqueAuthorIds = [...new Set(page.map((m) => m.authorId))];
      const communityMemberRows = await db
        .select({ userId: communityMembers.userId, displayName: communityMembers.displayName })
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, topic.communityId),
            inArray(communityMembers.userId, uniqueAuthorIds)
          )
        );

      const memberNameMap = new Map<string, string>(
        communityMemberRows
          .filter((m) => m.displayName != null)
          .map((m) => [m.userId, m.displayName as string])
      );

      // For any author ID not in memberNameMap, fall back to Clerk bulk-lookup
      const unknownIds = uniqueAuthorIds.filter((id) => !memberNameMap.has(id));
      if (unknownIds.length > 0) {
        const clerkNames = await bulkGetClerkDisplayNames(unknownIds);
        for (const [id, name] of clerkNames) memberNameMap.set(id, name);
      }

      return {
        messages: page.map((m) => ({
          ...m,
          authorName: memberNameMap.get(m.authorId) ?? m.authorId,
          savedByCurrentUser: savedSet.has(m.id),
        })),
        hasPreviousPage,
        // nextCursor is the createdAt of the oldest message in this page,
        // to be passed as `before` in the next request
        nextCursor: hasPreviousPage ? page[0]?.id ?? null : null,
      };
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

  // Soft-delete a message — author can delete their own; owner/moderator can delete any.
  // Emits "message:deleted" to the topic room so clients remove it immediately.
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const [message] = await db
        .select({ id: messages.id, authorId: messages.authorId, topicId: messages.topicId, deletedAt: messages.deletedAt })
        .from(messages)
        .where(eq(messages.id, req.params.id))
        .limit(1);

      if (!message) return reply.status(404).send({ error: "Message not found" });
      if (message.deletedAt) return reply.status(410).send({ error: "Message already deleted" });

      const [topic] = await db
        .select({ communityId: topics.communityId })
        .from(topics)
        .where(eq(topics.id, message.topicId))
        .limit(1);
      if (!topic) return reply.status(404).send({ error: "Topic not found" });

      const [member] = await db
        .select({ role: communityMembers.role })
        .from(communityMembers)
        .where(and(eq(communityMembers.communityId, topic.communityId), eq(communityMembers.userId, req.userId)))
        .limit(1);

      if (!member) return reply.status(403).send({ error: "Access denied" });

      // Authors can delete their own messages; owner/moderator can delete any
      const canDelete =
        message.authorId === req.userId ||
        member.role === "owner" ||
        member.role === "moderator";

      if (!canDelete) return reply.status(403).send({ error: "Cannot delete another user's message" });

      await db
        .update(messages)
        .set({ deletedAt: new Date() })
        .where(eq(messages.id, req.params.id));

      // Notify room so clients remove the message without a page refresh
      try {
        getIo().to(`topic:${message.topicId}`).emit("message:deleted", req.params.id);
      } catch (err) {
        // io not yet initialized (test environment) or socket error — DB update already committed
        fastify.log.warn({ err }, "message:deleted socket emit failed");
      }

      return reply.status(204).send();
    }
  );

  // Add reaction — requires membership of the community that owns the message
  fastify.post<{ Params: { id: string }; Body: { emoji: string } }>(
    "/:id/reactions",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { emoji } = req.body ?? {};
      if (!emoji) return reply.status(400).send({ error: "emoji required" });

      const auth = await assertMessageMembership(req.params.id, req.userId);
      if (!auth.ok) return reply.status(auth.status).send({ error: auth.status === 404 ? "Message not found" : "Access denied" });

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

  // Remove reaction — requires membership of the community that owns the message
  fastify.delete<{ Params: { id: string }; Body: { emoji: string } }>(
    "/:id/reactions",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { emoji } = req.body ?? {};
      if (!emoji) return reply.status(400).send({ error: "emoji required" });

      const auth = await assertMessageMembership(req.params.id, req.userId);
      if (!auth.ok) return reply.status(auth.status).send({ error: auth.status === 404 ? "Message not found" : "Access denied" });

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

  // Get reactions for a message — requires membership
  fastify.get<{ Params: { id: string } }>(
    "/:id/reactions",
    { preHandler: requireAuth },
    async (req, reply) => {
      const auth = await assertMessageMembership(req.params.id, req.userId);
      if (!auth.ok) return reply.status(auth.status).send({ error: auth.status === 404 ? "Message not found" : "Access denied" });

      const rows = await db
        .select()
        .from(messageReactions)
        .where(eq(messageReactions.messageId, req.params.id));
      return rows;
    }
  );
}
