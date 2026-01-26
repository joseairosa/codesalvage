#!/bin/bash
#
# Test Database Setup Script
#
# Starts test database containers and runs migrations.
# Run this before executing tests that require database access.
#

set -e  # Exit on error

echo "🚀 Starting test database containers..."
docker-compose -f docker-compose.test.yml up -d

echo "⏳ Waiting for test database to be ready..."
timeout 30 bash -c 'until docker-compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U projectfinish_test > /dev/null 2>&1; do sleep 1; done' || {
  echo "❌ Test database failed to start within 30 seconds"
  exit 1
}

echo "✅ Test database is ready!"

echo "📦 Running Prisma migrations..."
DATABASE_URL="postgresql://projectfinish_test:password_test@localhost:5445/projectfinish_test" npx prisma migrate deploy

echo "✅ Test database setup complete!"
echo ""
echo "Test database connection: postgresql://projectfinish_test:password_test@localhost:5445/projectfinish_test"
echo "Test Redis connection: redis://localhost:6391"
echo ""
echo "To stop test databases: npm run test:db:stop"
