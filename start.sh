#!/bin/sh
set -e

echo "Running Prisma migrations..."
cd /app/backend
pnpm exec prisma migrate deploy

echo "Starting backend..."
PORT=3001 node dist/main.js &

echo "Starting frontend..."
cd /app/frontend
PORT=3000 pnpm start --hostname 0.0.0.0 &

echo "Starting Caddy..."
caddy run --config /etc/caddy/Caddyfile --adapter caddyfile