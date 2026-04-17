ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "is_decision" boolean NOT NULL DEFAULT false;
