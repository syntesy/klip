ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "reply_to_id" uuid REFERENCES "messages"("id") ON DELETE SET NULL;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "reply_to_author_name" varchar(255);
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "reply_to_content" text;
CREATE INDEX IF NOT EXISTS "messages_reply_to_id_idx" ON "messages" ("reply_to_id");
