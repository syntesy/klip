import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { topics } from "./topics";

// ─── Enum ───────────────────────────────────────────────────────────────────
export const memberRoleEnum = pgEnum("member_role", [
  "owner",
  "moderator",
  "member",
]);

// ─── Communities ────────────────────────────────────────────────────────────
export const communities = pgTable(
  "communities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    description: text("description"),
    /** Clerk user ID of the creator/owner */
    ownerId: varchar("owner_id", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("communities_slug_unique").on(t.slug),
    index("communities_owner_id_idx").on(t.ownerId),
  ]
);

export const communitiesRelations = relations(communities, ({ many }) => ({
  members: many(communityMembers),
  topics: many(topics),
}));

// ─── Community Members ───────────────────────────────────────────────────────
export const communityMembers = pgTable(
  "community_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    /** Clerk user ID */
    userId: varchar("user_id", { length: 255 }).notNull(),
    role: memberRoleEnum("role").notNull().default("member"),
    /** Cached display name from Clerk — used for @mention matching */
    displayName: varchar("display_name", { length: 255 }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("community_members_unique").on(t.communityId, t.userId),
    index("community_members_user_id_idx").on(t.userId),
  ]
);

export const communityMembersRelations = relations(
  communityMembers,
  ({ one }) => ({
    community: one(communities, {
      fields: [communityMembers.communityId],
      references: [communities.id],
    }),
  })
);
