#!/bin/bash
#
# Test Database Teardown Script
#
# Stops and removes test database containers.
# Run this after tests are complete to clean up.
#

echo "🛑 Stopping test database containers..."
docker-compose -f docker-compose.test.yml down -v

echo "✅ Test databases stopped and cleaned up!"
