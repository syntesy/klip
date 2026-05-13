-- Adds community plan (Starter/Pro/Business) and Stripe Connect account ID
-- Required for Stripe integration (Fase 2 do MVP Klips Premium)

-- Enum para plano do criador
CREATE TYPE "community_plan" AS ENUM ('starter', 'pro', 'business');

-- Colunas novas em communities
ALTER TABLE "communities" ADD COLUMN "plan" "community_plan" NOT NULL DEFAULT 'starter';
ALTER TABLE "communities" ADD COLUMN "stripe_account_id" varchar(255);
