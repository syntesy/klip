ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "pinned_message_id" uuid REFERENCES "messages"("id") ON DELETE SET NULL;
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "pinned_message_content" text;
ALTER TABLE "topics" ADD COLUMN IF NOT EXISTS "pinned_message_author" varchar(255);
