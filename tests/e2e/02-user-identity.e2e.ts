/**
 * E2E Suite 2: User Identity
 *
 * Tests /api/auth/me, profile updates, notifications, github status.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createE2EUser, cleanupE2EData, disconnectPrisma, get, patch, BASE_URL } from './helpers';
import type { E2EUser } from './helpers';

let buyer: E2EUser;

beforeAll(async () => {
  buyer = await createE2EUser();
});

afterAll(async () => {
  await cleanupE2EData();
  await disconnectPrisma();
});

describe('02 · User Identity', () => {
  // /api/auth/me returns 200 with { user: null } when unauthenticated (not 401),
  // so callers can distinguish "not logged in" from server errors.
  it('GET /api/auth/me (unauthenticated) → 200 with null user', async () => {
    const { status, body } = await get('/api/auth/me');
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.user).toBeNull();
  });

  // /api/auth/me reads the session cookie (httpOnly), not the Authorization header.
  // Use the session cookie from the E2E user directly.
  it('GET /api/auth/me (session cookie) → 200 with user fields', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: `session=${buyer.sessionCookie}` },
    });
    expect(res.status).toBe(200);
    const b = (await res.json()) as { user: Record<string, unknown> | null };
    expect(b.user).not.toBeNull();
    expect(b.user).toHaveProperty('id');
    expect(b.user).toHaveProperty('email');
    expect(b.user).toHaveProperty('username');
    expect(b.user!['username']).toBe(buyer.username);
  });

  it('PATCH /api/user/profile → 200, bio updated', async () => {
    const newBio = 'E2E test bio updated at ' + Date.now();
    const { status, body } = await patch(
      '/api/user/profile',
      { bio: newBio, username: buyer.username },
      buyer.apiKey
    );
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.bio).toBe(newBio);
  });

  it('GET /api/notifications → 200, returns array', async () => {
    const { status, body } = await get('/api/notifications', buyer.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    const notifications = b.notifications ?? body;
    expect(Array.isArray(notifications)).toBe(true);
  });

  it('GET /api/notifications/unread-count → 200, returns count', async () => {
    const { status, body } = await get('/api/notifications/unread-count', buyer.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    // Response shape: { unreadCount: number }
    expect(typeof b.unreadCount).toBe('number');
  });

  it('GET /api/user/github-status → 200', async () => {
    const { status } = await get('/api/user/github-status', buyer.apiKey);
    expect(status).toBe(200);
  });
});
