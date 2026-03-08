/**
 * Smoke Tests: Public API Endpoints
 *
 * Verifies public API routes respond with correct shape and status codes.
 * No auth token required — only public endpoints are tested here.
 *
 * Also validates rate limit headers are present on responses,
 * confirming the withRateLimit middleware is active.
 */

import { test, expect } from '@playwright/test';

test.describe('GET /api/ping', () => {
  test('returns 200 with expected shape', async ({ request }) => {
    const response = await request.get('/api/ping');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({ ok: true });
  });

  test('content-type is application/json', async ({ request }) => {
    const response = await request.get('/api/ping');
    expect(response.headers()['content-type']).toContain('application/json');
  });
});

test.describe('GET /api/subscriptions/pricing', () => {
  test('returns 200 with pricing object', async ({ request }) => {
    const response = await request.get('/api/subscriptions/pricing');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('pricing');
    // pricing is a keyed object: { free: {...}, pro: {...} }
    expect(typeof body.pricing).toBe('object');
    expect(body.pricing).not.toBeNull();
  });

  test('pricing tiers have required fields', async ({ request }) => {
    const response = await request.get('/api/subscriptions/pricing');
    const body = await response.json();

    for (const tier of Object.values(body.pricing) as Record<string, unknown>[]) {
      expect(tier).toHaveProperty('plan');
      expect(tier).toHaveProperty('costCents');
    }
  });

  test('has rate limit headers', async ({ request }) => {
    const response = await request.get('/api/subscriptions/pricing');
    const headers = response.headers();

    // withPublicRateLimit should inject these headers
    expect(headers).toHaveProperty('x-ratelimit-limit');
    expect(headers).toHaveProperty('x-ratelimit-remaining');
  });
});

test.describe('GET /api/projects', () => {
  test('returns 200 with projects array', async ({ request }) => {
    const response = await request.get('/api/projects');
    expect(response.status()).toBe(200);

    const body = await response.json();
    // Projects response may be paginated or flat array
    const hasProjects =
      Array.isArray(body) || Array.isArray(body.projects) || Array.isArray(body.data);
    expect(hasProjects).toBe(true);
  });

  test('has rate limit headers', async ({ request }) => {
    const response = await request.get('/api/projects');
    const headers = response.headers();

    expect(headers).toHaveProperty('x-ratelimit-limit');
    expect(headers).toHaveProperty('x-ratelimit-remaining');
  });
});

test.describe('Protected API Endpoints (unauthenticated)', () => {
  test('GET /api/analytics/overview returns 401 (not 500)', async ({ request }) => {
    const response = await request.get('/api/analytics/overview');
    expect(response.status()).toBe(401);
  });

  test('POST /api/featured-listings/purchase returns 401 (not 500)', async ({
    request,
  }) => {
    const response = await request.post('/api/featured-listings/purchase', {
      data: { projectId: 'smoke-test', durationDays: 7 },
    });
    expect(response.status()).toBe(401);
  });

  test('GET /api/github/connect returns 401 (not 500)', async ({ request }) => {
    const response = await request.get('/api/github/connect');
    // Should redirect to sign-in or return 401, not crash
    expect([301, 302, 307, 308, 401]).toContain(response.status());
  });

  test('GET /api/subscriptions returns 401 (not 500)', async ({ request }) => {
    const response = await request.get('/api/subscriptions');
    expect(response.status()).toBe(401);
  });

  test('POST /api/offers returns 401 (not 500)', async ({ request }) => {
    const response = await request.post('/api/offers', {
      data: {},
    });
    expect(response.status()).toBe(401);
  });
});
