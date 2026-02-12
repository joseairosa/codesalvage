#!/bin/sh
set -x

echo "[start.sh] Running database migrations..."
MAX_RETRIES=5
RETRY_DELAY=5
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if npx prisma migrate deploy; then
    echo "[start.sh] Migrations applied successfully."
    break
  else
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
      echo "[start.sh] Migration attempt $RETRY_COUNT/$MAX_RETRIES failed. Retrying in ${RETRY_DELAY}s..."
      sleep $RETRY_DELAY
    else
      echo "[start.sh] WARNING: All $MAX_RETRIES migration attempts failed. Starting app anyway."
    fi
  fi
done

echo "[start.sh] Migrations complete. Starting application..."
echo "[start.sh] Working directory: $(pwd)"
echo "[start.sh] server.js exists: $(ls -la server.js 2>&1 || echo 'NOT FOUND')"

# Log server-side env var presence (not values) for debugging
echo "[start.sh] Env check:"
echo "  FIREBASE_PROJECT_ID: $(if [ -n "$FIREBASE_PROJECT_ID" ]; then echo 'SET'; else echo 'MISSING'; fi)"
echo "  FIREBASE_SERVICE_ACCOUNT_BASE64: $(if [ -n "$FIREBASE_SERVICE_ACCOUNT_BASE64" ]; then echo "SET (${#FIREBASE_SERVICE_ACCOUNT_BASE64} chars)"; else echo 'MISSING'; fi)"
echo "  DATABASE_URL: $(if [ -n "$DATABASE_URL" ]; then echo 'SET'; else echo 'MISSING'; fi)"

exec node server.js
