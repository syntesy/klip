-- Notification type enum
DO $$ BEGIN
  CREATE TYPE "notification_type" AS ENUM ('mention', 'decision', 'event', 'voice');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Notifications table
CREATE TABLE IF NOT EXISTS "notifications" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "community_id"        uuid NOT NULL REFERENCES "communities"("id") ON DELETE CASCADE,
  "topic_id"            uuid NOT NULL REFERENCES "topics"("id") ON DELETE CASCADE,
  "message_id"          uuid NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "recipient_clerk_id"  varchar(255) NOT NULL,
  "type"                "notification_type" NOT NULL DEFAULT 'mention',
  "read_at"             timestamptz,
  "created_at"          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "notifications_recipient_idx" ON "notifications" ("recipient_clerk_id");
CREATE INDEX IF NOT EXISTS "notifications_community_idx" ON "notifications" ("community_id");
CREATE INDEX IF NOT EXISTS "notifications_read_at_idx"   ON "notifications" ("read_at");
