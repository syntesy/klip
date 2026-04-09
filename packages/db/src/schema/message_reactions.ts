import { pgTable, uuid, varchar, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { messages } from "./messages.js";

export const messageReactions = pgTable(
  "message_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    clerkUserId: varchar("clerk_user_id", { length: 255 }).notNull(),
    emoji: varchar("emoji", { length: 10 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("message_reactions_unique").on(t.messageId, t.clerkUserId, t.emoji),
    index("message_reactions_message_id_idx").on(t.messageId),
    index("message_reactions_user_id_idx").on(t.clerkUserId),
  ]
);
