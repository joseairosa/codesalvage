/**
 * Vitest Configuration
 *
 * Configuration for unit and integration testing with Vitest.
 *
 * Features:
 * - TypeScript support with path aliases
 * - React Testing Library integration
 * - JSDOM environment for browser APIs
 * - Code coverage reporting
 * - Global test utilities
 *
 * Usage:
 * - npm run test - Run tests in watch mode
 * - npm run test:ci - Run tests once (CI)
 * - npm run test:coverage - Run with coverage report
 * - npm run test:ui - Open Vitest UI
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    // Test environment
    environment: 'jsdom',

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
        // App pages and API routes (tested via integration/E2E, not unit tests)
        'app/**',
        // UI components (tested via E2E, not unit tests)
        'components/**',
        // Auth infrastructure (tests to be added)
        'lib/firebase.ts',
        'lib/firebase-admin.ts',
        'lib/firebase-auth.ts',
        'lib/api-auth.ts',
        'lib/hooks/**',
        'lib/auth-helpers.ts',
        'middleware.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },

    // Test file patterns
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'node_modules',
      '.next',
      'coverage',
      'e2e',
      '**/integration/**', // Exclude integration tests from default runs (require test DB)
    ],

    // Reporter
    reporters: ['verbose'],

    // Timeout
    testTimeout: 10000,
  },

  // Path aliases (must match tsconfig.json)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
