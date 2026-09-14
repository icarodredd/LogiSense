# O Prisma Client é gerado no estágio base (válido para dev e build).
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@12 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm exec prisma generate

FROM base AS development
EXPOSE 3001
CMD ["pnpm", "start:dev"]

FROM base AS build
RUN pnpm build

FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@12 --activate \
  && pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/main"]
