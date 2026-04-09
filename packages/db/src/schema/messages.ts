import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// ─── Shared attachment type ───────────────────────────────────────────────────
export interface Attachment {
  type: "image" | "audio";
  url: string;
  name: string;
  size: number;
  /** Duration in seconds — only present for audio */
  duration?: number;
}
import { relations } from "drizzle-orm";
import { topics } from "./topics.js";
import { klips } from "./klips.js";

// ─── Messages ────────────────────────────────────────────────────────────────
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    /** Clerk user ID */
    authorId: varchar("author_id", { length: 255 }).notNull(),
    content: text("content").notNull(),
    isEdited: boolean("is_edited").notNull().default(false),
    /** JSON array of media attachments (images / audio) */
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Soft delete — preserva contexto de threads mesmo após remoção */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    /** Reply threading */
    replyToId: uuid("reply_to_id"),
    replyToAuthorName: varchar("reply_to_author_name", { length: 255 }),
    replyToContent: text("reply_to_content"),
  },
  (t) => [
    // Composite — query mais frequente: mensagens de um tópico ordenadas por data
    index("messages_topic_created_idx").on(t.topicId, t.createdAt),
    index("messages_author_id_idx").on(t.authorId),
  ]
);

export const messagesRelations = relations(messages, ({ one, many }) => ({
  topic: one(topics, {
    fields: [messages.topicId],
    references: [topics.id],
  }),
  klips: many(klips),
}));
