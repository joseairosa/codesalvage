#!/bin/sh
set -ex

echo "[start.sh] Running database migrations..."
npx prisma migrate deploy

echo "[start.sh] Migrations complete. Starting application..."
echo "[start.sh] Working directory: $(pwd)"
echo "[start.sh] server.js exists: $(ls -la server.js 2>&1 || echo 'NOT FOUND')"

exec node server.js
