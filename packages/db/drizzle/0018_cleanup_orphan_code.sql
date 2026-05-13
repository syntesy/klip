-- Sprint D · Limpeza de código órfão (PRD v2.3)
-- Remove Albums (não está no PRD v2.3), isDecision (D28),
-- extracted_contents + invite_card_impressions (legado M11)
--
-- Estratégia de ordem:
--   1. Tabelas filhas antes das pais (evita violação de FK sem DROP CASCADE)
--   2. Enums após as tabelas que os usavam
--   3. ALTER TABLE messages ao final (não tem dependentes)
--
-- Todos os DROP usam IF EXISTS para idempotência.

-- =============================================================================
-- 1. ALBUMS — sistema paralelo de monetização substituído por Klips Premium
-- =============================================================================

-- Filhas primeiro (album_photos e album_purchases referenciam photo_albums)
DROP TABLE IF EXISTS "album_photos";
DROP TABLE IF EXISTS "album_purchases";
DROP TABLE IF EXISTS "photo_albums";

-- Enum de album_status (só usado em photo_albums)
DROP TYPE IF EXISTS "album_status";

-- =============================================================================
-- 2. EXTRACTED CONTENTS + INVITE CARD IMPRESSIONS — legado M11
-- =============================================================================

-- Filha primeiro (invite_card_impressions referencia extracted_contents via ON DELETE CASCADE)
DROP TABLE IF EXISTS "invite_card_impressions";
DROP TABLE IF EXISTS "extracted_contents";

-- Enums usados apenas por essas tabelas
DROP TYPE IF EXISTS "invite_card_action";
DROP TYPE IF EXISTS "extract_access_level";
DROP TYPE IF EXISTS "extract_input_type";

-- =============================================================================
-- 3. isDecision — campo legado da feature Decisão (D28 retirou Decisão do MVP)
-- =============================================================================

ALTER TABLE "messages" DROP COLUMN IF EXISTS "is_decision";
