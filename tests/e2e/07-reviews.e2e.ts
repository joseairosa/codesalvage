/**
 * E2E Suite 7: Reviews
 *
 * Tests review submission, listing, stats, and duplicate prevention.
 * Requires a completed transaction — seeded via POST /api/admin/e2e/seed-transaction.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createE2EUser,
  createE2EProject,
  seedTransaction,
  cleanupE2E,
  get,
  post,
} from './helpers';
import type { E2EUser } from './helpers';

let buyer: E2EUser;
let seller: E2EUser;
let transactionId: string | null = null;

beforeAll(async () => {
  [buyer, seller] = await Promise.all([
    createE2EUser(),
    createE2EUser({ isSeller: true, isVerifiedSeller: true }),
  ]);

  const project = await createE2EProject(seller.apiKey);
  const tx = await seedTransaction({
    projectId: project.id,
    sellerId: seller.id,
    buyerId: buyer.id,
    amountCents: 24900,
  });
  transactionId = tx.id;
});

afterAll(async () => {
  await cleanupE2E();
});

describe('07 · Reviews', () => {
  it('POST /api/reviews → 201, review created', async () => {
    if (!transactionId) return;
    const { status, body } = await post(
      '/api/reviews',
      {
        transactionId,
        overallRating: 5,
        codeQualityRating: 5,
        documentationRating: 4,
        responsivenessRating: 5,
        accuracyRating: 5,
        comment: 'E2E test review — excellent project, highly recommended!',
      },
      buyer.apiKey
    );
    expect([200, 201]).toContain(status);
    const b = body as Record<string, unknown>;
    const reviewObj = (b.review ?? b) as Record<string, unknown>;
    expect(reviewObj).toHaveProperty('id');
  });

  it('GET /api/reviews?sellerId → list includes new review', async () => {
    if (!transactionId) return;
    const { status, body } = await get(
      `/api/reviews?sellerId=${seller.id}`,
      buyer.apiKey
    );
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    const reviews = (b.reviews ?? b.data ?? body) as unknown[];
    expect(Array.isArray(reviews)).toBe(true);
    expect(reviews.length).toBeGreaterThan(0);
  });

  it('GET /api/reviews/stats/:sellerId → stats updated', async () => {
    if (!transactionId) return;
    const { status, body } = await get(`/api/reviews/stats/${seller.id}`, buyer.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(typeof b.averageRating ?? b.overall).toBe('number');
  });

  it('POST /api/reviews again → 400/409 duplicate rejected', async () => {
    if (!transactionId) return;
    const { status } = await post(
      '/api/reviews',
      {
        transactionId,
        overallRating: 3,
        comment: 'Duplicate review attempt',
      },
      buyer.apiKey
    );
    expect([400, 409, 422]).toContain(status);
  });
});
