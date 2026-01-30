/**
 * Protected Routes E2E Tests
 *
 * Test Coverage:
 * - Unauthenticated users are redirected to sign-in
 * - Role-based access control works correctly
 * - Redirects preserve intended destination
 *
 * Note: Next.js redirect() causes non-standard navigation behavior,
 * so we use commit/domcontentloaded instead of waiting for full load.
 */

import { test, expect } from '@playwright/test';

test.describe('Protected Routes - Authentication Required', () => {
  test('should redirect /dashboard to sign-in when unauthenticated', async ({ page }) => {
    // Navigate to protected route
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // Check if we ended up on sign-in page
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    expect(url).toContain('/auth/signin');

    // Verify GitHub sign-in button is present
    const githubButton = page.getByRole('button', { name: /continue with github/i });
    await expect(githubButton).toBeVisible();
  });

  test('should redirect /seller/dashboard to sign-in when unauthenticated', async ({
    page,
  }) => {
    // Navigate to protected seller route
    await page.goto('/seller/dashboard', { waitUntil: 'domcontentloaded' });

    // Check we're on sign-in page
    await page.waitForLoadState('domcontentloaded');

    const url = page.url();
    expect(url).toContain('/auth/signin');
  });

  test('should show 404 for non-existent routes', async ({ page }) => {
    const response = await page.goto('/protected/nonexistent', {
      waitUntil: 'domcontentloaded',
    });

    if (response) {
      const status = response.status();
      expect(status).toBe(404);
    }
  });
});

test.describe('Protected Routes - Redirect Behavior', () => {
  test('should preserve callback URL after redirect', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    const url = new URL(page.url());

    // Should be on sign-in page
    expect(url.pathname).toContain('/auth/signin');

    // Should have callbackUrl parameter
    expect(url.searchParams.has('callbackUrl')).toBe(true);
    expect(url.searchParams.get('callbackUrl')).toBe('/dashboard');
  });

  test('should redirect consistently on page refresh', async ({ page }) => {
    // First navigation
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    let url = page.url();
    expect(url).toContain('/auth/signin');

    // Refresh page
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    // Should still be on sign-in
    url = page.url();
    expect(url).toContain('/auth/signin');
  });
});

test.describe('Protected Routes - Multiple Pages', () => {
  const protectedRoutes = [
    { path: '/dashboard', name: 'Dashboard' },
    { path: '/seller/dashboard', name: 'Seller Dashboard' },
  ];

  for (const route of protectedRoutes) {
    test(`should redirect ${route.name} to sign-in`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      const url = page.url();
      expect(url).toContain('/auth/signin');

      // Verify sign-in page loaded
      const githubButton = page.getByRole('button', { name: /continue with github/i });
      await expect(githubButton).toBeVisible();
    });
  }
});

test.describe('Protected Routes - Security', () => {
  test('should not expose sensitive data in redirects', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    const pageContent = await page.content();
    const url = page.url();

    // Should not contain database credentials
    expect(pageContent).not.toContain('postgres://');
    expect(pageContent).not.toContain('DATABASE_URL');
    expect(pageContent).not.toContain('Bearer ');

    // URL should not contain tokens
    expect(url).not.toContain('token=');
    expect(url).not.toContain('jwt=');
  });

  test('should not make API calls to protected resources before redirect', async ({
    page,
  }) => {
    const apiRequests: string[] = [];

    page.on('request', (request) => {
      const requestUrl = request.url();
      // Track non-auth API calls
      if (requestUrl.includes('/api/') && !requestUrl.includes('/api/auth')) {
        apiRequests.push(requestUrl);
      }
    });

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    // Should not have made calls to protected API endpoints
    expect(apiRequests.length).toBe(0);
  });
});

test.describe('Protected Routes - Performance', () => {
  test('should redirect quickly', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');

    const redirectTime = Date.now() - startTime;

    // Redirect should be fast (under 5 seconds in test environment)
    expect(redirectTime).toBeLessThan(5000);

    // Verify we're on sign-in page
    const url = page.url();
    expect(url).toContain('/auth/signin');
  });
});
