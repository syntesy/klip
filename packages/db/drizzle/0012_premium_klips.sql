-- 0012: Área Premium — premium_klips e premium_purchases

DO $$ BEGIN
  CREATE TYPE "premium_content_type" AS ENUM ('video', 'audio', 'document', 'image', 'text');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "premium_klips" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "klip_id"        uuid REFERENCES "klips"("id") ON DELETE SET NULL,
  "community_id"   uuid NOT NULL REFERENCES "communities"("id") ON DELETE CASCADE,
  "title"          varchar(200) NOT NULL,
  "price"          integer NOT NULL,
  "content_type"   "premium_content_type" NOT NULL,
  "content_url"    varchar(500),
  "preview_text"   text,
  "purchase_count" integer NOT NULL DEFAULT 0,
  "created_by"     varchar(255) NOT NULL,
  "created_at"     timestamptz NOT NULL DEFAULT now(),
  "is_active"      boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS "premium_klips_community_idx" ON "premium_klips" ("community_id");
CREATE INDEX IF NOT EXISTS "premium_klips_created_by_idx" ON "premium_klips" ("created_by");

CREATE TABLE IF NOT EXISTS "premium_purchases" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"           varchar(255) NOT NULL,
  "premium_klip_id"   uuid NOT NULL REFERENCES "premium_klips"("id") ON DELETE CASCADE,
  "amount_paid"       integer NOT NULL,
  "stripe_payment_id" varchar(255),
  "purchased_at"      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "premium_purchases_user_klip_unique"
  ON "premium_purchases" ("user_id", "premium_klip_id");
CREATE INDEX IF NOT EXISTS "premium_purchases_user_idx"  ON "premium_purchases" ("user_id");
CREATE INDEX IF NOT EXISTS "premium_purchases_klip_idx"  ON "premium_purchases" ("premium_klip_id");
