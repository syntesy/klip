# CLAUDE.md — Project Instructions

## Language

Always respond in Brazilian Portuguese (pt-BR).

## Database Schema Rules

This project uses Drizzle ORM with PostgreSQL. Schema files live in `packages/db/src/schema/*.ts`.

### MANDATORY: After ANY schema change

Whenever you add, remove, or modify columns/tables/indexes in any schema file:

1. Run `pnpm db:generate` from the project root
2. Verify new migration SQL was created in `packages/db/drizzle/`
3. Verify the snapshot was updated in `packages/db/drizzle/meta/`
4. Include ALL generated files (SQL + snapshot + journal) in the same commit as the schema change

Never commit a schema change without the corresponding migration files. The CI will block it.

### Migration safety

- Never manually edit migration SQL files unless making them idempotent (e.g., `IF NOT EXISTS`)
- Never delete or reorder entries in `packages/db/drizzle/meta/_journal.json`
- Never delete snapshot files from `packages/db/drizzle/meta/`
- The API start script runs `drizzle-kit migrate` automatically on deploy

## Project Structure

- `apps/web` — Next.js frontend
- `apps/api` — Fastify API backend
- `packages/db` — Drizzle ORM schema, migrations, and database client

## Stack

- pnpm workspaces + Turborepo
- Next.js (web), Fastify (api), Drizzle ORM (db)
- PostgreSQL on Railway
- Clerk for authentication
- Socket.IO for real-time
