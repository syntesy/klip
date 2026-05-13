import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { db } from "../lib/db.js";
import { tryEmit } from "../lib/io.js";
import {
  premiumKlips,
  premiumPurchases,
  communities,
  communityMembers,
} from "@klip/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { stripe, calculateFees } from "../lib/stripe.js";

const WEB_URL = process.env.WEB_URL ?? "http://localhost:3002";

const createPremiumKlipSchema = z.object({
  communityId: z.string().uuid(),
  klipId: z.string().uuid().nullish(),
  title: z.string().min(1).max(80),
  /** Preço em BRL (ex: 49.90). Mínimo R$1,00 para atender Stripe. */
  priceBrl: z.coerce.number().min(1).max(999),
  contentType: z.enum(["video", "audio", "document", "text"]),
  contentUrl: z.string().url().max(2000).nullish(),
  contentBody: z.string().max(50_000).nullish(),
  description: z.string().max(2000).nullish(),
  thumbnailUrl: z.string().url().max(2000).nullish(),
  durationSeconds: z.number().int().positive().nullish(),
  tags: z.array(z.string().max(40)).max(10).nullish(),
  status: z.enum(["draft", "published"]).default("draft"),
});

export async function premiumRoutes(fastify: FastifyInstance) {
  // ── GET /api/premium/:communityId ──────────────────────────────────────────
  // Lista klips premium publicados da comunidade + quais já foram comprados
  fastify.get<{ Params: { communityId: string } }>(
    "/:communityId",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { communityId } = req.params;

      const [member] = await db
        .select({ role: communityMembers.role })
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

      const klipList = await db
        .select()
        .from(premiumKlips)
        .where(
          and(
            eq(premiumKlips.communityId, communityId),
            eq(premiumKlips.status, "published")
          )
        )
        .orderBy(premiumKlips.createdAt);

      const klipIds = klipList.map((k) => k.id);

      const purchases =
        klipIds.length > 0
          ? await db
              .select({ premiumKlipId: premiumPurchases.premiumKlipId })
              .from(premiumPurchases)
              .where(
                and(
                  eq(premiumPurchases.userId, req.userId),
                  inArray(premiumPurchases.premiumKlipId, klipIds)
                )
              )
          : [];

      const purchasedIds = purchases.map((p) => p.premiumKlipId);

      return { klips: klipList, purchasedIds };
    }
  );

  // ── POST /api/premium/klip ─────────────────────────────────────────────────
  // Owner/moderator cria klip premium (draft ou published)
  fastify.post("/klip", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = createPremiumKlipSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const data = parsed.data;

    const [member] = await db
      .select({ role: communityMembers.role })
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, data.communityId),
          eq(communityMembers.userId, req.userId)
        )
      )
      .limit(1);

    if (!member || (member.role !== "owner" && member.role !== "moderator")) {
      return reply
        .status(403)
        .send({ error: "Apenas donos e moderadores podem criar klips premium" });
    }

    let created: typeof premiumKlips.$inferSelect;
    try {
      const [row] = await db
        .insert(premiumKlips)
        .values({
          communityId: data.communityId,
          klipId: data.klipId ?? null,
          title: data.title,
          description: data.description ?? null,
          contentType: data.contentType,
          contentUrl: data.contentUrl ?? null,
          contentBody: data.contentBody ?? null,
          thumbnailUrl: data.thumbnailUrl ?? null,
          priceBrl: data.priceBrl.toFixed(2),
          durationSeconds: data.durationSeconds ?? null,
          tags: data.tags ?? null,
          status: data.status,
          publishedAt: data.status === "published" ? new Date() : null,
          createdBy: req.userId,
        })
        .returning();
      if (!row) throw new Error("Insert returned no rows");
      created = row;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Database error";
      return reply
        .status(500)
        .send({ error: `Falha ao criar klip premium: ${msg}` });
    }

    // Notifica membros se já publicado
    if (created.status === "published") {
      const memberRows = await db
        .select({ userId: communityMembers.userId })
        .from(communityMembers)
        .where(eq(communityMembers.communityId, data.communityId));

      for (const m of memberRows) {
        tryEmit(`user:${m.userId}`, "premium:new", {
          title: created.title,
          price: Math.round(Number(created.priceBrl) * 100),
          communityId: data.communityId,
          premiumKlipId: created.id,
        });
      }
    }

    return reply.status(201).send(created);
  });

  // ── POST /api/premium/:premiumKlipId/checkout ──────────────────────────────
  // Cria Stripe Checkout Session. O usuário é redirecionado ao session.url.
  // O registro da compra só acontece no webhook checkout.session.completed.
  fastify.post<{ Params: { premiumKlipId: string } }>(
    "/:premiumKlipId/checkout",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { premiumKlipId } = req.params;

      const [klip] = await db
        .select()
        .from(premiumKlips)
        .where(
          and(
            eq(premiumKlips.id, premiumKlipId),
            eq(premiumKlips.status, "published")
          )
        )
        .limit(1);

      if (!klip) {
        return reply.status(404).send({ error: "Premium klip not found" });
      }

      const [community] = await db
        .select({
          plan: communities.plan,
          stripeAccountId: communities.stripeAccountId,
          name: communities.name,
        })
        .from(communities)
        .where(eq(communities.id, klip.communityId))
        .limit(1);

      if (!community) {
        return reply.status(404).send({ error: "Community not found" });
      }

      if (!community.stripeAccountId) {
        return reply.status(400).send({
          error:
            "Este criador ainda não conectou uma conta Stripe para receber pagamentos",
        });
      }

      const [member] = await db
        .select({ role: communityMembers.role })
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, klip.communityId),
            eq(communityMembers.userId, req.userId)
          )
        )
        .limit(1);

      if (!member) {
        return reply.status(403).send({ error: "Not a member of this community" });
      }

      const [existing] = await db
        .select({ id: premiumPurchases.id })
        .from(premiumPurchases)
        .where(
          and(
            eq(premiumPurchases.userId, req.userId),
            eq(premiumPurchases.premiumKlipId, premiumKlipId)
          )
        )
        .limit(1);

      if (existing) {
        return reply.status(400).send({ error: "Você já possui este conteúdo" });
      }

      const fees = calculateFees(Number(klip.priceBrl), community.plan);
      // O platform fica com klipFee depois que o Stripe debita stripeFee dele.
      // Por isso application_fee_amount = klipFee + stripeFee.
      const applicationFeeAmount = fees.klipFeeCents + fees.stripeFeeCents;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: {
                name: klip.title,
                ...(klip.description ? { description: klip.description } : {}),
              },
              unit_amount: fees.priceCents,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: applicationFeeAmount,
          transfer_data: {
            destination: community.stripeAccountId,
          },
          metadata: {
            premiumKlipId,
            userId: req.userId,
          },
        },
        metadata: {
          premiumKlipId,
          userId: req.userId,
          priceCents: String(fees.priceCents),
          stripeFeeCents: String(fees.stripeFeeCents),
          klipFeeCents: String(fees.klipFeeCents),
          creatorNetCents: String(fees.creatorNetCents),
          paymentMethod: "card",
        },
        success_url: `${WEB_URL}/premium/success?sessionId={CHECKOUT_SESSION_ID}`,
        cancel_url: `${WEB_URL}/premium/cancel?communityId=${klip.communityId}`,
      });

      return { url: session.url, sessionId: session.id };
    }
  );

  // ── GET /api/premium/:premiumKlipId/access ─────────────────────────────────
  // Retorna se o usuário tem acesso + dados do klip (URL só se comprou)
  fastify.get<{ Params: { premiumKlipId: string } }>(
    "/:premiumKlipId/access",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { premiumKlipId } = req.params;

      const [klip] = await db
        .select()
        .from(premiumKlips)
        .where(eq(premiumKlips.id, premiumKlipId))
        .limit(1);

      if (!klip) {
        return reply.status(404).send({ error: "Not found" });
      }

      const [member] = await db
        .select({ role: communityMembers.role })
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, klip.communityId),
            eq(communityMembers.userId, req.userId)
          )
        )
        .limit(1);

      if (!member) {
        return reply.status(403).send({ error: "Not a member" });
      }

      const [purchase] = await db
        .select({ id: premiumPurchases.id })
        .from(premiumPurchases)
        .where(
          and(
            eq(premiumPurchases.userId, req.userId),
            eq(premiumPurchases.premiumKlipId, premiumKlipId)
          )
        )
        .limit(1);

      const hasAccess = Boolean(purchase);

      return {
        hasAccess,
        klip: hasAccess
          ? klip
          : {
              ...klip,
              contentUrl: null,
              contentBody: null,
            },
      };
    }
  );
}
