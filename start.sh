#!/bin/sh

set -e

echo "Running Prisma migrations..."

cd /app/backend
pnpm exec prisma migrate deploy

echo "Starting backend..."

node dist/main.js &

echo "Starting frontend..."

cd /app/frontend
pnpm start --hostname 0.0.0.0 &

echo "Starting Caddy..."

caddy run --config /etc/caddy/Caddyfile --adapter caddyfile