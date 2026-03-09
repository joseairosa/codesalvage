/**
 * E2E Suite 8: Seller Analytics
 *
 * Tests the analytics overview endpoint:
 * - Seller can access their own analytics
 * - Non-seller (buyer) is rejected with 401/403
 * - Response shape contains expected fields
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createE2EUser,
  cleanupE2EData,
  disconnectPrisma,
  get,
} from './helpers';
import type { E2EUser } from './helpers';

let seller: E2EUser;
let buyer: E2EUser;

beforeAll(async () => {
  seller = await createE2EUser({ isSeller: true, isVerifiedSeller: true });
  buyer = await createE2EUser({ isSeller: false });
});

afterAll(async () => {
  await cleanupE2EData();
  await disconnectPrisma();
});

describe('08 · Seller Analytics', () => {
  it('GET /api/analytics/overview → 200 for seller', async () => {
    const { status, body } = await get('/api/analytics/overview', seller.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    // Should contain some recognised top-level field
    const hasKnownKey = ['totalRevenue', 'revenue', 'data', 'overview', 'projects'].some(
      (k) => k in b
    );
    expect(hasKnownKey).toBe(true);
  });

  it('GET /api/analytics/overview → 401/403 for non-seller buyer', async () => {
    const { status } = await get('/api/analytics/overview', buyer.apiKey);
    expect([401, 403]).toContain(status);
  });

  it('GET /api/analytics/overview → 401 without auth', async () => {
    const { status } = await get('/api/analytics/overview');
    expect(status).toBe(401);
  });

  it('GET /api/analytics/overview?granularity=week → 200 for seller', async () => {
    const { status } = await get(
      '/api/analytics/overview?granularity=week',
      seller.apiKey
    );
    expect(status).toBe(200);
  });
});
