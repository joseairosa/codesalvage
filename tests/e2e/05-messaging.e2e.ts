/**
 * E2E Suite 5: Messaging
 *
 * Tests send message, list conversations, thread view, mark read.
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
let projectId: string | null = null;
let setupComplete = false;

const prisma = new PrismaClient({
  datasources: { db: { url: process.env['DATABASE_URL'] } },
});

beforeAll(async () => {
  [buyer, seller] = await Promise.all([
    createE2EUser(),
    createE2EUser({ isSeller: true, isVerifiedSeller: true }),
  ]);

  // Seed a project directly via Prisma — soft-fails when DB is unreachable
  // (postgres.railway.internal is not accessible from the local test runner)
  if (seller.rolesSet) {
    try {
      const project = await prisma.project.create({
        data: {
          sellerId: seller.id,
          title: `${E2E_PREFIX}Messaging Test Project`,
          description: 'E2E test project for messaging suite',
          category: 'web_app',
          completionPercentage: 70,
          priceCents: 7900,
          techStack: ['Vue'],
          primaryLanguage: 'JavaScript',
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
        '[E2E] Project seed skipped (DB unreachable from this host). Messaging tests will be skipped.',
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

describe('05 · Messaging', () => {
  it('POST /api/messages → 201, message sent', async (ctx) => {
    if (!setupComplete) ctx.skip();
    const { status, body } = await post(
      '/api/messages',
      {
        recipientId: seller.id,
        content: 'E2E test message: Is this project still available?',
        projectId,
      },
      buyer.apiKey
    );
    expect([200, 201]).toContain(status);
    const b = body as Record<string, unknown>;
    expect(b).toHaveProperty('id');
  });

  it('GET /api/messages → 200, conversation list returned', async (ctx) => {
    if (!setupComplete) ctx.skip();
    const { status, body } = await get('/api/messages', buyer.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    const conversations = b.conversations ?? b.data ?? body;
    expect(Array.isArray(conversations)).toBe(true);
  });

  it('GET /api/messages/:userId → 200, thread with seller', async (ctx) => {
    if (!setupComplete) ctx.skip();
    const { status, body } = await get(`/api/messages/${seller.id}`, buyer.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    const messages = b.messages ?? body;
    expect(Array.isArray(messages)).toBe(true);
    expect((messages as unknown[]).length).toBeGreaterThan(0);
  });

  it('POST /api/messages/read → 200, messages marked read', async (ctx) => {
    if (!setupComplete) ctx.skip();
    const { status } = await post(
      '/api/messages/read',
      { senderId: buyer.id },
      seller.apiKey
    );
    expect([200, 204]).toContain(status);
  });

  it('Seller can also send a reply', async (ctx) => {
    if (!setupComplete) ctx.skip();
    const { status } = await post(
      '/api/messages',
      {
        recipientId: buyer.id,
        content: 'E2E reply: Yes, still available!',
        projectId,
      },
      seller.apiKey
    );
    expect([200, 201]).toContain(status);
  });

  it('GET /api/messages/:userId (seller view) → thread has both messages', async (ctx) => {
    if (!setupComplete) ctx.skip();
    const { status, body } = await get(`/api/messages/${buyer.id}`, seller.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    const messages = (b.messages ?? body) as unknown[];
    expect(messages.length).toBeGreaterThanOrEqual(2);
  });
});
