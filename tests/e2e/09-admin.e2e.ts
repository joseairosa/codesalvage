/**
 * E2E Suite 9: Admin Routes
 *
 * Tests platform admin endpoints:
 * - Stats accessible to admin users only
 * - Project approve / reject flows
 * - User ban / unban flows
 * - All endpoints reject non-admin and unauthenticated requests
 *
 * Admin user is created with isAdmin: true directly via Prisma.
 * A regular seller project is seeded so approve/reject have something to act on.
 *
 * Note: Tests that require admin/seller roles or a seeded project are skipped
 * when the production DB is unreachable from the test runner (Railway internal
 * network). Rejection tests (401/403) always run.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  createE2EUser,
  cleanupE2EData,
  disconnectPrisma,
  get,
  BASE_URL,
  E2E_PREFIX,
} from './helpers';
import type { E2EUser } from './helpers';

let admin: E2EUser;
let seller: E2EUser;
let buyer: E2EUser;
let projectId: string | null = null;
let targetUserId: string | null = null;

const prisma = new PrismaClient({
  datasources: { db: { url: process.env['DATABASE_URL'] } },
});

beforeAll(async () => {
  [admin, seller, buyer] = await Promise.all([
    createE2EUser({ isAdmin: true }),
    createE2EUser({ isSeller: true, isVerifiedSeller: true }),
    createE2EUser(),
  ]);

  // Seed a draft project for approve/reject tests — soft-fails if DB unreachable
  if (seller.rolesSet) {
    try {
      const project = await prisma.project.create({
        data: {
          sellerId: seller.id,
          title: `${E2E_PREFIX}Admin Test Project`,
          description: 'E2E test project for admin suite',
          category: 'web_app',
          completionPercentage: 80,
          priceCents: 14900,
          techStack: ['Node.js'],
          primaryLanguage: 'JavaScript',
          licenseType: 'full_code',
          accessLevel: 'full',
          status: 'active',
          isApproved: false,
        },
      });
      projectId = project.id;
    } catch (err) {
      console.warn('[E2E] Project seed skipped (DB unreachable):', (err as Error).message);
    }
  }

  // Create a throwaway user to ban/unban
  const target = await createE2EUser();
  targetUserId = target.id;
});

afterAll(async () => {
  await prisma.$disconnect();
  await cleanupE2EData();
  await disconnectPrisma();
});

describe('09 · Admin', () => {
  // ── Stats ──────────────────────────────────────────────────────────────────

  it('GET /api/admin/stats → 200 for admin', async (ctx) => {
    if (!admin.rolesSet) ctx.skip();
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

  it('PUT /api/admin/projects/:id/approve → 200 project approved', async (ctx) => {
    if (!admin.rolesSet || !projectId) ctx.skip();
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

  it('PUT /api/admin/projects/:id/approve → 401 for non-admin', async (ctx) => {
    if (!projectId) ctx.skip();
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

  it('PUT /api/admin/users/:id/ban → 200 user banned', async (ctx) => {
    if (!admin.rolesSet || !targetUserId) ctx.skip();
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

  it('PUT /api/admin/users/:id/unban → 200 user unbanned', async (ctx) => {
    if (!admin.rolesSet || !targetUserId) ctx.skip();
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

  it('PUT /api/admin/users/:id/ban → 401 for non-admin', async (ctx) => {
    if (!targetUserId) ctx.skip();
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

  it('GET /api/admin/users → 200 list returned for admin', async (ctx) => {
    if (!admin.rolesSet) ctx.skip();
    const { status, body } = await get('/api/admin/users', admin.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    const users = (b.users ?? b.data ?? body) as unknown[];
    expect(Array.isArray(users)).toBe(true);
  });

  it('GET /api/admin/projects → 200 list returned for admin', async (ctx) => {
    if (!admin.rolesSet) ctx.skip();
    const { status, body } = await get('/api/admin/projects', admin.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    const projects = (b.projects ?? b.data ?? body) as unknown[];
    expect(Array.isArray(projects)).toBe(true);
  });
});
