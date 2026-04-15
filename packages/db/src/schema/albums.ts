import {
  pgTable,
  uuid,
  text,
  boolean,
  decimal,
  integer,
  timestamp,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { communities } from "./communities";
import { topics } from "./topics";

export const albumStatusEnum = pgEnum("album_status", [
  "draft",
  "published",
  "archived",
]);

// ─── photo_albums ─────────────────────────────────────────────────────────────

export const photoAlbums = pgTable(
  "photo_albums",
  {
    id:            uuid("id").primaryKey().defaultRandom(),
    communityId:   uuid("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
    topicId:       uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
    createdBy:     text("created_by").notNull(),
    title:         text("title").notNull(),
    description:   text("description"),
    coverPhotoUrl: text("cover_photo_url"),
    isPremium:     boolean("is_premium").notNull().default(false),
    price:         decimal("price", { precision: 10, scale: 2 }),
    photoCount:    integer("photo_count").notNull().default(0),
    purchaseCount: integer("purchase_count").notNull().default(0),
    status:        albumStatusEnum("status").notNull().default("draft"),
    publishedAt:   timestamp("published_at", { withTimezone: true }),
    createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_albums_community").on(t.communityId, t.status, t.publishedAt),
    index("idx_albums_topic").on(t.topicId),
  ]
);

// ─── album_photos ─────────────────────────────────────────────────────────────

export const albumPhotos = pgTable(
  "album_photos",
  {
    id:           uuid("id").primaryKey().defaultRandom(),
    albumId:      uuid("album_id").notNull().references(() => photoAlbums.id, { onDelete: "cascade" }),
    uploadedBy:   text("uploaded_by").notNull(),
    storageUrl:   text("storage_url").notNull(),
    thumbnailUrl: text("thumbnail_url").notNull(),
    blurUrl:      text("blur_url"),
    caption:      text("caption"),
    displayOrder: integer("display_order").notNull().default(0),
    fileSizeKb:   integer("file_size_kb"),
    widthPx:      integer("width_px"),
    heightPx:     integer("height_px"),
    uploadedAt:   timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_album_photos_album").on(t.albumId, t.displayOrder),
  ]
);

// ─── album_purchases ──────────────────────────────────────────────────────────

export const albumPurchases = pgTable(
  "album_purchases",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    userId:          text("user_id").notNull(),
    albumId:         uuid("album_id").notNull().references(() => photoAlbums.id),
    amountPaid:      decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
    stripePaymentId: text("stripe_payment_id"),
    purchasedAt:     timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_album_purchases_user").on(t.userId, t.albumId),
    uniqueIndex("idx_album_purchases_unique").on(t.userId, t.albumId),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const photoAlbumsRelations = relations(photoAlbums, ({ one, many }) => ({
  community: one(communities, { fields: [photoAlbums.communityId], references: [communities.id] }),
  topic:     one(topics,       { fields: [photoAlbums.topicId],    references: [topics.id] }),
  photos:    many(albumPhotos),
  purchases: many(albumPurchases),
}));

export const albumPhotosRelations = relations(albumPhotos, ({ one }) => ({
  album: one(photoAlbums, { fields: [albumPhotos.albumId], references: [photoAlbums.id] }),
}));

export const albumPurchasesRelations = relations(albumPurchases, ({ one }) => ({
  album: one(photoAlbums, { fields: [albumPurchases.albumId], references: [photoAlbums.id] }),
}));
