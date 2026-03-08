/**
 * Smoke Tests: Security
 *
 * Verifies security posture of the live deployment:
 * - Security headers are present
 * - Protected routes redirect (not crash)
 * - No secrets leaked in responses
 * - HTTPS enforcement
 */

import { test, expect } from '@playwright/test';

test.describe('Security Headers', () => {
  test('homepage has X-Content-Type-Options header', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();
    expect(headers['x-content-type-options']).toBe('nosniff');
  });

  test('homepage has X-Frame-Options header', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();
    // Should be DENY or SAMEORIGIN
    expect(['DENY', 'SAMEORIGIN']).toContain(headers['x-frame-options']);
  });

  test('homepage has X-XSS-Protection header', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();
    expect(headers['x-xss-protection']).toBeDefined();
  });

  test('API responses have correct content-type', async ({ request }) => {
    const response = await request.get('/api/ping');
    expect(response.headers()['content-type']).toContain('application/json');
  });
});

test.describe('Protected Route Redirects', () => {
  // Only routes covered by middleware.ts matcher:
  // '/dashboard/:path*', '/seller/:path*', '/buyer/:path*', '/admin/:path*'
  // Routes like /messages and /projects/new are client-side protected only.
  const protectedRoutes = [
    '/dashboard',
    '/seller/dashboard',
    '/seller/analytics',
    '/buyer/dashboard',
  ];

  for (const route of protectedRoutes) {
    test(`${route} redirects unauthenticated users to sign-in`, async ({ page }) => {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');

      const url = page.url();
      // Must end up on auth page, not on the protected page or an error page
      expect(url).toContain('/auth/signin');
    });
  }
});

test.describe('No Secret Leakage', () => {
  test('homepage does not expose environment secrets', async ({ page }) => {
    await page.goto('/');
    const content = await page.content();

    expect(content).not.toContain('DATABASE_URL');
    expect(content).not.toContain('postgres://');
    expect(content).not.toContain('REDIS_URL');
    expect(content).not.toContain('AUTH_SECRET');
    expect(content).not.toContain('STRIPE_SECRET_KEY');
    expect(content).not.toContain('sk_live_');
    expect(content).not.toContain('sk_test_');
    expect(content).not.toContain('FIREBASE_SERVICE_ACCOUNT');
    expect(content).not.toContain('whsec_');
  });

  test('API error responses do not expose stack traces', async ({ request }) => {
    // Hit a protected endpoint without auth — should return clean 401
    const response = await request.get('/api/analytics/overview');
    const text = await response.text();

    expect(text).not.toContain('at Object.<anonymous>');
    expect(text).not.toContain('node_modules');
    expect(text).not.toContain('DATABASE_URL');
  });

  test('sign-in page does not expose secrets', async ({ page }) => {
    await page.goto('/auth/signin');
    const content = await page.content();

    expect(content).not.toContain('AUTH_SECRET');
    expect(content).not.toContain('AUTH_GITHUB_SECRET');
    expect(content).not.toContain('postgres://');
  });
});

test.describe('Authentication Required', () => {
  test('admin routes are protected', async ({ request }) => {
    const response = await request.get('/api/admin/users');
    expect([401, 403, 404]).toContain(response.status());
  });

  test('upload endpoint requires auth', async ({ request }) => {
    const response = await request.post('/api/upload', {
      data: {},
    });
    expect(response.status()).toBe(401);
  });
});
