/**
 * E2E Suite 4: Favorites
 *
 * Tests add, check, list, and remove favorites.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  createE2EUser,
  cleanupE2EData,
  disconnectPrisma,
  get,
  post,
  del,
  E2E_PREFIX,
} from './helpers';
import type { E2EUser } from './helpers';

let buyer: E2EUser;
let projectId: string | null = null;
let setupComplete = false;

const prisma = new PrismaClient({
  datasources: { db: { url: process.env['DATABASE_URL'] } },
});

beforeAll(async () => {
  buyer = await createE2EUser();

  // Seed a published project via a seller — soft-fails when DB is unreachable
  // (postgres.railway.internal is not accessible from the local test runner)
  const seller = await createE2EUser({ isSeller: true, isVerifiedSeller: true });
  if (seller.rolesSet) {
    try {
      const project = await prisma.project.create({
        data: {
          sellerId: seller.id,
          title: `${E2E_PREFIX}Favorites Test Project`,
          description: 'E2E test project for favorites suite',
          category: 'web_app',
          completionPercentage: 80,
          priceCents: 4900,
          techStack: ['React'],
          primaryLanguage: 'TypeScript',
          licenseType: 'full_code',
          accessLevel: 'full',
          status: 'active',
          isApproved: true,
        },
      });
      projectId = project.id;
      setupComplete = true;
    } catch (err) {
      console.warn(
        '[E2E] Project seed skipped (DB unreachable from this host). Favorites tests will be skipped.',
        (err as Error).message
      );
    }
  }
});

afterAll(async () => {
  await prisma.$disconnect();
  await cleanupE2EData();
  await disconnectPrisma();
});

describe('04 · Favorites', () => {
  it('GET /api/favorites/check/:id → not favorited initially', async (ctx) => {
    if (!setupComplete) ctx.skip();
    const { status, body } = await get(`/api/favorites/check/${projectId}`, buyer.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.isFavorited).toBe(false);
  });

  it('POST /api/favorites → 200/201, project favorited', async (ctx) => {
    if (!setupComplete) ctx.skip();
    const { status } = await post('/api/favorites', { projectId }, buyer.apiKey);
    expect([200, 201]).toContain(status);
  });

  it('GET /api/favorites/check/:id → isFavorited: true', async (ctx) => {
    if (!setupComplete) ctx.skip();
    const { status, body } = await get(`/api/favorites/check/${projectId}`, buyer.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.isFavorited).toBe(true);
  });

  it('GET /api/favorites → list includes project', async (ctx) => {
    if (!setupComplete) ctx.skip();
    const { status, body } = await get('/api/favorites', buyer.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    const favorites = (b.favorites ?? b.data ?? body) as unknown[];
    expect(Array.isArray(favorites)).toBe(true);
    const ids = favorites.map(
      (f) => (f as Record<string, unknown>).projectId ?? (f as Record<string, unknown>).id
    );
    expect(ids).toContain(projectId);
  });

  it('DELETE /api/favorites/:id → 200', async (ctx) => {
    if (!setupComplete) ctx.skip();
    const { status } = await del(`/api/favorites/${projectId}`, buyer.apiKey);
    expect([200, 204]).toContain(status);
  });

  it('GET /api/favorites/check/:id → isFavorited: false after removal', async (ctx) => {
    if (!setupComplete) ctx.skip();
    const { status, body } = await get(`/api/favorites/check/${projectId}`, buyer.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.isFavorited).toBe(false);
  });
});
