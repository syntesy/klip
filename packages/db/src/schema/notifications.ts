import { pgTable, uuid, varchar, timestamp, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
import { communities } from "./communities";
import { topics } from "./topics";
import { messages } from "./messages";

export const notificationTypeEnum = pgEnum("notification_type", [
  "mention",
  "decision",
  "event",
  "voice",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    communityId: uuid("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    recipientClerkId: varchar("recipient_clerk_id", { length: 255 }).notNull(),
    type: notificationTypeEnum("type").notNull().default("mention"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Prevents duplicate notifications for the same mention/event on a message
    uniqueIndex("notifications_recipient_message_type_unique").on(t.recipientClerkId, t.messageId, t.type),
    index("notifications_recipient_idx").on(t.recipientClerkId),
    index("notifications_community_idx").on(t.communityId),
    index("notifications_read_at_idx").on(t.readAt),
  ]
);
