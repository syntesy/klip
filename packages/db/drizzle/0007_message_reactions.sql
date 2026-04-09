CREATE TABLE IF NOT EXISTS "message_reactions" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "message_id"      uuid NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "clerk_user_id"   varchar(255) NOT NULL,
  "emoji"           varchar(10) NOT NULL,
  "created_at"      timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("message_id", "clerk_user_id", "emoji")
);

CREATE INDEX IF NOT EXISTS "message_reactions_message_id_idx" ON "message_reactions" ("message_id");
CREATE INDEX IF NOT EXISTS "message_reactions_user_id_idx"    ON "message_reactions" ("clerk_user_id");
