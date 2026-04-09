import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { extractedContents } from "./extracted_contents.js";

// ─── Enum ────────────────────────────────────────────────────────────────────

export const inviteCardActionEnum = pgEnum("invite_card_action", [
  "shown",
  "clicked_yes",
  "clicked_no",
]);

// ─── invite_card_impressions ──────────────────────────────────────────────────

export const inviteCardImpressions = pgTable(
  "invite_card_impressions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    extractedContentId: uuid("extracted_content_id")
      .notNull()
      .references(() => extractedContents.id, { onDelete: "cascade" }),
    /** Clerk user ID of the member who saw the card */
    memberClerkId: varchar("member_clerk_id", { length: 255 }).notNull(),
    action: inviteCardActionEnum("action").notNull().default("shown"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("invite_card_impressions_unique").on(
      t.extractedContentId,
      t.memberClerkId
    ),
    index("invite_card_impressions_member_idx").on(t.memberClerkId),
  ]
);

export const inviteCardImpressionsRelations = relations(
  inviteCardImpressions,
  ({ one }) => ({
    extractedContent: one(extractedContents, {
      fields: [inviteCardImpressions.extractedContentId],
      references: [extractedContents.id],
    }),
  })
);
