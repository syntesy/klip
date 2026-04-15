import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { messages } from "./messages";

// ─── Saved Messages (personal library) ────────────────────────────────────────
// Users manually save messages to their personal library (Pro/Business plan only).
// Distinct from `klips` which are AI-curated saves.

export const savedMessages = pgTable(
  "saved_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Clerk user ID — who saved this message */
    clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("saved_messages_user_message_unique").on(t.clerkUserId, t.messageId),
    index("saved_messages_user_idx").on(t.clerkUserId),
    index("saved_messages_message_idx").on(t.messageId),
  ]
);

export const savedMessagesRelations = relations(savedMessages, ({ one }) => ({
  message: one(messages, {
    fields: [savedMessages.messageId],
    references: [messages.id],
  }),
}));
