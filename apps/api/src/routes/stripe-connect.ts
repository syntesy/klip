import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { db } from "../lib/db.js";
import { communities, communityMembers } from "@klip/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { stripe } from "../lib/stripe.js";

const onboardSchema = z.object({
  communityId: z.string().uuid(),
});

const WEB_URL = process.env.WEB_URL ?? "http://localhost:3002";

async function requireOwner(userId: string, communityId: string) {
  const [member] = await db
    .select({ role: communityMembers.role })
    .from(communityMembers)
    .where(
      and(
        eq(communityMembers.communityId, communityId),
        eq(communityMembers.userId, userId)
      )
    )
    .limit(1);
  return member?.role === "owner";
}

export async function stripeConnectRoutes(fastify: FastifyInstance) {
  // ── POST /api/stripe-connect/onboard ──────────────────────────────────────
  // Cria (ou reutiliza) a conta Stripe Connect Express do criador e devolve
  // o account link para completar o onboarding (KYC + bank account br).
  fastify.post(
    "/onboard",
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = onboardSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      const { communityId } = parsed.data;

      if (!(await requireOwner(req.userId, communityId))) {
        return reply
          .status(403)
          .send({ error: "Apenas o dono da comunidade pode conectar o Stripe" });
      }

      const [community] = await db
        .select()
        .from(communities)
        .where(eq(communities.id, communityId))
        .limit(1);

      if (!community) {
        return reply.status(404).send({ error: "Community not found" });
      }

      let accountId = community.stripeAccountId;

      if (!accountId) {
        const account = await stripe.accounts.create({
          type: "express",
          country: "BR",
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: "individual",
          metadata: {
            communityId,
            ownerId: req.userId,
          },
        });
        accountId = account.id;

        await db
          .update(communities)
          .set({ stripeAccountId: accountId })
          .where(eq(communities.id, communityId));
      }

      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${WEB_URL}/premium/connect/refresh?communityId=${communityId}`,
        return_url: `${WEB_URL}/premium/connect/return?communityId=${communityId}`,
        type: "account_onboarding",
      });

      return { url: link.url, accountId };
    }
  );

  // ── GET /api/stripe-connect/status/:communityId ───────────────────────────
  // Retorna estado atual do onboarding Stripe Connect do criador.
  fastify.get<{ Params: { communityId: string } }>(
    "/status/:communityId",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { communityId } = req.params;

      if (!(await requireOwner(req.userId, communityId))) {
        return reply
          .status(403)
          .send({ error: "Apenas o dono da comunidade pode consultar" });
      }

      const [community] = await db
        .select()
        .from(communities)
        .where(eq(communities.id, communityId))
        .limit(1);

      if (!community) {
        return reply.status(404).send({ error: "Community not found" });
      }

      if (!community.stripeAccountId) {
        return {
          connected: false,
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false,
        };
      }

      const account = await stripe.accounts.retrieve(community.stripeAccountId);

      return {
        connected: true,
        accountId: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        requirements: account.requirements?.currently_due ?? [],
      };
    }
  );

  // ── POST /api/stripe-connect/refresh ──────────────────────────────────────
  // Regenera o account link caso o anterior tenha expirado.
  fastify.post(
    "/refresh",
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = onboardSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      const { communityId } = parsed.data;

      if (!(await requireOwner(req.userId, communityId))) {
        return reply
          .status(403)
          .send({ error: "Apenas o dono da comunidade pode conectar o Stripe" });
      }

      const [community] = await db
        .select()
        .from(communities)
        .where(eq(communities.id, communityId))
        .limit(1);

      if (!community?.stripeAccountId) {
        return reply
          .status(400)
          .send({ error: "Nenhuma conta Stripe iniciada para esta comunidade" });
      }

      const link = await stripe.accountLinks.create({
        account: community.stripeAccountId,
        refresh_url: `${WEB_URL}/premium/connect/refresh?communityId=${communityId}`,
        return_url: `${WEB_URL}/premium/connect/return?communityId=${communityId}`,
        type: "account_onboarding",
      });

      return { url: link.url };
    }
  );
}
