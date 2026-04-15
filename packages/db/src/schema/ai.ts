import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { topics } from "./topics";

// ─── AI Summaries ─────────────────────────────────────────────────────────────
export const aiSummaries = pgTable(
  "ai_summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    /** Clerk user ID — who requested the summary */
    requestedBy: varchar("requested_by", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ai_summaries_topic_id_idx").on(t.topicId),
    index("ai_summaries_created_at_idx").on(t.createdAt),
  ]
);

export const aiSummariesRelations = relations(aiSummaries, ({ one }) => ({
  topic: one(topics, {
    fields: [aiSummaries.topicId],
    references: [topics.id],
  }),
}));
