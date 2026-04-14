-- Create album_status enum
DO $$ BEGIN
  CREATE TYPE "album_status" AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- photo_albums
CREATE TABLE IF NOT EXISTS "photo_albums" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "community_id"    uuid NOT NULL REFERENCES "communities"("id") ON DELETE CASCADE,
  "topic_id"        uuid REFERENCES "topics"("id") ON DELETE SET NULL,
  "created_by"      text NOT NULL,
  "title"           text NOT NULL,
  "description"     text,
  "cover_photo_url" text,
  "is_premium"      boolean NOT NULL DEFAULT false,
  "price"           decimal(10, 2),
  "photo_count"     integer NOT NULL DEFAULT 0,
  "purchase_count"  integer NOT NULL DEFAULT 0,
  "status"          "album_status" NOT NULL DEFAULT 'draft',
  "published_at"    timestamptz,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  "updated_at"      timestamptz NOT NULL DEFAULT now()
);

-- album_photos
CREATE TABLE IF NOT EXISTS "album_photos" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "album_id"      uuid NOT NULL REFERENCES "photo_albums"("id") ON DELETE CASCADE,
  "uploaded_by"   text NOT NULL,
  "storage_url"   text NOT NULL,
  "thumbnail_url" text NOT NULL,
  "blur_url"      text,
  "caption"       text,
  "display_order" integer NOT NULL DEFAULT 0,
  "file_size_kb"  integer,
  "width_px"      integer,
  "height_px"     integer,
  "uploaded_at"   timestamptz NOT NULL DEFAULT now()
);

-- album_purchases
CREATE TABLE IF NOT EXISTS "album_purchases" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"          text NOT NULL,
  "album_id"         uuid NOT NULL REFERENCES "photo_albums"("id"),
  "amount_paid"      decimal(10, 2) NOT NULL,
  "stripe_payment_id" text,
  "purchased_at"     timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_albums_community ON "photo_albums"("community_id", "status", "published_at" DESC);
CREATE INDEX IF NOT EXISTS idx_albums_topic ON "photo_albums"("topic_id") WHERE "topic_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_album_photos_album ON "album_photos"("album_id", "display_order");
CREATE INDEX IF NOT EXISTS idx_album_purchases_user ON "album_purchases"("user_id", "album_id");
CREATE UNIQUE INDEX IF NOT EXISTS idx_album_purchases_unique ON "album_purchases"("user_id", "album_id");
