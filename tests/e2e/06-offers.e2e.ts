/**
 * E2E Suite 6: Offers (Negotiation)
 *
 * Tests the full offer lifecycle: create → counter → accept / reject / withdraw.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createE2EUser, createE2EProject, cleanupE2E, get, post } from './helpers';
import type { E2EUser } from './helpers';

let buyer: E2EUser;
let seller: E2EUser;
let projectId: string | null = null;
let offerId: string | null = null;

beforeAll(async () => {
  [buyer, seller] = await Promise.all([
    createE2EUser(),
    createE2EUser({ isSeller: true, isVerifiedSeller: true }),
  ]);
  const project = await createE2EProject(seller.apiKey);
  projectId = project.id;
});

afterAll(async () => {
  await cleanupE2E();
});

describe('06 · Offers', () => {
  it('POST /api/offers → 201, offer created with status pending', async () => {
    const { status, body } = await post(
      '/api/offers',
      { projectId, offeredPriceCents: 15000, message: 'E2E test offer' },
      buyer.apiKey
    );
    expect([200, 201]).toContain(status);
    const b = body as Record<string, unknown>;
    expect(b).toHaveProperty('id');
    expect(b.status).toBe('pending');
    offerId = b.id as string;
  });

  it('GET /api/offers (buyer) → offer in list', async () => {
    if (!offerId) return;
    const { status, body } = await get('/api/offers', buyer.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    const offers = (b.offers ?? b.data ?? body) as unknown[];
    const ids = offers.map((o) => (o as Record<string, unknown>).id);
    expect(ids).toContain(offerId);
  });

  it('GET /api/offers/:id (seller) → offer visible to seller', async () => {
    if (!offerId) return;
    const { status, body } = await get(`/api/offers/${offerId}`, seller.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.id).toBe(offerId);
  });

  it('POST /api/offers/:id/counter (seller) → status countered', async () => {
    if (!offerId) return;
    const { status, body } = await post(
      `/api/offers/${offerId}/counter`,
      { counterPriceCents: 17000, message: 'Counter offer from seller' },
      seller.apiKey
    );
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.status).toBe('countered');
  });

  it('GET /api/offers/:id (buyer) → counter amount visible', async () => {
    if (!offerId) return;
    const { status, body } = await get(`/api/offers/${offerId}`, buyer.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.counterAmountCents ?? b.amountCents).toBeTruthy();
  });

  it('POST /api/offers/:id/reject (seller) → status rejected', async () => {
    const { body: ob } = await post(
      '/api/offers',
      { projectId, offeredPriceCents: 8000, message: 'Low offer to reject' },
      buyer.apiKey
    );
    const rejectId = (ob as Record<string, unknown>).id as string;

    const { status, body } = await post(
      `/api/offers/${rejectId}/reject`,
      {},
      seller.apiKey
    );
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.status).toBe('rejected');
  });

  it('POST /api/offers/:id/withdraw (buyer) → status withdrawn', async () => {
    const { body: ob } = await post(
      '/api/offers',
      { projectId, offeredPriceCents: 12000, message: 'Offer to withdraw' },
      buyer.apiKey
    );
    const withdrawOfferId = (ob as Record<string, unknown>).id as string;

    const { status, body } = await post(
      `/api/offers/${withdrawOfferId}/withdraw`,
      {},
      buyer.apiKey
    );
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.status).toBe('withdrawn');
  });
});
