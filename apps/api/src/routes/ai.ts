import type { FastifyInstance } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../plugins/auth.js";
import { db } from "../lib/db.js";
import { messages, topics, communityMembers, aiSummaries } from "@klip/db/schema";
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { z } from "zod";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const summarySchema = z.object({
  topicId: z.string().uuid(),
});

// ─── Per-userId rate limiter ──────────────────────────────────────────────────
// Simple in-memory limiter; single-instance Railway deployment makes this safe.
// Max 3 AI summary requests per user per 60 seconds.

const RATE_MAX = 3;
const RATE_WINDOW_MS = 60_000;

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(userId);

  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true; // allowed
  }

  if (bucket.count >= RATE_MAX) return false; // blocked

  bucket.count += 1;
  return true; // allowed
}

// Periodically purge expired buckets to avoid unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [id, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(id);
  }
}, 120_000).unref();

// ─── Circuit breaker for Anthropic ───────────────────────────────────────────
// Prevents cascading failures when Anthropic is down or over quota.
// CLOSED → (N failures) → OPEN → (timeout) → HALF_OPEN → (success) → CLOSED
//                                                        → (failure) → OPEN

const CB_FAILURE_THRESHOLD = 5;    // open after 5 consecutive failures
const CB_RESET_TIMEOUT_MS = 60_000; // try again after 60s

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

const circuitBreaker = {
  state: "CLOSED" as CircuitState,
  failures: 0,
  openedAt: 0,

  isOpen(): boolean {
    if (this.state === "CLOSED") return false;
    if (this.state === "HALF_OPEN") return false;

    // OPEN — check if cooldown has elapsed
    if (Date.now() - this.openedAt >= CB_RESET_TIMEOUT_MS) {
      this.state = "HALF_OPEN";
      return false; // allow a probe request through
    }
    return true; // still open
  },

  onSuccess(): void {
    this.failures = 0;
    this.state = "CLOSED";
  },

  onFailure(): void {
    this.failures += 1;
    if (this.state === "HALF_OPEN" || this.failures >= CB_FAILURE_THRESHOLD) {
      this.state = "OPEN";
      this.openedAt = Date.now();
    }
  },
};

// ─── XSS sanitization ────────────────────────────────────────────────────────
// Strip all HTML tags from AI-generated markdown. The AI should never produce
// raw HTML; if it does (e.g. prompt-injected via message content), this
// prevents script injection when the markdown is rendered in the browser.

function sanitizeMarkdown(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}

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

    // Get latest summary per topic
    const summaries = await db
      .select()
      .from(aiSummaries)
      .where(inArray(aiSummaries.topicId, topicIds))
      .orderBy(desc(aiSummaries.createdAt));

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

    // Fetch last 100 messages
    const topicMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.topicId, topicId))
      .orderBy(asc(messages.createdAt))
      .limit(100);

    if (topicMessages.length === 0) {
      return reply.status(400).send({ error: "No messages to summarize" });
    }

    // Circuit breaker: fail fast when Anthropic is known to be unavailable
    if (circuitBreaker.isOpen()) {
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
      circuitBreaker.onSuccess();
    } catch (err) {
      circuitBreaker.onFailure();
      fastify.log.error({ err }, "Anthropic API call failed");
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
