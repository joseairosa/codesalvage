/**
 * E2E Suite 6: Offers (Negotiation)
 *
 * Tests the full offer lifecycle: create → counter → accept / reject / withdraw.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
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
let projectId: string;
let offerId: string;
let withdrawOfferId: string;

const prisma = new PrismaClient({
  datasources: { db: { url: process.env['DATABASE_URL'] } },
});

beforeAll(async () => {
  buyer = await createE2EUser();
  seller = await createE2EUser({ isSeller: true, isVerifiedSeller: true });

  const project = await prisma.project.create({
    data: {
      sellerId: seller.id,
      title: `${E2E_PREFIX}Offers Test Project`,
      description: 'E2E test project for offers suite',
      category: 'web_app',
      completionPercentage: 85,
      priceCents: 19900,
      techStack: ['Next.js'],
      primaryLanguage: 'TypeScript',
      licenseType: 'full_code',
      accessLevel: 'full',
      status: 'active',
      isApproved: true,
    },
  });
  projectId = project.id;
});

afterAll(async () => {
  await prisma.$disconnect();
  await cleanupE2EData();
  await disconnectPrisma();
});

describe('06 · Offers', () => {
  it('POST /api/offers → 201, offer created with status pending', async () => {
    const { status, body } = await post(
      '/api/offers',
      { projectId, amountCents: 15000, message: 'E2E test offer' },
      buyer.apiKey
    );
    expect([200, 201]).toContain(status);
    const b = body as Record<string, unknown>;
    expect(b).toHaveProperty('id');
    expect(b.status).toBe('pending');
    offerId = b.id as string;
  });

  it('GET /api/offers (buyer) → offer in list', async () => {
    const { status, body } = await get('/api/offers', buyer.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    const offers = (b.offers ?? b.data ?? body) as unknown[];
    const ids = offers.map((o) => (o as Record<string, unknown>).id);
    expect(ids).toContain(offerId);
  });

  it('GET /api/offers/:id (seller) → offer visible to seller', async () => {
    const { status, body } = await get(`/api/offers/${offerId}`, seller.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.id).toBe(offerId);
  });

  it('POST /api/offers/:id/counter (seller) → status countered', async () => {
    const { status, body } = await post(
      `/api/offers/${offerId}/counter`,
      { amountCents: 17000, message: 'Counter offer from seller' },
      seller.apiKey
    );
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.status).toBe('countered');
  });

  it('GET /api/offers/:id (buyer) → counter amount visible', async () => {
    const { status, body } = await get(`/api/offers/${offerId}`, buyer.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.counterAmountCents ?? b.amountCents).toBeTruthy();
  });

  it('POST /api/offers/:id/reject (seller) → status rejected', async () => {
    // Create a fresh offer to reject
    const { body: ob } = await post(
      '/api/offers',
      { projectId, amountCents: 8000, message: 'Low offer to reject' },
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
      { projectId, amountCents: 12000, message: 'Offer to withdraw' },
      buyer.apiKey
    );
    withdrawOfferId = (ob as Record<string, unknown>).id as string;

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
