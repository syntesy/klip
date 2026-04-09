import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { db } from "../lib/db.js";
import { klips, messages } from "@klip/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const saveKlipSchema = z.object({
  messageId: z.string().uuid(),
  note: z.string().max(1000).optional(),
});

export async function klipsRoutes(fastify: FastifyInstance) {
  // List user's klips
  fastify.get("/", { preHandler: requireAuth }, async (req) => {
    return db
      .select({ klip: klips, message: messages })
      .from(klips)
      .innerJoin(messages, eq(klips.messageId, messages.id))
      .where(eq(klips.userId, req.userId))
      .orderBy(desc(klips.createdAt));
  });

  // Save a klip
  fastify.post("/", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = saveKlipSchema.safeParse(req.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { messageId, note } = parsed.data;

    const [message] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);

    if (!message) {
      return reply.status(404).send({ error: "Message not found" });
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
