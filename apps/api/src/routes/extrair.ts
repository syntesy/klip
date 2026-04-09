import type { FastifyInstance } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../plugins/auth.js";
import { db } from "../lib/db.js";
import {
  messages,
  topics,
  communityMembers,
  extractedContents,
  inviteCardImpressions,
  type ContentIdea,
} from "@klip/db/schema";
import { eq, and, inArray } from "drizzle-orm";
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

    // Fetch messages
    const rows = await db
      .select()
      .from(messages)
      .where(inArray(messages.id, messageIds));

    if (rows.length === 0) {
      return reply.status(404).send({ error: "Mensagens não encontradas" });
    }

    // Fetch topic for context
    const [topic] = await db
      .select()
      .from(topics)
      .where(eq(topics.id, topicId))
      .limit(1);

    const conversation = rows
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((m) => `[${m.authorId}]: ${m.content}`)
      .join("\n");

    // Call Claude
    const aiResponse = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Tópico: "${topic?.title ?? "Conversa"}"

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

    const rawText = aiResponse.content[0];
    if (rawText?.type !== "text") {
      return reply.status(500).send({ error: "Resposta inesperada da IA" });
    }

    let aiResult: AiExtractResult;
    try {
      // Strip possible markdown fences
      const cleaned = rawText.text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      aiResult = JSON.parse(cleaned) as AiExtractResult;
    } catch {
      return reply.status(500).send({ error: "IA retornou JSON inválido" });
    }

    // Save as draft
    const [draft] = await db
      .insert(extractedContents)
      .values({
        communityId,
        topicId,
        createdBy: req.userId,
        inputType: "text",
        sourceMessageIds: messageIds,
        title: aiResult.title_options[0] ?? "",
        summary: aiResult.summary,
        contentIdeas: (aiResult.content_ideas ?? []).slice(0, 4),
        accessLevel: "premium",
      })
      .returning();

    return reply.status(201).send({
      id: draft!.id,
      summary: draft!.summary,
      titleOptions: aiResult.title_options,
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

    // Publish
    const [published] = await db
      .update(extractedContents)
      .set({ title, summary, accessLevel, publishedAt: new Date() })
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

      const rows = await db
        .select()
        .from(extractedContents)
        .where(eq(extractedContents.communityId, communityId));

      // Only published
      const published = rows.filter((r) => r.publishedAt !== null);

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
