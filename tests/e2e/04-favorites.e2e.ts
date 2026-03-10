/**
 * E2E Suite 4: Favorites
 *
 * Tests add, check, list, and remove favorites.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createE2EUser, createE2EProject, cleanupE2E, get, post, del } from './helpers';
import type { E2EUser } from './helpers';

let buyer: E2EUser;
let projectId: string | null = null;

beforeAll(async () => {
  buyer = await createE2EUser();
  const seller = await createE2EUser({ isSeller: true, isVerifiedSeller: true });
  const project = await createE2EProject(seller.apiKey);
  projectId = project.id;
});

afterAll(async () => {
  await cleanupE2E();
});

describe('04 · Favorites', () => {
  it('GET /api/favorites/check/:id → not favorited initially', async () => {
    const { status, body } = await get(`/api/favorites/check/${projectId}`, buyer.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.isFavorited).toBe(false);
  });

  it('POST /api/favorites → 200/201, project favorited', async () => {
    const { status } = await post('/api/favorites', { projectId }, buyer.apiKey);
    expect([200, 201]).toContain(status);
  });

  it('GET /api/favorites/check/:id → isFavorited: true', async () => {
    const { status, body } = await get(`/api/favorites/check/${projectId}`, buyer.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.isFavorited).toBe(true);
  });

  it('GET /api/favorites → list includes project', async () => {
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

  it('DELETE /api/favorites/:id → 200', async () => {
    const { status } = await del(`/api/favorites/${projectId}`, buyer.apiKey);
    expect([200, 204]).toContain(status);
  });

  it('GET /api/favorites/check/:id → isFavorited: false after removal', async () => {
    const { status, body } = await get(`/api/favorites/check/${projectId}`, buyer.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.isFavorited).toBe(false);
  });
});
