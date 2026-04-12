import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { db } from "../lib/db.js";
import { clerkClient } from "../lib/clerk.js";
import { bulkGetClerkDisplayNames } from "../lib/clerkCache.js";
import {
  savedMessages,
  messages,
  topics,
  communities,
} from "@klip/db/schema";
import { eq, and, lt, desc, count, isNull } from "drizzle-orm";

// ─── Plan helpers ──────────────────────────────────────────────────────────────

type UserPlan = "starter" | "pro" | "business";

async function getUserPlan(clerkUserId: string): Promise<UserPlan> {
  try {
    const user = await Promise.race([
      clerkClient.users.getUser(clerkUserId),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("plan fetch timeout")), 5_000)
      ),
    ]);
    const plan = user.publicMetadata?.["plan"] as string | undefined;
    if (plan === "pro" || plan === "business") return plan;
    return "starter";
  } catch {
    // Fail closed: treat timeout/error as starter (no access granted)
    return "starter";
  }
}

function canSave(plan: UserPlan): boolean {
  return plan === "pro" || plan === "business";
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function savedMessagesRoutes(fastify: FastifyInstance) {
  // ── POST /api/messages/:messageId/save ────────────────────────────────────
  // Save a message to the personal library. Pro/Business only.
  fastify.post<{ Params: { messageId: string } }>(
    "/messages/:messageId/save",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { messageId } = req.params;

      const plan = await getUserPlan(req.userId);
      if (!canSave(plan)) {
        return reply.status(403).send({
          error: "Upgrade to Pro to save messages",
          upgradeUrl: "/pricing",
        });
      }

      // Verify message exists and is not deleted
      const [message] = await db
        .select({ id: messages.id })
        .from(messages)
        .where(and(eq(messages.id, messageId), isNull(messages.deletedAt)))
        .limit(1);

      if (!message) {
        return reply.status(404).send({ error: "Message not found" });
      }

      // Upsert — idempotent
      const [row] = await db
        .insert(savedMessages)
        .values({ clerkUserId: req.userId, messageId })
        .onConflictDoNothing()
        .returning();

      // If already existed, fetch the savedAt
      let savedAt: Date = row?.savedAt ?? new Date();
      if (!row) {
        const existing = await db
          .select({ savedAt: savedMessages.savedAt })
          .from(savedMessages)
          .where(
            and(
              eq(savedMessages.clerkUserId, req.userId),
              eq(savedMessages.messageId, messageId)
            )
          )
          .limit(1);
        savedAt = existing[0]?.savedAt ?? savedAt;
      }

      return { saved: true, savedAt: savedAt.toISOString() };
    }
  );

  // ── DELETE /api/messages/:messageId/save ──────────────────────────────────
  // Remove a message from the personal library. Idempotent.
  fastify.delete<{ Params: { messageId: string } }>(
    "/messages/:messageId/save",
    { preHandler: requireAuth },
    async (req) => {
      await db
        .delete(savedMessages)
        .where(
          and(
            eq(savedMessages.clerkUserId, req.userId),
            eq(savedMessages.messageId, req.params.messageId)
          )
        );
      return { saved: false };
    }
  );

  // ── GET /api/me/saved-messages ─────────────────────────────────────────────
  // List saved messages with community/topic context. Pro/Business only.
  fastify.get<{
    Querystring: {
      communityId?: string;
      topicId?: string;
      cursor?: string;
      limit?: string;
    };
  }>(
    "/me/saved-messages",
    { preHandler: requireAuth },
    async (req, reply) => {
      const plan = await getUserPlan(req.userId);
      if (!canSave(plan)) {
        return reply.status(403).send({
          error: "Upgrade to Pro to access your library",
          upgradeUrl: "/pricing",
        });
      }

      const { communityId, topicId, cursor, limit: limitStr } = req.query;
      const pageSize = Math.min(Math.max(Number(limitStr ?? 20), 1), 50);

      // Build filters
      const filters = [eq(savedMessages.clerkUserId, req.userId)];
      if (cursor) {
        const cursorDate = new Date(cursor);
        if (isNaN(cursorDate.getTime())) {
          return reply.status(400).send({ error: "invalid cursor" });
        }
        filters.push(lt(savedMessages.savedAt, cursorDate));
      }

      // Join: saved_messages → messages → topics → communities
      const rows = await db
        .select({
          id: savedMessages.id,
          messageId: savedMessages.messageId,
          savedAt: savedMessages.savedAt,
          content: messages.content,
          authorId: messages.authorId,
          topicId: topics.id,
          topicTitle: topics.title,
          communityId: communities.id,
          communityName: communities.name,
          sentAt: messages.createdAt,
        })
        .from(savedMessages)
        .innerJoin(messages, eq(savedMessages.messageId, messages.id))
        .innerJoin(topics, eq(messages.topicId, topics.id))
        .innerJoin(communities, eq(topics.communityId, communities.id))
        .where(
          and(
            ...filters,
            isNull(messages.deletedAt),
            communityId ? eq(communities.id, communityId) : undefined,
            topicId ? eq(topics.id, topicId) : undefined
          )
        )
        .orderBy(desc(savedMessages.savedAt))
        .limit(pageSize + 1);

      const hasMore = rows.length > pageSize;
      const page = hasMore ? rows.slice(0, pageSize) : rows;

      // Resolve author names
      const uniqueAuthorIds = [...new Set(page.map((r) => r.authorId))];
      const nameMap = await bulkGetClerkDisplayNames(uniqueAuthorIds);

      const items = page.map((r) => ({
        id: r.id,
        messageId: r.messageId,
        savedAt: r.savedAt.toISOString(),
        message: {
          content: r.content.length > 140 ? r.content.slice(0, 140) + "…" : r.content,
          authorClerkId: r.authorId,
          authorName: nameMap.get(r.authorId) ?? r.authorId,
          topicId: r.topicId,
          topicTitle: r.topicTitle,
          communityId: r.communityId,
          communityName: r.communityName,
          sentAt: r.sentAt.toISOString(),
        },
      }));

      // Total count (for display — not paginated)
      const countRows = await db
        .select({ value: count() })
        .from(savedMessages)
        .where(eq(savedMessages.clerkUserId, req.userId));
      const total = countRows[0]?.value ?? 0;

      return {
        items,
        nextCursor: hasMore ? page[page.length - 1]!.savedAt.toISOString() : null,
        total: Number(total),
      };
    }
  );

  // ── GET /api/me/saved-messages/count ──────────────────────────────────────
  // Returns total count of saved messages (for sidebar badge).
  fastify.get(
    "/me/saved-messages/count",
    { preHandler: requireAuth },
    async (req) => {
      const rows = await db
        .select({ value: count() })
        .from(savedMessages)
        .where(eq(savedMessages.clerkUserId, req.userId));
      const value = rows[0]?.value ?? 0;

      return { count: Number(value) };
    }
  );
}
