import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { db } from "../lib/db.js";
import { klips, messages, topics, communityMembers } from "@klip/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { z } from "zod";

const saveKlipSchema = z.object({
  messageId: z.string().uuid(),
  note: z.string().max(1000).optional(),
});

export async function klipsRoutes(fastify: FastifyInstance) {
  // List user's klips — excludes soft-deleted messages.
  // Joins topics to include communityId so clients can build correct navigation URLs.
  fastify.get("/", { preHandler: requireAuth }, async (req) => {
    const rows = await db
      .select({ klip: klips, message: messages, communityId: topics.communityId })
      .from(klips)
      .innerJoin(messages, eq(klips.messageId, messages.id))
      .innerJoin(topics, eq(messages.topicId, topics.id))
      .where(and(eq(klips.userId, req.userId), isNull(messages.deletedAt)))
      .orderBy(desc(klips.createdAt))
      .limit(200);

    return rows.map(({ klip, message, communityId }) => ({
      klip,
      message: { ...message, communityId },
    }));
  });

  // Save a klip — requires community membership of the message's topic
  fastify.post("/", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = saveKlipSchema.safeParse(req.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { messageId, note } = parsed.data;

    // Fetch the message
    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (!message) {
      return reply.status(404).send({ error: "Message not found" });
    }

    // Fetch the topic to get communityId
    const [topic] = await db
      .select({ communityId: topics.communityId })
      .from(topics)
      .where(eq(topics.id, message.topicId))
      .limit(1);

    if (!topic) {
      return reply.status(404).send({ error: "Topic not found" });
    }

    // Verify the requesting user is a member of that community.
    // Without this check, any authenticated user who knows a messageId can
    // bookmark messages from communities they don't belong to.
    const [member] = await db
      .select({ id: communityMembers.id })
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, topic.communityId),
          eq(communityMembers.userId, req.userId)
        )
      )
      .limit(1);

    if (!member) {
      return reply.status(403).send({ error: "Not a member of this community" });
    }

    const [klip] = await db
      .insert(klips)
      .values({ userId: req.userId, messageId, note })
      .returning();

    return reply.status(201).send(klip);
  });

  // Delete a klip
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const [deleted] = await db
        .delete(klips)
        .where(and(eq(klips.id, req.params.id), eq(klips.userId, req.userId)))
        .returning();

      if (!deleted) {
        return reply.status(404).send({ error: "Klip not found" });
      }

      return { success: true };
    }
  );
}
