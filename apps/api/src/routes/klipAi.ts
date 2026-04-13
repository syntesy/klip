import type { FastifyInstance } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../plugins/auth.js";
import { db } from "../lib/db.js";
import { getIo } from "../lib/io.js";
import { checkRateLimit, anthropicCircuitBreaker, sanitizeMarkdown } from "../lib/aiGuards.js";
import { messages, topics, communityMembers } from "@klip/db/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { z } from "zod";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const klipCommandSchema = z.object({
  command: z.string().min(1).max(1000),
  isPrivate: z.boolean(),
});

export async function klipAiRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: { topicId: string } }>(
    "/:topicId/klip-command",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { topicId } = req.params;

      // Per-userId rate limit (shared with summary endpoint — 3 AI req/min)
      if (!checkRateLimit(req.userId)) {
        return reply.status(429).send({ error: "Too many requests. Aguarde um momento." });
      }

      const parsed = klipCommandSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const { command, isPrivate } = parsed.data;

      // Verify topic and membership
      const [topic] = await db
        .select({ communityId: topics.communityId, title: topics.title })
        .from(topics)
        .where(eq(topics.id, topicId))
        .limit(1);

      if (!topic) return reply.status(404).send({ error: "Tópico não encontrado" });

      const [member] = await db
        .select({ id: communityMembers.id })
        .from(communityMembers)
        .where(and(eq(communityMembers.communityId, topic.communityId), eq(communityMembers.userId, req.userId)))
        .limit(1);

      if (!member) return reply.status(403).send({ error: "Acesso negado" });

      // Fetch last 40 non-deleted, non-AI messages for context
      const recentMessages = await db
        .select({ authorId: messages.authorId, content: messages.content })
        .from(messages)
        .where(and(eq(messages.topicId, topicId), isNull(messages.deletedAt)))
        .orderBy(desc(messages.createdAt))
        .limit(40);

      recentMessages.reverse();

      const humanMessages = recentMessages.filter((m) => m.authorId !== "klip-ai");

      // Circuit breaker
      if (anthropicCircuitBreaker.isOpen()) {
        return reply.status(503).send({ error: "Serviço de IA temporariamente indisponível. Tente novamente em breve." });
      }

      const context = humanMessages
        .map((m) => `[usuário]: ${m.content}`)
        .join("\n");

      let rawContent: string;
      try {
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 1024,
          system:
            "Você é @klip, o assistente de IA desta comunidade. Você responde perguntas e comandos dos usuários de forma concisa e útil, com base nas conversas do tópico. Responda sempre em português.",
          messages: [
            {
              role: "user",
              content: context
                ? `Contexto das últimas mensagens do tópico "${topic.title}":\n\n${context}\n\nComando: ${command}`
                : `Tópico: "${topic.title}"\n\nComando: ${command}`,
            },
          ],
        });

        const block = response.content[0];
        if (block?.type !== "text") {
          return reply.status(500).send({ error: "Resposta inesperada da IA" });
        }

        rawContent = block.text;
        anthropicCircuitBreaker.onSuccess();
      } catch (err) {
        anthropicCircuitBreaker.onFailure();
        const e = err instanceof Error ? err : new Error(String(err));
        fastify.log.error({ message: e.message, name: e.name }, "Anthropic API call failed (klip-command)");
        return reply.status(503).send({ error: "Falha ao contatar serviço de IA. Tente novamente." });
      }

      const sanitized = sanitizeMarkdown(rawContent);

      // Private (/klip): return without persisting or broadcasting
      if (isPrivate) {
        return { response: sanitized };
      }

      // Public (@klip): persist as AI message and broadcast via Socket.io
      const [msg] = await db
        .insert(messages)
        .values({
          topicId,
          authorId: "klip-ai",
          content: sanitized,
          attachments: [],
        })
        .returning();

      if (!msg) return reply.status(500).send({ error: "Falha ao salvar mensagem da IA" });

      try {
        const io = getIo();
        io.to(`topic:${topicId}`).emit("message:new", {
          id: msg.id,
          topicId: msg.topicId,
          authorId: "klip-ai",
          authorName: "@klip",
          content: msg.content,
          isEdited: false,
          isKlipped: false,
          isDecision: false,
          attachments: [],
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
          deletedAt: null,
          replyToId: null,
          replyToAuthorName: null,
          replyToContent: null,
        });
      } catch {
        // Socket.io not critical — message is persisted, clients will see it on next load
      }

      return { response: sanitized, messageId: msg.id };
    }
  );
}
