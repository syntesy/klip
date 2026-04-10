FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace manifests first — better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/

RUN pnpm install --frozen-lockfile

# Copy source after deps to preserve cache
COPY apps/api ./apps/api
COPY packages/db ./packages/db

# Build: tsup bundles everything (incl. @klip/db) into dist/index.js
RUN pnpm --filter @klip/api build

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
