-- 0011: Add missing indexes and unique constraint
-- 1. Unique constraint on notifications to back onConflictDoNothing()
-- 2. Index on voice_sessions for active-session lookup

-- Notifications: prevent duplicate mention/event notifications per recipient+message+type
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_recipient_message_type_unique"
  ON "notifications" ("recipient_clerk_id", "message_id", "type");

-- Voice sessions: covers WHERE topic_id = ? AND status = 'active'
CREATE INDEX IF NOT EXISTS "voice_sessions_topic_status_idx"
  ON "voice_sessions" ("topic_id", "status");
