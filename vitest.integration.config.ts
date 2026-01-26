/**
 * Vitest Configuration - Integration Tests
 *
 * Configuration for integration tests that require test database.
 *
 * Usage:
 * - npm run test:integration - Run integration tests
 * - npm run test:integration:watch - Watch mode
 *
 * Prerequisites:
 * - Test database must be running: npm run test:db:setup
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node', // Use node environment for database tests

    // Global test setup
    globals: true,
    setupFiles: ['./tests/setup.ts'],

    // Server options - handle external dependencies
    server: {
      deps: {
        inline: ['@sendgrid/mail'],
      },
    },

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.{ts,js}',
        '**/*.d.ts',
        '**/types/',
        '.next/',
        'coverage/',
        'prisma/migrations/',
        'prisma/seed.ts',
      ],
    },

    // Test file patterns - ONLY integration tests
    include: ['**/integration/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'coverage', 'e2e'],

    // Reporter
    reporters: ['verbose'],

    // Longer timeout for database operations
    testTimeout: 30000,

    // Run integration tests sequentially (avoid database conflicts)
    maxConcurrency: 1,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },

  // Path aliases (must match tsconfig.json)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
