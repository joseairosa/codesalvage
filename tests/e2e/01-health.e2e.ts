/**
 * E2E Suite 1: Infrastructure & Health
 *
 * Tests public endpoints — no authentication required.
 * These run first; if health fails, the rest are moot.
 */

import { describe, it, expect } from 'vitest';
import { get, post } from './helpers';

describe('01 · Health & Public Endpoints', () => {
  it('GET /api/ping → 200 with ok:true', async () => {
    const { status, body } = await get('/api/ping');
    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true });
  });

  it('GET /api/health → 200', async () => {
    const { status, body } = await get('/api/health');
    expect(status).toBe(200);
    expect((body as Record<string, unknown>).status).toBeDefined();
  });

  it('GET /api/projects → 200 with array', async () => {
    const { status, body } = await get('/api/projects');
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    const isArray =
      Array.isArray(body) || Array.isArray(b.projects) || Array.isArray(b.data);
    expect(isArray).toBe(true);
  });

  it('GET /api/subscriptions/pricing → 200 with pricing tiers', async () => {
    const { status, body } = await get('/api/subscriptions/pricing');
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b).toHaveProperty('pricing');
    expect(typeof b.pricing).toBe('object');
  });

  it('GET /api/featured → 200', async () => {
    const { status } = await get('/api/featured');
    expect(status).toBe(200);
  });

  it('Protected routes return 401 without auth', async () => {
    // Note: /api/auth/me intentionally returns 200 with {user:null} when unauthenticated
    const routes = [
      () => get('/api/analytics/overview'),
      () => get('/api/transactions'),
      () => get('/api/notifications'),
      () => post('/api/offers', {}),
    ];

    for (const call of routes) {
      const { status } = await call();
      expect([401, 403, 429]).toContain(status);
    }
  });
});
