FROM node:22-alpine AS base

RUN apk add --no-cache libc6-compat

RUN corepack enable pnpm

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm config set strict-dep-builds false
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm exec prisma generate
RUN mkdir -p /generated-prisma && \
    cp -R node_modules/.pnpm/@prisma+client@*/node_modules/.prisma /generated-prisma/

FROM base AS development
EXPOSE 3001
CMD ["pnpm", "start:dev"]

FROM base AS build
RUN pnpm build

FROM node:22-alpine AS production
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable pnpm


RUN pnpm config set strict-dep-builds false
RUN pnpm install --prod --frozen-lockfile

COPY --from=build /app/dist ./dist
COPY --from=build /generated-prisma/.prisma /generated-prisma/.prisma
RUN cp -R /generated-prisma/.prisma node_modules/.pnpm/@prisma+client@*/node_modules/ && \
    rm -rf /generated-prisma
EXPOSE 3001
CMD ["node", "dist/main"]
