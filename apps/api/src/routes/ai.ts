import type { FastifyInstance } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../plugins/auth.js";
import { db } from "../lib/db.js";
import { checkRateLimit, anthropicCircuitBreaker, sanitizeMarkdown } from "../lib/aiGuards.js";
import { messages, topics, communityMembers, aiSummaries } from "@klip/db/schema";
import { eq, and, asc, desc, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const summarySchema = z.object({
  topicId: z.string().uuid(),
});

export async function aiRoutes(fastify: FastifyInstance) {
  // List all summaries (as "decisions") across user's communities
  fastify.get("/decisions", { preHandler: requireAuth }, async (req) => {
    // Get all communities the user belongs to
    const memberships = await db
      .select({ communityId: communityMembers.communityId })
      .from(communityMembers)
      .where(eq(communityMembers.userId, req.userId));

    if (memberships.length === 0) return [];

    const communityIds = memberships.map((m) => m.communityId);

    // Get all topics in those communities
    const communityTopics = await db
      .select({ id: topics.id, title: topics.title, communityId: topics.communityId })
      .from(topics)
      .where(inArray(topics.communityId, communityIds));

    if (communityTopics.length === 0) return [];

    const topicIds = communityTopics.map((t) => t.id);
    const topicMap = new Map(communityTopics.map((t) => [t.id, t]));

    // Get latest summary per topic — cap at 200 to bound payload size.
    // Deduplication below keeps one per topic, so effective return is ≤ topicIds.length.
    const summaries = await db
      .select()
      .from(aiSummaries)
      .where(inArray(aiSummaries.topicId, topicIds))
      .orderBy(desc(aiSummaries.createdAt))
      .limit(200);

    // Deduplicate: one per topic (latest only)
    const seen = new Set<string>();
    return summaries
      .filter((s) => {
        if (seen.has(s.topicId)) return false;
        seen.add(s.topicId);
        return true;
      })
      .map((s) => ({
        id: s.id,
        content: s.content,
        topicId: s.topicId,
        communityId: topicMap.get(s.topicId)?.communityId ?? "",
        topicTitle: topicMap.get(s.topicId)?.title ?? "Tópico",
        generatedAt: s.createdAt,
      }));
  });

  // Get latest AI summary for a topic
  fastify.get<{ Querystring: { topicId: string } }>(
    "/summary",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { topicId } = req.query;

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

      const [summary] = await db
        .select()
        .from(aiSummaries)
        .where(eq(aiSummaries.topicId, topicId))
        .orderBy(desc(aiSummaries.createdAt))
        .limit(1);

      if (!summary) {
        return reply.status(404).send({ error: "No summary yet" });
      }

      return {
        content: summary.content,
        decisions: [] as string[],
        generatedAt: summary.createdAt,
      };
    }
  );

  // Generate AI summary for a topic on demand
  // Protected by: auth, per-userId rate limit, and Anthropic circuit breaker
  fastify.post("/summary", { preHandler: requireAuth }, async (req, reply) => {
    // Per-userId rate limit (3 req/min) — more meaningful than IP-based for authenticated endpoints
    if (!checkRateLimit(req.userId)) {
      return reply.status(429).send({ error: "Too many requests. Aguarde um momento." });
    }

    const parsed = summarySchema.safeParse(req.body);

    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { topicId } = parsed.data;

    const [topic] = await db
      .select()
      .from(topics)
      .where(eq(topics.id, topicId))
      .limit(1);

    if (!topic) {
      return reply.status(404).send({ error: "Topic not found" });
    }

    // Verify membership
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

    // Fetch last 100 non-deleted messages — soft-deleted content must not
    // appear in AI summaries; users expect deletion to mean removal.
    const topicMessages = await db
      .select()
      .from(messages)
      .where(and(eq(messages.topicId, topicId), isNull(messages.deletedAt)))
      .orderBy(asc(messages.createdAt))
      .limit(100);

    if (topicMessages.length === 0) {
      return reply.status(400).send({ error: "No messages to summarize" });
    }

    // Circuit breaker: fail fast when Anthropic is known to be unavailable
    if (anthropicCircuitBreaker.isOpen()) {
      return reply.status(503).send({ error: "Serviço de IA temporariamente indisponível. Tente novamente em breve." });
    }

    const conversation = topicMessages
      .map((m) => `[${m.authorId}]: ${m.content}`)
      .join("\n");

    let rawContent: string;
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Você é um assistente que cria resumos concisos de conversas em comunidades.

Tópico: "${topic.title}"
${topic.description ? `Descrição: ${topic.description}` : ""}

Conversa:
${conversation}

Crie um resumo estruturado com:
- **Pontos principais discutidos**
- **Decisões tomadas** (se houver)
- **Próximos passos** (se mencionados)

Seja conciso e objetivo. Use markdown.`,
          },
        ],
      });

      const summaryContent = response.content[0];
      if (summaryContent?.type !== "text") {
        return reply.status(500).send({ error: "Unexpected AI response" });
      }

      rawContent = summaryContent.text;
      anthropicCircuitBreaker.onSuccess();
    } catch (err) {
      anthropicCircuitBreaker.onFailure();
      const e = err instanceof Error ? err : new Error(String(err));
      fastify.log.error({ message: e.message, name: e.name }, "Anthropic API call failed");
      return reply.status(503).send({ error: "Falha ao contatar serviço de IA. Tente novamente." });
    }

    // Sanitize before storing — strip any HTML the AI might have emitted
    // (prevents XSS if content is rendered as HTML in the frontend)
    const sanitized = sanitizeMarkdown(rawContent);

    const [summary] = await db
      .insert(aiSummaries)
      .values({
        topicId,
        content: sanitized,
        requestedBy: req.userId,
      })
      .returning();

    return summary;
  });
}
