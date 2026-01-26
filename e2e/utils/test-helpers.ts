/**
 * E2E Test Helpers
 *
 * Reusable helper functions for Playwright E2E tests.
 *
 * Responsibilities:
 * - Navigation helpers
 * - Authentication helpers
 * - Form interaction helpers
 * - Assertion helpers
 * - Test data cleanup
 */

import { Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

/**
 * Wait for navigation to complete and page to be fully loaded
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Navigate to a route and wait for it to load
 */
export async function navigateTo(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await waitForPageLoad(page);
}

/**
 * Fill a form field and wait for validation
 */
export async function fillFormField(
  page: Page,
  selector: string,
  value: string
): Promise<void> {
  await page.fill(selector, value);
  // Wait a bit for validation to run
  await page.waitForTimeout(100);
}

/**
 * Click a button and wait for navigation/action to complete
 */
export async function clickAndWait(page: Page, selector: string): Promise<void> {
  await Promise.all([page.waitForLoadState('networkidle'), page.click(selector)]);
}

/**
 * Check if user is on the sign-in page
 */
export async function isOnSignInPage(page: Page): Promise<boolean> {
  const url = page.url();
  return url.includes('/auth/signin');
}

/**
 * Check if user is on the home page
 */
export async function isOnHomePage(page: Page): Promise<boolean> {
  const url = page.url();
  return url === 'http://localhost:3011/' || url === 'http://localhost:3011';
}

/**
 * Verify user is authenticated (user menu visible)
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    // Check if user menu avatar is visible
    const avatar = page.locator('[role="button"] img[alt*="avatar"]').first();
    await avatar.waitFor({ state: 'visible', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Verify user is NOT authenticated (sign-in button visible in nav)
 */
export async function isNotAuthenticated(page: Page): Promise<boolean> {
  try {
    // Look specifically in navigation for the Get Started button
    const nav = page.locator('nav');
    const signInButton = nav.getByRole('link', { name: /get started/i });
    await signInButton.waitFor({ state: 'visible', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get database client for test data cleanup
 * WARNING: Only use in test environment
 */
export function getTestDatabaseClient(): PrismaClient {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      '[Test Helpers] Database client can only be used in test environment'
    );
  }

  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error('[Test Helpers] DATABASE_URL environment variable is required');
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
}

/**
 * Clean up test user data from database
 */
export async function cleanupTestUser(email: string): Promise<void> {
  const prisma = getTestDatabaseClient();

  try {
    // Delete user and all related data (cascade)
    await prisma.user.deleteMany({
      where: { email },
    });

    console.log(`[Test Cleanup] Deleted user: ${email}`);
  } catch (error) {
    console.error('[Test Cleanup] Failed to delete user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Screenshot helper for debugging
 */
export async function takeDebugScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = Date.now();
  await page.screenshot({
    path: `e2e/screenshots/${name}-${timestamp}.png`,
    fullPage: true,
  });
}

/**
 * Check if element is visible
 */
export async function isVisible(page: Page, selector: string): Promise<boolean> {
  try {
    const element = page.locator(selector);
    await element.waitFor({ state: 'visible', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for text to appear on page
 */
export async function waitForText(
  page: Page,
  text: string,
  timeout = 10000
): Promise<void> {
  await page.waitForSelector(`text=${text}`, { timeout });
}

/**
 * Check accessibility with axe-core
 *
 * TODO: Implement once axe-core integration is needed
 * @see https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright
 */
export async function checkAccessibility(_page: Page): Promise<void> {
  // Placeholder for accessibility checking
  // Will be implemented when needed for accessibility audit
  console.log('[Test Helpers] Accessibility check not yet implemented');
}

/**
 * Mock GitHub OAuth response for testing
 * Note: This requires configuring test OAuth app or using mock server
 */
export async function mockGitHubAuth(
  _page: Page,
  userData: {
    id: string;
    email: string;
    login: string;
    name: string;
    avatar_url: string;
  }
): Promise<void> {
  // This would typically intercept the OAuth callback
  // For now, this is a placeholder for when we implement OAuth mocking
  console.log('[Test Helpers] Mock GitHub auth not yet implemented');
  console.log('[Test Helpers] User data:', userData);
}
