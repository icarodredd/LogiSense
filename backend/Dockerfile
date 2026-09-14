FROM node:22-alpine AS base

RUN apk add --no-cache libc6-compat

RUN corepack enable pnpm

WORKDIR /app
COPY package.json pnpm-lock.yaml ./

RUN pnpm config set strict-dep-builds false
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm exec prisma generate

FROM base AS development
EXPOSE 3001
CMD ["pnpm", "start:dev"]

FROM base AS build
RUN pnpm build

FROM node:22-alpine AS production
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm


RUN pnpm config set strict-dep-builds false
RUN pnpm install --prod --frozen-lockfile

COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/main"]
