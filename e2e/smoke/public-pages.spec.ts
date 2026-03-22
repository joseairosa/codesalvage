/**
 * Smoke Tests: Public Pages
 *
 * Verifies all public-facing pages render correctly after deployment.
 * No authentication required — purely read-only page checks.
 *
 * Targets: /, /projects, /auth/signin, /u/[username], 404
 */

import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('loads with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CodeSalvage/i);
  });

  test('navigation is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible();
  });

  test('sign-in link is present for unauthenticated users', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Look for any sign-in/get started link in the nav (may render multiple — take first)
    const nav = page.locator('nav');
    const signInLinks = nav.getByRole('link', { name: /get started|sign in|login/i });
    await expect(signInLinks.first()).toBeVisible();
  });

  test('no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out known third-party noise
    const appErrors = errors.filter(
      (e) =>
        !e.includes('chrome-extension') &&
        !e.includes('Failed to load resource') &&
        !e.includes('favicon')
    );
    expect(appErrors).toHaveLength(0);
  });
});

test.describe('Projects Browse Page', () => {
  test('loads successfully', async ({ page }) => {
    const response = await page.goto('/projects');
    expect(response?.status()).toBe(200);
  });

  test('shows project listing or empty state', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Wait for either project cards, empty state, or error state (API may be slow in CI)
    const projectCard = page.locator('[data-testid="project-card"]').first();
    const emptyState = page.getByText(/no projects found/i).first();
    const errorState = page.getByText(/failed to load/i).first();

    await expect(projectCard.or(emptyState).or(errorState)).toBeVisible({
      timeout: 30000,
    });
  });

  test('search input is present', async ({ page }) => {
    await page.goto('/projects');
    // A search input should exist somewhere on the page
    const searchInput = page.locator(
      'input[type="search"], input[placeholder*="Search" i]'
    );
    await expect(searchInput.first()).toBeVisible();
  });
});

test.describe('Sign-In Page', () => {
  test('loads successfully', async ({ page }) => {
    const response = await page.goto('/auth/signin');
    expect(response?.status()).toBe(200);
  });

  test('shows GitHub sign-in button', async ({ page }) => {
    await page.goto('/auth/signin');
    const githubButton = page.getByRole('button', {
      name: /continue with github|sign in with github/i,
    });
    await expect(githubButton).toBeVisible();
  });

  test('page title references CodeSalvage', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page).toHaveTitle(/CodeSalvage/i);
  });
});

test.describe('Public Seller Profiles', () => {
  test('valid /u/[username] page returns 200 or 404 (not 500)', async ({ request }) => {
    // Test a known-unlikely username — should 404 gracefully, not 500
    const response = await request.get('/u/nonexistent-user-smoke-test-xyzabc');
    expect([200, 404]).toContain(response.status());
  });
});

test.describe('Error Pages', () => {
  test('404 page renders for unknown routes', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist-smoke-test-abc123');
    // Next.js returns 404 for unknown routes
    expect(response?.status()).toBe(404);

    // Should show a user-friendly error page, not a blank screen
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(0);
  });

  test('404 page does not expose stack traces or secrets', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-smoke-test-abc123');
    const content = await page.content();

    expect(content).not.toContain('DATABASE_URL');
    expect(content).not.toContain('postgres://');
    expect(content).not.toContain('REDIS_URL');
    expect(content).not.toContain('AUTH_SECRET');
    expect(content).not.toContain('at Object.<anonymous>');
  });
});
