import type { FastifyInstance } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../plugins/auth.js";
import { db } from "../lib/db.js";
import { checkRateLimit, anthropicCircuitBreaker, sanitizeMarkdown } from "../lib/aiGuards.js";
import {
  messages,
  topics,
  communityMembers,
  extractedContents,
  inviteCardImpressions,
  type ContentIdea,
} from "@klip/db/schema";
import { eq, and, inArray, asc, isNotNull } from "drizzle-orm";
import { z } from "zod";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Schemas ──────────────────────────────────────────────────────────────────

const extractSchema = z.object({
  topicId: z.string().uuid(),
  communityId: z.string().uuid(),
  messageIds: z.array(z.string().uuid()).min(1).max(50),
});

const publishSchema = z.object({
  extractedContentId: z.string().uuid(),
  title: z.string().min(1).max(300),
  summary: z.string().min(1),
  accessLevel: z.enum(["free", "premium"]).default("premium"),
});

const inviteCardSchema = z.object({
  action: z.enum(["clicked_yes", "clicked_no"]),
});

// ─── AI response shape ────────────────────────────────────────────────────────

interface AiExtractResult {
  summary: string;
  title_options: [string, string, string];
  content_ideas: ContentIdea[];
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function extrairRoutes(fastify: FastifyInstance) {

  // ── POST /api/extrair ──────────────────────────────────────────────────────
  fastify.post("/", { preHandler: requireAuth }, async (req, reply) => {
    // Per-userId rate limit — same budget as /api/ai/summary (3 req/min)
    if (!checkRateLimit(req.userId)) {
      return reply.status(429).send({ error: "Too many requests. Aguarde um momento." });
    }

    const parsed = extractSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { topicId, communityId, messageIds } = parsed.data;

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

    if (!member || (member.role !== "owner" && member.role !== "moderator")) {
      return reply.status(403).send({ error: "Apenas owners e moderadores podem extrair conteúdo" });
    }

    // Verify the topic exists AND belongs to the declared communityId.
    // Without this check, an owner could pass their communityId alongside a
    // topicId from a different community, bypassing the membership gate.
    const [topic] = await db
      .select()
      .from(topics)
      .where(eq(topics.id, topicId))
      .limit(1);

    if (!topic) {
      return reply.status(404).send({ error: "Tópico não encontrado" });
    }

    if (topic.communityId !== communityId) {
      return reply.status(403).send({ error: "Tópico não pertence a esta comunidade" });
    }

    // Fetch messages — filter by BOTH messageId and topicId so that message
    // UUIDs from other communities/topics cannot be injected into this context.
    const rows = await db
      .select()
      .from(messages)
      .where(and(inArray(messages.id, messageIds), eq(messages.topicId, topicId)))
      .orderBy(asc(messages.createdAt));

    if (rows.length === 0) {
      return reply.status(404).send({ error: "Mensagens não encontradas" });
    }

    const conversation = rows
      .map((m) => `[${m.authorId}]: ${m.content}`)
      .join("\n");

    // Fail fast if Anthropic is known to be unavailable
    if (anthropicCircuitBreaker.isOpen()) {
      return reply.status(503).send({ error: "Serviço de IA temporariamente indisponível. Tente novamente em breve." });
    }

    let aiResult: AiExtractResult;
    try {
      const aiResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Tópico: "${topic.title}"

Mensagens:
${conversation}

Voce e o Klip. Analise as mensagens e retorne APENAS JSON:
{
  "summary": "string (2-4 linhas, tom direto)",
  "title_options": ["opcao1", "opcao2", "opcao3"],
  "content_ideas": [
    { "type": "checklist|faq|insight|continuacao", "title": "string", "description": "string" }
  ]
}
Maximo 4 content_ideas. Apenas JSON, sem markdown.`,
          },
        ],
      });

      anthropicCircuitBreaker.onSuccess();

      const rawText = aiResponse.content[0];
      if (rawText?.type !== "text") {
        // Successful HTTP response but unexpected content shape — don't trip the CB
        fastify.log.error({ content: aiResponse.content }, "Unexpected Anthropic response shape in /api/extrair");
        return reply.status(500).send({ error: "Resposta inesperada da IA" });
      }

      // Strip possible markdown fences
      const cleaned = rawText.text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      try {
        aiResult = JSON.parse(cleaned) as AiExtractResult;
      } catch {
        // JSON parse failure is a format error from AI, not an Anthropic outage — don't trip CB
        fastify.log.error({ cleaned }, "Failed to parse Anthropic JSON response in /api/extrair");
        return reply.status(500).send({ error: "Resposta inesperada da IA" });
      }
    } catch (err) {
      // Only network/auth errors reach here — these indicate Anthropic is down
      anthropicCircuitBreaker.onFailure();
      fastify.log.error({ err }, "Anthropic API call failed in /api/extrair");
      return reply.status(503).send({ error: "Falha ao contatar serviço de IA. Tente novamente." });
    }

    // Sanitize AI output before storing — strip any HTML that could enable XSS
    const sanitizedSummary = sanitizeMarkdown(aiResult.summary ?? "");
    const sanitizedTitles = (aiResult.title_options ?? ["", "", ""]).map(sanitizeMarkdown) as [string, string, string];
    const sanitizedIdeas = (aiResult.content_ideas ?? []).slice(0, 4).map((idea) => ({
      ...idea,
      title: sanitizeMarkdown(idea.title ?? ""),
      description: sanitizeMarkdown(idea.description ?? ""),
    }));

    // Save as draft
    const [draft] = await db
      .insert(extractedContents)
      .values({
        communityId,
        topicId,
        createdBy: req.userId,
        inputType: "text",
        sourceMessageIds: messageIds,
        title: sanitizedTitles[0] ?? "",
        summary: sanitizedSummary,
        contentIdeas: sanitizedIdeas,
        accessLevel: "premium",
      })
      .returning();

    return reply.status(201).send({
      id: draft!.id,
      summary: draft!.summary,
      titleOptions: sanitizedTitles,
      contentIdeas: draft!.contentIdeas,
    });
  });

  // ── POST /api/extrair/publish ──────────────────────────────────────────────
  fastify.post("/publish", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = publishSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { extractedContentId, title, summary, accessLevel } = parsed.data;

    // Find the draft and verify ownership
    const [draft] = await db
      .select()
      .from(extractedContents)
      .where(eq(extractedContents.id, extractedContentId))
      .limit(1);

    if (!draft) {
      return reply.status(404).send({ error: "Rascunho não encontrado" });
    }

    const [member] = await db
      .select()
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, draft.communityId),
          eq(communityMembers.userId, req.userId)
        )
      )
      .limit(1);

    if (!member || (member.role !== "owner" && member.role !== "moderator")) {
      return reply.status(403).send({ error: "Não autorizado" });
    }

    // Sanitize user-provided fields before storing — they will be rendered to
    // all community members, so XSS must be stripped even though they come
    // from an owner/moderator (not from AI).
    const safeTitle = sanitizeMarkdown(title);
    const safeSummary = sanitizeMarkdown(summary);

    // Publish
    const [published] = await db
      .update(extractedContents)
      .set({ title: safeTitle, summary: safeSummary, accessLevel, publishedAt: new Date() })
      .where(eq(extractedContents.id, extractedContentId))
      .returning();

    // If premium: create invite_card_impressions for all community members
    if (accessLevel === "premium") {
      const members = await db
        .select()
        .from(communityMembers)
        .where(eq(communityMembers.communityId, draft.communityId));

      if (members.length > 0) {
        await db
          .insert(inviteCardImpressions)
          .values(
            members.map((m) => ({
              extractedContentId,
              memberClerkId: m.userId,
              action: "shown" as const,
            }))
          )
          .onConflictDoNothing();
      }
    }

    return reply.send({ success: true, extractedContent: published });
  });

  // ── PATCH /api/extrair/invite-card/:id ────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    "/invite-card/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = inviteCardSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const [impression] = await db
        .select()
        .from(inviteCardImpressions)
        .where(
          and(
            eq(inviteCardImpressions.extractedContentId, req.params.id),
            eq(inviteCardImpressions.memberClerkId, req.userId)
          )
        )
        .limit(1);

      if (!impression) {
        return reply.status(404).send({ error: "Impressão não encontrada" });
      }

      const [updated] = await db
        .update(inviteCardImpressions)
        .set({ action: parsed.data.action })
        .where(
          and(
            eq(inviteCardImpressions.extractedContentId, req.params.id),
            eq(inviteCardImpressions.memberClerkId, req.userId)
          )
        )
        .returning();

      return reply.send({ success: true, action: updated!.action });
    }
  );

  // ── GET /api/extrair/biblioteca/:communityId ──────────────────────────────
  fastify.get<{ Params: { communityId: string }; Querystring: { level?: string } }>(
    "/biblioteca/:communityId",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { communityId } = req.params;

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
        return reply.status(403).send({ error: "Não é membro desta comunidade" });
      }

      // Filter published_at IS NOT NULL in the DB — avoids fetching all drafts
      // only to discard them in memory, which grows unboundedly with usage.
      const published = await db
        .select()
        .from(extractedContents)
        .where(
          and(
            eq(extractedContents.communityId, communityId),
            isNotNull(extractedContents.publishedAt)
          )
        );

      // If not owner/moderator: only free content visible in full
      const isPremium = member.role === "owner" || member.role === "moderator";

      return published.map((r) => ({
        id: r.id,
        title: r.title,
        summary: isPremium || r.accessLevel === "free"
          ? r.summary
          : r.summary.slice(0, 120) + "…",
        accessLevel: r.accessLevel,
        contentIdeas: isPremium || r.accessLevel === "free" ? r.contentIdeas : [],
        locked: !isPremium && r.accessLevel === "premium",
        topicId: r.topicId,
        createdBy: r.createdBy,
        createdAt: r.createdAt,
        publishedAt: r.publishedAt,
      }));
    }
  );

  // ── GET /api/extrair/invite-cards — cards pendentes para o usuário ─────────
  fastify.get<{ Querystring: { communityId: string } }>(
    "/invite-cards",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { communityId } = req.query;
      if (!communityId) return reply.status(400).send({ error: "communityId required" });

      // Get all impressions for this user that are still 'shown' (not dismissed)
      const impressions = await db
        .select({ imp: inviteCardImpressions, ec: extractedContents })
        .from(inviteCardImpressions)
        .innerJoin(
          extractedContents,
          eq(inviteCardImpressions.extractedContentId, extractedContents.id)
        )
        .where(
          and(
            eq(inviteCardImpressions.memberClerkId, req.userId),
            eq(inviteCardImpressions.action, "shown"),
            eq(extractedContents.communityId, communityId)
          )
        );

      return impressions.map(({ imp, ec }) => ({
        impressionId: imp.id,
        extractedContentId: ec.id,
        title: ec.title,
        summary: ec.summary.slice(0, 120) + (ec.summary.length > 120 ? "…" : ""),
        createdBy: ec.createdBy,
        publishedAt: ec.publishedAt,
      }));
    }
  );
}
