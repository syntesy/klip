-- Enable pg_trgm for trigram-based full-text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index on messages.content for fast ILIKE '%term%' queries
CREATE INDEX IF NOT EXISTS messages_content_trgm_idx
  ON messages USING GIN (content gin_trgm_ops);
