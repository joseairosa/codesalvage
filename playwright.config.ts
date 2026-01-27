/**
 * Playwright Configuration
 *
 * Configuration for end-to-end testing with Playwright.
 *
 * Features:
 * - Multi-browser testing (Chromium, Firefox, WebKit)
 * - Parallel test execution
 * - Automatic dev server startup
 * - Screenshot and video capture on failure
 * - Accessibility testing integration
 * - Test retries for flaky tests
 *
 * Usage:
 * - npm run test:e2e - Run E2E tests
 * - npm run test:e2e:ui - Open Playwright UI
 * - npm run test:e2e:debug - Debug tests
 */

import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Maximum time one test can run (30 seconds)
  timeout: 30 * 1000,

  // Test match pattern
  testMatch: '**/*.spec.ts',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env['CI'],

  // Retry on CI only
  retries: process.env['CI'] ? 2 : 0,

  // Opt out of parallel tests on CI
  ...(process.env['CI'] ? { workers: 1 } : {}),

  // Reporter to use
  reporter: [
    ['list'], // Console output
    ['html', { outputFolder: 'playwright-report' }], // HTML report
    ['json', { outputFile: 'playwright-report/results.json' }], // JSON for CI
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env['PLAYWRIGHT_TEST_BASE_URL'] || 'http://localhost:3011',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Accept cookies and other consent dialogs
    acceptDownloads: true,

    // Maximum time each action can take
    actionTimeout: 10 * 1000,
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile browsers (optional, commented out by default)
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3011',
    reuseExistingServer: !process.env['CI'],
    timeout: 120 * 1000, // 2 minutes to start
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
