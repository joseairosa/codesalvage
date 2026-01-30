/**
 * Example E2E Test
 *
 * This test verifies that Playwright is configured correctly
 * and can access the application.
 *
 * Test Coverage:
 * - Homepage loads successfully
 * - Navigation is visible
 * - Basic page structure exists
 *
 * This file can be deleted once real E2E tests are written.
 */

import { test, expect } from '@playwright/test';
import { navigateTo, waitForPageLoad, isNotAuthenticated } from './utils/test-helpers';

test.describe('Playwright Setup Verification', () => {
  test('should load the homepage', async ({ page }) => {
    // Navigate to homepage
    await navigateTo(page, '/');

    // Verify page title
    await expect(page).toHaveTitle(/CodeSalvage/i);

    // Verify navigation is visible
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('should show sign-in option for unauthenticated users', async ({ page }) => {
    // Navigate to homepage
    await navigateTo(page, '/');

    // Verify user is not authenticated
    const notAuth = await isNotAuthenticated(page);
    expect(notAuth).toBe(true);

    // Verify sign-in button exists in navigation
    const nav = page.locator('nav');
    const signInButton = nav.getByRole('link', { name: /get started/i });
    await expect(signInButton).toBeVisible();
  });

  test('should navigate to sign-in page', async ({ page }) => {
    // Navigate to homepage
    await navigateTo(page, '/');

    // Click sign-in button in navigation and wait for navigation
    const nav = page.locator('nav');
    const signInButton = nav.getByRole('link', { name: /get started/i });

    await Promise.all([page.waitForURL('**/auth/signin'), signInButton.click()]);

    // Verify we're on sign-in page
    expect(page.url()).toContain('/auth/signin');

    // Verify GitHub sign-in button exists
    const githubButton = page.getByRole('button', { name: /continue with github/i });
    await expect(githubButton).toBeVisible();
  });

  test('should have accessible navigation', async ({ page }) => {
    // Navigate to homepage
    await navigateTo(page, '/');

    // Verify navigation has proper ARIA roles
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Verify links are accessible
    const links = nav.locator('a');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    // Verify each link has accessible text
    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      const text = await link.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });

  test('should be responsive', async ({ page }) => {
    // Test desktop viewport (default 1280x720)
    await navigateTo(page, '/');
    let nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await waitForPageLoad(page);

    // Navigation should still be visible (mobile menu)
    nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });
});
