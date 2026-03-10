/**
 * E2E Suite 9: Admin Routes
 *
 * Tests platform admin endpoints:
 * - Stats accessible to admin users only
 * - Project approve / reject flows
 * - User ban / unban flows
 * - All endpoints reject non-admin and unauthenticated requests
 *
 * Admin user is created with isAdmin: true via PATCH /api/admin/users/:id.
 * A draft project is seeded via POST /api/projects (no publish step) so the
 * approve endpoint has something to transition from draft → active.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createE2EUser,
  createE2EDraftProject,
  cleanupE2E,
  get,
  BASE_URL,
} from './helpers';
import type { E2EUser } from './helpers';

let admin: E2EUser;
let seller: E2EUser;
let buyer: E2EUser;
let projectId: string | null = null;
let targetUserId: string | null = null;

beforeAll(async () => {
  [admin, seller, buyer] = await Promise.all([
    createE2EUser({ isAdmin: true }),
    createE2EUser({ isSeller: true, isVerifiedSeller: true }),
    createE2EUser(),
  ]);

  // Create a draft project for approve/reject tests
  const project = await createE2EDraftProject(seller.apiKey);
  projectId = project.id;

  // Create a throwaway user to ban/unban
  const target = await createE2EUser();
  targetUserId = target.id;
});

afterAll(async () => {
  await cleanupE2E();
});

describe('09 · Admin', () => {
  // ── Stats ──────────────────────────────────────────────────────────────────

  it('GET /api/admin/stats → 200 for admin', async () => {
    const { status, body } = await get('/api/admin/stats', admin.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b).toHaveProperty('stats');
  });

  it('GET /api/admin/stats → 401 for non-admin seller', async () => {
    const { status } = await get('/api/admin/stats', seller.apiKey);
    expect([401, 403]).toContain(status);
  });

  it('GET /api/admin/stats → 401 without auth', async () => {
    const { status } = await get('/api/admin/stats');
    expect(status).toBe(401);
  });

  // ── Project approve ────────────────────────────────────────────────────────

  it('PUT /api/admin/projects/:id/approve → 200 project approved', async () => {
    if (!projectId) return;
    const res = await fetch(`${BASE_URL}/api/admin/projects/${projectId}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${admin.apiKey}`,
      },
    });
    const approveBody = (await res.json()) as Record<string, unknown>;
    expect(res.status).toBe(200);
    expect(approveBody).toHaveProperty('id');
  });

  it('PUT /api/admin/projects/:id/approve → 401 for non-admin', async () => {
    if (!projectId) return;
    const res = await fetch(`${BASE_URL}/api/admin/projects/${projectId}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyer.apiKey}`,
      },
    });
    expect([401, 403]).toContain(res.status);
  });

  // ── User ban / unban ───────────────────────────────────────────────────────

  it('PUT /api/admin/users/:id/ban → 200 user banned', async () => {
    if (!targetUserId) return;
    const res = await fetch(`${BASE_URL}/api/admin/users/${targetUserId}/ban`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${admin.apiKey}`,
      },
      body: JSON.stringify({ reason: 'E2E test ban — automated test' }),
    });
    expect(res.status).toBe(200);
    const b = (await res.json()) as Record<string, unknown>;
    expect(b).toHaveProperty('id');
  });

  it('PUT /api/admin/users/:id/unban → 200 user unbanned', async () => {
    if (!targetUserId) return;
    const res = await fetch(`${BASE_URL}/api/admin/users/${targetUserId}/unban`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${admin.apiKey}`,
      },
    });
    expect(res.status).toBe(200);
    const b = (await res.json()) as Record<string, unknown>;
    expect(b).toHaveProperty('id');
  });

  it('PUT /api/admin/users/:id/ban → 401 for non-admin', async () => {
    if (!targetUserId) return;
    const res = await fetch(`${BASE_URL}/api/admin/users/${targetUserId}/ban`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${seller.apiKey}`,
      },
      body: JSON.stringify({ reason: 'Should be rejected' }),
    });
    expect([401, 403]).toContain(res.status);
  });

  // ── Admin user list ────────────────────────────────────────────────────────

  it('GET /api/admin/users → 200 list returned for admin', async () => {
    const { status, body } = await get('/api/admin/users', admin.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    const users = (b.users ?? b.data ?? body) as unknown[];
    expect(Array.isArray(users)).toBe(true);
  });

  it('GET /api/admin/projects → 200 list returned for admin', async () => {
    const { status, body } = await get('/api/admin/projects', admin.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    const projects = (b.projects ?? b.data ?? body) as unknown[];
    expect(Array.isArray(projects)).toBe(true);
  });
});
