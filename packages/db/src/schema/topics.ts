import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { communities } from "./communities.js";
import { aiSummaries } from "./ai.js";

// ─── Enum ─────────────────────────────────────────────────────────────────────
export const topicStatusEnum = pgEnum("topic_status", [
  "active",
  "resolved",
  "closed",
]);

// ─── Topics ─────────────────────────────────────────────────────────────────
export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    /** Clerk user ID */
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    isPinned: boolean("is_pinned").notNull().default(false),
    /** active = discussão aberta | resolved = concluído | closed = arquivado */
    status: topicStatusEnum("status").notNull().default("active"),
    pinnedMessageId: uuid("pinned_message_id"),
    pinnedMessageContent: text("pinned_message_content"),
    pinnedMessageAuthor: varchar("pinned_message_author", { length: 255 }),
    messageCount: integer("message_count").notNull().default(0),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Composite — cobre o query do sidebar inteiro com um único index scan
    index("topics_community_status_activity_idx").on(t.communityId, t.status, t.lastActivityAt),
  ]
);

export const topicsRelations = relations(topics, ({ one, many }) => ({
  community: one(communities, {
    fields: [topics.communityId],
    references: [communities.id],
  }),
  summaries: many(aiSummaries),
}));
