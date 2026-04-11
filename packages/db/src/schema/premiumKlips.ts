import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { communities } from "./communities.js";
import { klips } from "./klips.js";

// ─── Enums ─────────────────────────────────────────────────────────────────────

export const premiumContentTypeEnum = pgEnum("premium_content_type", [
  "video",
  "audio",
  "document",
  "image",
  "text",
]);

// ─── Premium Klips ─────────────────────────────────────────────────────────────

export const premiumKlips = pgTable(
  "premium_klips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    klipId: uuid("klip_id").references(() => klips.id, { onDelete: "set null" }),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    /** Price in cents (990 = R$9,90) */
    price: integer("price").notNull(),
    contentType: premiumContentTypeEnum("content_type").notNull(),
    /** Supabase Storage URL — null until content is uploaded */
    contentUrl: varchar("content_url", { length: 500 }),
    /** Teaser shown to non-buyers — no spoilers */
    previewText: text("preview_text"),
    purchaseCount: integer("purchase_count").notNull().default(0),
    /** Clerk user ID of creator */
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [
    index("premium_klips_community_idx").on(t.communityId),
    index("premium_klips_created_by_idx").on(t.createdBy),
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
}));

// ─── Premium Purchases ─────────────────────────────────────────────────────────

export const premiumPurchases = pgTable(
  "premium_purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Clerk user ID */
    userId: varchar("user_id", { length: 255 }).notNull(),
    premiumKlipId: uuid("premium_klip_id")
      .notNull()
      .references(() => premiumKlips.id, { onDelete: "cascade" }),
    /** Amount paid in cents */
    amountPaid: integer("amount_paid").notNull(),
    /** Stripe payment intent ID — 'sim_test' for simulated purchases */
    stripePaymentId: varchar("stripe_payment_id", { length: 255 }),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("premium_purchases_user_klip_unique").on(t.userId, t.premiumKlipId),
    index("premium_purchases_user_idx").on(t.userId),
    index("premium_purchases_klip_idx").on(t.premiumKlipId),
  ]
);

export const premiumPurchasesRelations = relations(premiumPurchases, ({ one }) => ({
  premiumKlip: one(premiumKlips, {
    fields: [premiumPurchases.premiumKlipId],
    references: [premiumKlips.id],
  }),
}));
