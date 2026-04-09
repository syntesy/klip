# Klip — Architecture

## Monorepo structure

```
KLIP/
├── apps/
│   ├── web/          # Next.js 14 — frontend + SSR
│   └── api/          # Fastify — REST API + Socket.io
└── packages/
    └── db/           # Drizzle ORM schema + migrations
```

## Stack decisions

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) | SSR nativo, file-based routing, integração direta com Clerk |
| Styling | Tailwind CSS | Utility-first, zero runtime, paleta de cores centralizada no config |
| Backend | Fastify | 2x mais rápido que Express, TypeScript-first, schema validation integrado |
| ORM | Drizzle ORM | Type-safe SQL sem abstração mágica, migrations determinísticas |
| Auth | Clerk | Auth completo (OAuth, email, magic link) sem infra própria |
| Real-time | Socket.io | WebSockets com fallback automático, rooms por tópico |
| IA | Anthropic claude-sonnet-4-5 | Resumos de conversas de alta qualidade |
| Monorepo | pnpm workspaces + Turborepo | Cache de builds, shared packages, scripts unificados |

## Data model

```
communities (id, name, slug, description, owner_id)
    └── community_members (community_id, user_id, role: owner|moderator|member)
    └── topics (id, community_id, title, description, is_pinned, is_archived, message_count, last_activity_at)
            └── messages (id, topic_id, author_id, content, is_edited)
            │       └── klips (id, user_id, message_id, note)  ← biblioteca pessoal
            └── ai_summaries (id, topic_id, content, requested_by)  ← gerado sob demanda
```

## Auth strategy

- **Frontend**: Clerk `<ClerkProvider>` + `middleware.ts` protege todas as rotas `/communities/*`, `/klips/*`
- **API**: Cada request enviado com `Authorization: Bearer <clerk_jwt>`. O Fastify verifica via `@clerk/backend` em `requireAuth` hook.
- **WebSocket**: Token enviado no `socket.handshake.auth.token`, verificado no middleware do Socket.io antes de aceitar a conexão.
- **Usuários no banco**: Não armazenamos dados de usuário — apenas `clerk_user_id` (varchar) nas tabelas. Dados do perfil são lidos via Clerk API quando necessário.

## Real-time flow

```
Client → HTTP POST /api/messages  →  persist to DB  →  return message
Client → socket.emit("message:send")  →  broadcast to topic room  →  other clients update UI
```

Mensagens persistidas via HTTP, transmitidas via WebSocket. Sem duplicação de lógica.

## Environment variables

Ver `.env.example` na raiz. Cada app tem acesso às variáveis via `.env` na raiz (Railway/Vercel injetam automaticamente).

## Running locally

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env
cp .env.example .env
# Fill in DATABASE_URL, REDIS_URL, CLERK keys, ANTHROPIC_API_KEY

# 3. Run DB migrations
pnpm db:migrate

# 4. Start all apps
pnpm dev
```
