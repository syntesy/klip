import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { messages } from "./messages.js";

// ─── Klips (personal library) ─────────────────────────────────────────────────
export const klips = pgTable(
  "klips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Clerk user ID — who saved this klip */
    userId: varchar("user_id", { length: 255 }).notNull(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    /** Optional personal annotation */
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("klips_user_message_unique").on(t.userId, t.messageId),
    index("klips_user_id_idx").on(t.userId),
  ]
);

export const klipsRelations = relations(klips, ({ one }) => ({
  message: one(messages, {
    fields: [klips.messageId],
    references: [messages.id],
  }),
}));
