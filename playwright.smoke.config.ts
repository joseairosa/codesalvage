/**
 * Playwright Smoke Test Configuration
 *
 * Targets a live deployed URL (Railway production or staging).
 * No local webServer — tests run against a real deployment.
 *
 * Usage:
 *   SMOKE_TEST_URL=https://codesalvage.com npm run test:smoke
 *
 * In CI, SMOKE_TEST_URL is provided as a GitHub Actions secret.
 */

import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env['SMOKE_TEST_URL'] || 'https://codesalvage.com';

export default defineConfig({
  testDir: './e2e/smoke',
  testMatch: '**/*.spec.ts',

  // Short timeout — smoke tests should be fast
  timeout: 30 * 1000,
  expect: { timeout: 10 * 1000 },

  // Run in parallel — smoke tests are read-only so safe to parallelize
  fullyParallel: true,

  // Fail build if test.only was accidentally left in
  forbidOnly: !!process.env['CI'],

  // Retry on network flakiness (live deployments can have transient errors)
  retries: process.env['CI'] ? 2 : 1,

  // Spread pattern avoids `workers: undefined` which fails exactOptionalPropertyTypes
  ...(process.env['CI'] ? { workers: 2 } : {}),

  reporter: [
    ['list'],
    ['html', { outputFolder: 'smoke-report', open: 'never' }],
    ['json', { outputFile: 'smoke-report/results.json' }],
  ],

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10 * 1000,
    viewport: { width: 1280, height: 720 },
  },

  // Chromium only — smoke tests are fast, cross-browser is for full E2E
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
