FROM node:22-alpine AS backend-build

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@11.15.1 --activate

WORKDIR /app/backend

COPY backend/package.json backend/pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY backend/ ./

RUN pnpm exec prisma generate
RUN pnpm build


FROM node:22-alpine AS frontend-build

RUN corepack enable pnpm

WORKDIR /app/frontend

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./

RUN pnpm build


FROM node:22-alpine AS production

RUN apk add --no-cache libc6-compat curl

RUN corepack enable pnpm

WORKDIR /app

# Caddy
RUN apk add --no-cache caddy

# Backend
COPY --from=backend-build /app/backend /app/backend

# Frontend
COPY --from=frontend-build /app/frontend /app/frontend

# Caddy
COPY Caddyfile /etc/caddy/Caddyfile

# Startup
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 10000

CMD ["/start.sh"]