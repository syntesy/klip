import type { FastifyInstance, FastifyRequest } from "fastify";
import Stripe from "stripe";
import { eq, sql } from "drizzle-orm";
import { db } from "../lib/db.js";
import {
  premiumKlips,
  premiumPurchases,
  creatorPayouts,
  communities,
} from "@klip/db/schema";
import {
  stripe,
  STRIPE_WEBHOOK_SECRET,
  centsToBrl,
} from "../lib/stripe.js";
import { tryEmit } from "../lib/io.js";

type RawReq = FastifyRequest & { rawBody?: Buffer };

export async function stripeWebhookRoutes(fastify: FastifyInstance) {
  // ── POST /api/webhooks/stripe ─────────────────────────────────────────────
  // Recebe eventos do Stripe. Precisa do raw body para verificar a assinatura.
  fastify.post("/stripe", async (req, reply) => {
    const sig = req.headers["stripe-signature"];
    const rawBody = (req as RawReq).rawBody;

    if (!sig || !rawBody) {
      return reply.status(400).send({ error: "Missing signature or body" });
    }
    if (!STRIPE_WEBHOOK_SECRET) {
      fastify.log.error("STRIPE_WEBHOOK_SECRET not configured");
      return reply.status(500).send({ error: "Webhook secret not configured" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig as string,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      fastify.log.warn({ err: msg }, "Stripe webhook signature verification failed");
      return reply.status(400).send({ error: `Webhook error: ${msg}` });
    }

    try {
      switch (event.type) {
        case "checkout.session.completed":
          await handleCheckoutCompleted(
            event.data.object as Stripe.Checkout.Session,
            fastify
          );
          break;
        case "charge.refunded":
          await handleChargeRefunded(event.data.object as Stripe.Charge);
          break;
        case "account.updated": {
          const account = event.data.object as Stripe.Account;
          fastify.log.info(
            {
              accountId: account.id,
              chargesEnabled: account.charges_enabled,
              payoutsEnabled: account.payouts_enabled,
            },
            "Stripe Connect account updated"
          );
          break;
        }
        default:
          fastify.log.debug({ type: event.type }, "Unhandled Stripe event");
      }
    } catch (err) {
      fastify.log.error({ err, type: event.type }, "Error handling Stripe webhook");
      // Still return 200 so Stripe doesn't retry on code bugs — we logged it
    }

    return reply.status(200).send({ received: true });
  });
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  fastify: FastifyInstance
) {
  if (session.payment_status !== "paid") return;

  const premiumKlipId = session.metadata?.premiumKlipId;
  const userId = session.metadata?.userId;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!premiumKlipId || !userId || !paymentIntentId) {
    fastify.log.warn({ session: session.id }, "Checkout session missing metadata");
    return;
  }

  // Idempotência: se esse PaymentIntent já foi processado, não duplica
  const [existing] = await db
    .select({ id: premiumPurchases.id })
    .from(premiumPurchases)
    .where(eq(premiumPurchases.stripePaymentId, paymentIntentId))
    .limit(1);

  if (existing) return;

  const priceCents = Number(session.metadata?.priceCents ?? 0);
  const stripeFeeCents = Number(session.metadata?.stripeFeeCents ?? 0);
  const klipFeeCents = Number(session.metadata?.klipFeeCents ?? 0);
  const creatorNetCents = Number(session.metadata?.creatorNetCents ?? 0);
  const paymentMethod = (session.metadata?.paymentMethod ?? "card") as
    | "pix"
    | "card"
    | "boleto";

  // Insere compra e incrementa contador na mesma transação
  await db.transaction(async (tx) => {
    await tx.insert(premiumPurchases).values({
      userId,
      premiumKlipId,
      amountPaidBrl: centsToBrl(priceCents),
      stripeFeeBrl: centsToBrl(stripeFeeCents),
      klipFeeBrl: centsToBrl(klipFeeCents),
      creatorNetBrl: centsToBrl(creatorNetCents),
      paymentMethod,
      stripePaymentId: paymentIntentId,
    });

    await tx
      .update(premiumKlips)
      .set({ purchaseCount: sql`${premiumKlips.purchaseCount} + 1` })
      .where(eq(premiumKlips.id, premiumKlipId));
  });

  // Registra payout (transfer_data.destination já moveu o dinheiro)
  const [klip] = await db
    .select({ communityId: premiumKlips.communityId })
    .from(premiumKlips)
    .where(eq(premiumKlips.id, premiumKlipId))
    .limit(1);

  if (klip) {
    const [community] = await db
      .select({ ownerId: communities.ownerId })
      .from(communities)
      .where(eq(communities.id, klip.communityId))
      .limit(1);

    if (community) {
      await db.insert(creatorPayouts).values({
        creatorId: community.ownerId,
        amountBrl: centsToBrl(creatorNetCents),
        status: "paid",
        paidAt: new Date(),
      });
    }
  }

  tryEmit(`user:${userId}`, "premium:purchased", { premiumKlipId });
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  await db
    .update(premiumPurchases)
    .set({ refundedAt: new Date() })
    .where(eq(premiumPurchases.stripePaymentId, paymentIntentId));
}
