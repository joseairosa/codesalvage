/**
 * E2E Suite 7: Reviews
 *
 * Tests review submission, listing, stats, and duplicate prevention.
 * Requires a completed transaction — seeded directly via Prisma.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import {
  createE2EUser,
  cleanupE2EData,
  disconnectPrisma,
  get,
  post,
  E2E_PREFIX,
} from './helpers';
import type { E2EUser } from './helpers';

let buyer: E2EUser;
let seller: E2EUser;
let transactionId: string;

const prisma = new PrismaClient({
  datasources: { db: { url: process.env['DATABASE_URL'] } },
});

beforeAll(async () => {
  buyer = await createE2EUser();
  seller = await createE2EUser({ isSeller: true, isVerifiedSeller: true });

  const project = await prisma.project.create({
    data: {
      sellerId: seller.id,
      title: `${E2E_PREFIX}Reviews Test Project`,
      description: 'E2E test project for reviews suite',
      category: 'web_app',
      completionPercentage: 90,
      priceCents: 24900,
      techStack: ['Node.js'],
      primaryLanguage: 'JavaScript',
      licenseType: 'full_code',
      accessLevel: 'full',
      status: 'active',
      isApproved: true,
    },
  });

  // Seed a completed transaction so the buyer can leave a review
  const tx = await prisma.transaction.create({
    data: {
      projectId: project.id,
      sellerId: seller.id,
      buyerId: buyer.id,
      amountCents: 24900,
      commissionCents: 4482,
      sellerReceivesCents: 20418,
      paymentStatus: 'succeeded',
      escrowStatus: 'released',
      stripePaymentIntentId: `pi_e2e_${faker.string.alphanumeric(20)}`,
      stripeChargeId: `ch_e2e_${faker.string.alphanumeric(20)}`,
      codeDeliveryStatus: 'delivered',
      escrowReleaseDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  });
  transactionId = tx.id;
});

afterAll(async () => {
  await prisma.$disconnect();
  await cleanupE2EData();
  await disconnectPrisma();
});

describe('07 · Reviews', () => {
  it('POST /api/reviews → 201, review created', async () => {
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
    expect(b).toHaveProperty('id');
  });

  it('GET /api/reviews?sellerId → list includes new review', async () => {
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
    const { status, body } = await get(
      `/api/reviews/stats/${seller.id}`,
      buyer.apiKey
    );
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(typeof b.averageRating ?? b.overall).toBe('number');
  });

  it('POST /api/reviews again → 400/409 duplicate rejected', async () => {
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
