-- Enums
DO $$ BEGIN
  CREATE TYPE "extract_input_type" AS ENUM ('text', 'audio');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "extract_access_level" AS ENUM ('free', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "invite_card_action" AS ENUM ('shown', 'clicked_yes', 'clicked_no');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- extracted_contents
CREATE TABLE IF NOT EXISTS "extracted_contents" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "community_id"        uuid NOT NULL REFERENCES "communities"("id") ON DELETE CASCADE,
  "topic_id"            uuid NOT NULL REFERENCES "topics"("id") ON DELETE CASCADE,
  "created_by"          varchar(255) NOT NULL,
  "input_type"          "extract_input_type" NOT NULL DEFAULT 'text',
  "source_message_ids"  jsonb DEFAULT '[]',
  "audio_url"           varchar(1000),
  "audio_transcript"    text,
  "title"               varchar(300) NOT NULL DEFAULT '',
  "summary"             text NOT NULL DEFAULT '',
  "content_ideas"       jsonb NOT NULL DEFAULT '[]',
  "access_level"        "extract_access_level" NOT NULL DEFAULT 'premium',
  "published_at"        timestamptz,
  "created_at"          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "extracted_contents_community_id_idx" ON "extracted_contents" ("community_id");
CREATE INDEX IF NOT EXISTS "extracted_contents_topic_id_idx"     ON "extracted_contents" ("topic_id");
CREATE INDEX IF NOT EXISTS "extracted_contents_created_by_idx"   ON "extracted_contents" ("created_by");
CREATE INDEX IF NOT EXISTS "extracted_contents_published_at_idx" ON "extracted_contents" ("published_at");

-- invite_card_impressions
CREATE TABLE IF NOT EXISTS "invite_card_impressions" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "extracted_content_id"  uuid NOT NULL REFERENCES "extracted_contents"("id") ON DELETE CASCADE,
  "member_clerk_id"       varchar(255) NOT NULL,
  "action"                "invite_card_action" NOT NULL DEFAULT 'shown',
  "created_at"            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "invite_card_impressions_unique" ON "invite_card_impressions" ("extracted_content_id", "member_clerk_id");
CREATE INDEX IF NOT EXISTS "invite_card_impressions_member_idx"   ON "invite_card_impressions" ("member_clerk_id");
