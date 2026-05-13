# ⚠️ AVISO — Drift de snapshot pendente

## Estado atual (pós-Sprint D · 13/05/2026)

O snapshot meta/0016_snapshot.json NÃO reflete o estado real do banco
após a migration 0016_premium_klips_v2.sql. O schema TypeScript de
premiumKlips.ts foi alterado no commit 9b82769 sem regeneração de
snapshot.

## Consequência

Rodar `pnpm db:generate` vai produzir migrations "fantasma" que tentam
recriar payment_method, creator_payouts e outros tipos/tabelas que já
existem no banco. Aplicar essas migrations em produção FALHA com
`type already exists`.

## Não rode db:generate até resolver o drift

A migration 0018_cleanup_orphan_code.sql foi escrita manualmente e
intencionalmente NÃO TEM snapshot correspondente. É segura para produção
porque usa apenas DROP IF EXISTS / ALTER ... DROP COLUMN IF EXISTS.

## Como resolver (Sprint E futura)

1. Reconstruir 0016_snapshot.json do estado real pós-aplicação da 0016
2. Validar com `pnpm db:generate` que NÃO gera migration nova
3. Gerar retroativamente o 0018_snapshot.json
4. Documentar processo de geração de snapshot pra próximas migrations

## Bloqueio operacional

Até a Sprint E ser concluída:
- NÃO use `pnpm db:generate`
- Migrations novas devem ser escritas manualmente (como a 0018)
- Schema TypeScript NÃO deve ser alterado sem coordenar com o Marcel
