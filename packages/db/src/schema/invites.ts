import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { communities } from "./communities.js";

// ─── Invites ─────────────────────────────────────────────────────────────────
export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    /** Short random code used in the invite URL, e.g. "xK9mP2qL" */
    code: varchar("code", { length: 12 }).notNull(),
    /** Community slug used as a human-readable invite URL, e.g. "mentoria-copy" */
    slug: varchar("slug", { length: 100 }),
    /** Clerk user ID of whoever created the invite */
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    /** null = never expires */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** null = unlimited uses */
    maxUses: integer("max_uses"),
    useCount: integer("use_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("invites_code_unique").on(t.code),
    uniqueIndex("invites_slug_unique").on(t.slug),
    index("invites_community_id_idx").on(t.communityId),
  ]
);

export const invitesRelations = relations(invites, ({ one }) => ({
  community: one(communities, {
    fields: [invites.communityId],
    references: [communities.id],
  }),
}));
