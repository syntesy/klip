ALTER TABLE "invites" ADD COLUMN IF NOT EXISTS "slug" varchar(100);
CREATE UNIQUE INDEX IF NOT EXISTS "invites_slug_unique" ON "invites" ("slug");
