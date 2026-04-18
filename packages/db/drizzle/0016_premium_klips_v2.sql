-- Custom migration: Drop old premium tables and recreate with full PRD 10.5.10 schema
-- Tables were already empty (0 rows) — approved for DROP + recreate

-- ─── Drop old tables and enum ─────────────────────────────────────────────────
DROP TABLE IF EXISTS "premium_purchases" CASCADE;
DROP TABLE IF EXISTS "premium_klips" CASCADE;
DROP TYPE IF EXISTS "premium_content_type" CASCADE;

-- ─── Create new enums ─────────────────────────────────────────────────────────
CREATE TYPE "premium_content_type" AS ENUM ('video', 'audio', 'document', 'text');
CREATE TYPE "premium_klip_status" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "payment_method" AS ENUM ('pix', 'card', 'boleto');
CREATE TYPE "payout_status" AS ENUM ('pending', 'paid', 'failed');

-- ─── 1. premium_klips ─────────────────────────────────────────────────────────
CREATE TABLE "premium_klips" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "klip_id" uuid REFERENCES "klips"("id") ON DELETE SET NULL,
  "community_id" uuid NOT NULL REFERENCES "communities"("id") ON DELETE CASCADE,
  "title" varchar(80) NOT NULL,
  "description" text,
  "content_type" "premium_content_type" NOT NULL,
  "content_url" text,
  "content_body" text,
  "thumbnail_url" text,
  "price_brl" decimal(10, 2) NOT NULL,
  "duration_seconds" integer,
  "purchase_count" integer NOT NULL DEFAULT 0,
  "status" "premium_klip_status" NOT NULL DEFAULT 'draft',
  "tags" text[],
  "created_by" varchar(255) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "published_at" timestamp with time zone,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- ─── 2. premium_purchases ─────────────────────────────────────────────────────
CREATE TABLE "premium_purchases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "premium_klip_id" uuid NOT NULL REFERENCES "premium_klips"("id") ON DELETE CASCADE,
  "amount_paid_brl" decimal(10, 2) NOT NULL,
  "stripe_payment_id" varchar(255) NOT NULL UNIQUE,
  "payment_method" "payment_method" NOT NULL,
  "creator_net_brl" decimal(10, 2) NOT NULL,
  "klip_fee_brl" decimal(10, 2) NOT NULL,
  "stripe_fee_brl" decimal(10, 2) NOT NULL,
  "purchased_at" timestamp with time zone NOT NULL DEFAULT now(),
  "refunded_at" timestamp with time zone
);

-- ─── 3. user_billing_info ─────────────────────────────────────────────────────
CREATE TABLE "user_billing_info" (
  "user_id" varchar(255) PRIMARY KEY,
  "full_name" varchar(255) NOT NULL,
  "cpf" varchar(14) NOT NULL,
  "phone" varchar(20),
  "zipcode" varchar(9) NOT NULL,
  "address" text NOT NULL,
  "state" varchar(2) NOT NULL,
  "stripe_customer_id" varchar(255) UNIQUE,
  "is_complete" boolean NOT NULL DEFAULT false,
  "completed_at" timestamp with time zone
);

-- ─── 4. premium_consumption ───────────────────────────────────────────────────
CREATE TABLE "premium_consumption" (
  "user_id" varchar(255) NOT NULL,
  "premium_klip_id" uuid NOT NULL REFERENCES "premium_klips"("id") ON DELETE CASCADE,
  "last_position" integer,
  "completion_pct" decimal(5, 2),
  "last_accessed_at" timestamp with time zone,
  PRIMARY KEY ("user_id", "premium_klip_id")
);

-- ─── 5. creator_payouts ──────────────────────────────────────────────────────
CREATE TABLE "creator_payouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "creator_id" varchar(255) NOT NULL,
  "amount_brl" decimal(10, 2) NOT NULL,
  "purchase_ids" uuid[],
  "stripe_payout_id" varchar(255),
  "status" "payout_status" NOT NULL DEFAULT 'pending',
  "paid_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- ─── Indexes (PRD 10.5.10 mandatory) ─────────────────────────────────────────
CREATE INDEX "idx_premium_klips_community_status" ON "premium_klips" ("community_id", "status");
CREATE INDEX "idx_premium_klips_created_by" ON "premium_klips" ("created_by");
CREATE INDEX "idx_premium_purchases_user" ON "premium_purchases" ("user_id");
CREATE INDEX "idx_premium_purchases_klip" ON "premium_purchases" ("premium_klip_id");
CREATE INDEX "idx_premium_consumption_user" ON "premium_consumption" ("user_id");
CREATE INDEX "idx_creator_payouts_creator" ON "creator_payouts" ("creator_id");
