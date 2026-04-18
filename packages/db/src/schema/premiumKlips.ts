import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  timestamp,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { communities } from "./communities";
import { klips } from "./klips";

// ─── Enums ─────────────────────────────────────────────────────────────────────

export const premiumContentTypeEnum = pgEnum("premium_content_type", [
  "video",
  "audio",
  "document",
  "text",
]);

export const premiumKlipStatusEnum = pgEnum("premium_klip_status", [
  "draft",
  "published",
  "archived",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "pix",
  "card",
  "boleto",
]);

export const payoutStatusEnum = pgEnum("payout_status", [
  "pending",
  "paid",
  "failed",
]);

// ─── 1. Premium Klips ─────────────────────────────────────────────────────────

export const premiumKlips = pgTable(
  "premium_klips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    klipId: uuid("klip_id").references(() => klips.id, { onDelete: "set null" }),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 80 }).notNull(),
    description: text("description"),
    contentType: premiumContentTypeEnum("content_type").notNull(),
    /** Mux asset URL / S3 URL — null for type='text' */
    contentUrl: text("content_url"),
    /** Rich text body — used only when content_type='text' */
    contentBody: text("content_body"),
    thumbnailUrl: text("thumbnail_url"),
    /** Price in BRL (e.g. 49.90) */
    priceBrl: decimal("price_brl", { precision: 10, scale: 2 }).notNull(),
    /** Duration in seconds — null for document/text */
    durationSeconds: integer("duration_seconds"),
    /** Denormalized purchase counter for performance */
    purchaseCount: integer("purchase_count").notNull().default(0),
    status: premiumKlipStatusEnum("status").notNull().default("draft"),
    tags: text("tags").array(),
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_premium_klips_community_status").on(t.communityId, t.status),
    index("idx_premium_klips_created_by").on(t.createdBy),
  ]
);

export const premiumKlipsRelations = relations(premiumKlips, ({ one, many }) => ({
  community: one(communities, {
    fields: [premiumKlips.communityId],
    references: [communities.id],
  }),
  klip: one(klips, {
    fields: [premiumKlips.klipId],
    references: [klips.id],
  }),
  purchases: many(premiumPurchases),
  consumption: many(premiumConsumption),
}));

// ─── 2. Premium Purchases ─────────────────────────────────────────────────────

export const premiumPurchases = pgTable(
  "premium_purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    premiumKlipId: uuid("premium_klip_id")
      .notNull()
      .references(() => premiumKlips.id, { onDelete: "cascade" }),
    amountPaidBrl: decimal("amount_paid_brl", { precision: 10, scale: 2 }).notNull(),
    stripePaymentId: varchar("stripe_payment_id", { length: 255 }).notNull().unique(),
    paymentMethod: paymentMethodEnum("payment_method").notNull(),
    creatorNetBrl: decimal("creator_net_brl", { precision: 10, scale: 2 }).notNull(),
    klipFeeBrl: decimal("klip_fee_brl", { precision: 10, scale: 2 }).notNull(),
    stripeFeeBrl: decimal("stripe_fee_brl", { precision: 10, scale: 2 }).notNull(),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_premium_purchases_user").on(t.userId),
    index("idx_premium_purchases_klip").on(t.premiumKlipId),
  ]
);

export const premiumPurchasesRelations = relations(premiumPurchases, ({ one }) => ({
  premiumKlip: one(premiumKlips, {
    fields: [premiumPurchases.premiumKlipId],
    references: [premiumKlips.id],
  }),
}));

// ─── 3. User Billing Info (Progressive Registration Level 2) ──────────────────

export const userBillingInfo = pgTable("user_billing_info", {
  userId: varchar("user_id", { length: 255 }).primaryKey(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  cpf: varchar("cpf", { length: 14 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  zipcode: varchar("zipcode", { length: 9 }).notNull(),
  address: text("address").notNull(),
  state: varchar("state", { length: 2 }).notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).unique(),
  isComplete: boolean("is_complete").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ─── 4. Premium Consumption (progress tracking) ──────────────────────────────

export const premiumConsumption = pgTable(
  "premium_consumption",
  {
    userId: varchar("user_id", { length: 255 }).notNull(),
    premiumKlipId: uuid("premium_klip_id")
      .notNull()
      .references(() => premiumKlips.id, { onDelete: "cascade" }),
    /** Seconds for video/audio, percentage for PDF/text */
    lastPosition: integer("last_position"),
    completionPct: decimal("completion_pct", { precision: 5, scale: 2 }),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.premiumKlipId] }),
    index("idx_premium_consumption_user").on(t.userId),
  ]
);

export const premiumConsumptionRelations = relations(premiumConsumption, ({ one }) => ({
  premiumKlip: one(premiumKlips, {
    fields: [premiumConsumption.premiumKlipId],
    references: [premiumKlips.id],
  }),
}));

// ─── 5. Creator Payouts (Stripe Connect) ──────────────────────────────────────

export const creatorPayouts = pgTable(
  "creator_payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    creatorId: varchar("creator_id", { length: 255 }).notNull(),
    amountBrl: decimal("amount_brl", { precision: 10, scale: 2 }).notNull(),
    /** IDs of purchases included in this payout */
    purchaseIds: uuid("purchase_ids").array(),
    stripePayoutId: varchar("stripe_payout_id", { length: 255 }),
    status: payoutStatusEnum("status").notNull().default("pending"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_creator_payouts_creator").on(t.creatorId),
  ]
);
