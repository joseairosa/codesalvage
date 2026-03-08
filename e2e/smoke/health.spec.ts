/**
 * Smoke Tests: Health & Availability
 *
 * Verifies the deployment is alive and responding correctly.
 * These run first — if health fails, the rest are moot.
 *
 * Targets: /api/ping, /, /projects
 */

import { test, expect } from '@playwright/test';

test.describe('Health & Availability', () => {
  test('GET /api/ping returns 200 with ok:true', async ({ request }) => {
    const response = await request.get('/api/ping');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({ ok: true });
  });

  test('homepage responds within 3 seconds', async ({ page }) => {
    const start = Date.now();
    const response = await page.goto('/');
    const elapsed = Date.now() - start;

    expect(response?.status()).toBe(200);
    expect(elapsed).toBeLessThan(3000);
  });

  test('projects page responds within 3 seconds', async ({ page }) => {
    const start = Date.now();
    const response = await page.goto('/projects');
    const elapsed = Date.now() - start;

    expect(response?.status()).toBe(200);
    expect(elapsed).toBeLessThan(3000);
  });

  test('GET /api/subscriptions/pricing responds within 2 seconds', async ({
    request,
  }) => {
    const start = Date.now();
    const response = await request.get('/api/subscriptions/pricing');
    const elapsed = Date.now() - start;

    expect(response.status()).toBe(200);
    expect(elapsed).toBeLessThan(2000);
  });

  test('sign-in page responds within 3 seconds', async ({ page }) => {
    const start = Date.now();
    const response = await page.goto('/auth/signin');
    const elapsed = Date.now() - start;

    expect(response?.status()).toBe(200);
    expect(elapsed).toBeLessThan(3000);
  });
});
