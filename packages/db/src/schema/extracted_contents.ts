import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { communities } from "./communities";
import { topics } from "./topics";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const extractInputTypeEnum = pgEnum("extract_input_type", [
  "text",
  "audio",
]);

export const extractAccessLevelEnum = pgEnum("extract_access_level", [
  "free",
  "premium",
]);

// ─── Content idea shape (stored in JSONB) ─────────────────────────────────────

export interface ContentIdea {
  type: "checklist" | "faq" | "insight" | "continuacao";
  title: string;
  description: string;
}

// ─── extracted_contents ───────────────────────────────────────────────────────

export const extractedContents = pgTable(
  "extracted_contents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    /** Clerk user ID of creator */
    createdBy: varchar("created_by", { length: 255 }).notNull(),
    inputType: extractInputTypeEnum("input_type").notNull().default("text"),
    /** Array of source message UUIDs — stored as text[] in Postgres */
    sourceMessageIds: jsonb("source_message_ids")
      .$type<string[]>()
      .default([]),
    audioUrl: varchar("audio_url", { length: 1000 }),
    audioTranscript: text("audio_transcript"),
    title: varchar("title", { length: 300 }).notNull().default(""),
    summary: text("summary").notNull().default(""),
    contentIdeas: jsonb("content_ideas")
      .$type<ContentIdea[]>()
      .notNull()
      .default([]),
    accessLevel: extractAccessLevelEnum("access_level")
      .notNull()
      .default("premium"),
    /** NULL = draft */
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("extracted_contents_community_id_idx").on(t.communityId),
    index("extracted_contents_topic_id_idx").on(t.topicId),
    index("extracted_contents_created_by_idx").on(t.createdBy),
    index("extracted_contents_published_at_idx").on(t.publishedAt),
  ]
);

export const extractedContentsRelations = relations(
  extractedContents,
  ({ one }) => ({
    community: one(communities, {
      fields: [extractedContents.communityId],
      references: [communities.id],
    }),
    topic: one(topics, {
      fields: [extractedContents.topicId],
      references: [topics.id],
    }),
  })
);
