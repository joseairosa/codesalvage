/**
 * Vitest Configuration - API E2E Smoke Tests
 *
 * Runs authenticated API flow tests against the locally running app.
 * NOT included in CI — run on demand to verify a full environment.
 *
 * Prerequisites:
 *   npm run docker:dev   (app must be running on port 3011)
 *
 * Usage:
 *   npm run test:e2e:api
 *   E2E_BASE_URL=https://codesalvage.com npm run test:e2e:api
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/e2e/setup.ts'],

    include: ['tests/e2e/**/*.e2e.ts'],
    exclude: ['node_modules', '.next', 'coverage'],

    // Longer timeout — tests make real HTTP calls
    testTimeout: 60000,
    hookTimeout: 30000,

    // Run suites sequentially to avoid DB conflicts
    maxConcurrency: 1,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },

    reporters: ['verbose'],
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
