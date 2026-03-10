/**
 * E2E Suite 5: Messaging
 *
 * Tests send message, list conversations, thread view, mark read.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createE2EUser, createE2EProject, cleanupE2E, get, post } from './helpers';
import type { E2EUser } from './helpers';

let buyer: E2EUser;
let seller: E2EUser;
let projectId: string | null = null;

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

describe('05 · Messaging', () => {
  it('POST /api/messages → 201, message sent', async () => {
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
    const msgObj = (b.message ?? b) as Record<string, unknown>;
    expect(msgObj).toHaveProperty('id');
  });

  it('GET /api/messages → 200, conversation list returned', async () => {
    const { status, body } = await get('/api/messages', buyer.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    const conversations = b.conversations ?? b.data ?? body;
    expect(Array.isArray(conversations)).toBe(true);
  });

  it('GET /api/messages/:userId → 200, thread with seller', async () => {
    const { status, body } = await get(`/api/messages/${seller.id}`, buyer.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    const messages = b.messages ?? body;
    expect(Array.isArray(messages)).toBe(true);
    expect((messages as unknown[]).length).toBeGreaterThan(0);
  });

  it('POST /api/messages/read → 200, messages marked read', async () => {
    const { status } = await post(
      '/api/messages/read',
      { userId: buyer.id },
      seller.apiKey
    );
    expect([200, 204]).toContain(status);
  });

  it('Seller can also send a reply', async () => {
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

  it('GET /api/messages/:userId (seller view) → thread has both messages', async () => {
    const { status, body } = await get(`/api/messages/${buyer.id}`, seller.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    const messages = (b.messages ?? body) as unknown[];
    expect(messages.length).toBeGreaterThanOrEqual(2);
  });
});
