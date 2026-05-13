import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is required");
}

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  typescript: true,
});

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

// ─── Commission helpers ─────────────────────────────────────────────────────
// All money calculations use integer cents to avoid float errors.

export type CommunityPlan = "starter" | "pro" | "business";

const COMMISSION_BY_PLAN: Record<CommunityPlan, number> = {
  starter: 0.08,
  pro: 0.05,
  business: 0.02,
};

/** Stripe Brazil fee: R$0.40 fixed + 3.99% of amount */
const STRIPE_FIXED_FEE_CENTS = 40;
const STRIPE_PERCENT_FEE = 0.0399;

export interface FeeBreakdown {
  priceCents: number;
  stripeFeeCents: number;
  klipFeeCents: number;
  creatorNetCents: number;
}

/**
 * Calculate the fee breakdown for a sale.
 *
 * @param priceBrl - Price in BRL (e.g. 49.90)
 * @param plan - Creator's plan (determines Klip commission)
 * @returns Breakdown in integer cents (no floats)
 */
export function calculateFees(priceBrl: number, plan: CommunityPlan): FeeBreakdown {
  const priceCents = Math.round(priceBrl * 100);
  const stripeFeeCents = STRIPE_FIXED_FEE_CENTS + Math.round(priceCents * STRIPE_PERCENT_FEE);
  const klipFeeCents = Math.round(priceCents * COMMISSION_BY_PLAN[plan]);
  const creatorNetCents = priceCents - stripeFeeCents - klipFeeCents;
  return { priceCents, stripeFeeCents, klipFeeCents, creatorNetCents };
}

/** Convert cents (integer) to BRL decimal string (e.g. 4501 → "45.01"). */
export function centsToBrl(cents: number): string {
  return (cents / 100).toFixed(2);
}
