#!/bin/sh
set -ex

echo "[start.sh] Running database migrations..."
npx prisma migrate deploy

echo "[start.sh] Migrations complete. Starting application..."
echo "[start.sh] Working directory: $(pwd)"
echo "[start.sh] server.js exists: $(ls -la server.js 2>&1 || echo 'NOT FOUND')"

# Log server-side env var presence (not values) for debugging
echo "[start.sh] Env check:"
echo "  FIREBASE_PROJECT_ID: $(if [ -n "$FIREBASE_PROJECT_ID" ]; then echo 'SET'; else echo 'MISSING'; fi)"
echo "  FIREBASE_SERVICE_ACCOUNT_BASE64: $(if [ -n "$FIREBASE_SERVICE_ACCOUNT_BASE64" ]; then echo "SET (${#FIREBASE_SERVICE_ACCOUNT_BASE64} chars)"; else echo 'MISSING'; fi)"
echo "  DATABASE_URL: $(if [ -n "$DATABASE_URL" ]; then echo 'SET'; else echo 'MISSING'; fi)"

exec node server.js
