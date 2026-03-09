/**
 * E2E Suite 3: Project Lifecycle
 *
 * Tests CRUD, publish, and authorization checks on projects.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createE2EUser,
  cleanupE2EData,
  disconnectPrisma,
  get,
  post,
  patch,
  del,
} from './helpers';
import type { E2EUser } from './helpers';

let seller: E2EUser;
let otherSeller: E2EUser;
let projectId: string;

beforeAll(async () => {
  seller = await createE2EUser({ isSeller: true, isVerifiedSeller: true });
  otherSeller = await createE2EUser({ isSeller: true, isVerifiedSeller: true });
});

afterAll(async () => {
  await cleanupE2EData();
  await disconnectPrisma();
});

describe('03 · Project Lifecycle', () => {
  it('POST /api/projects → 201, draft created', async () => {
    const { status, body } = await post(
      '/api/projects',
      {
        title: 'E2E Test Project',
        description:
          'This is an E2E test project with enough description content to pass validation requirements for a complete project listing.',
        category: 'web_app',
        completionPercentage: 75,
        priceCents: 9900,
        techStack: ['React', 'TypeScript'],
        primaryLanguage: 'TypeScript',
        licenseType: 'full_code',
        accessLevel: 'full',
      },
      seller.apiKey
    );
    expect(status).toBe(201);
    const b = body as Record<string, unknown>;
    expect(b).toHaveProperty('id');
    expect(b.status).toBe('draft');
    projectId = b.id as string;
  });

  it('GET /api/projects/:id → 200, owner can see draft', async () => {
    const { status, body } = await get(`/api/projects/${projectId}`, seller.apiKey);
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.id).toBe(projectId);
    expect(b.title).toBe('E2E Test Project');
  });

  it('PATCH /api/projects/:id → 200, title updated', async () => {
    const { status, body } = await patch(
      `/api/projects/${projectId}`,
      { title: 'E2E Test Project (Updated)' },
      seller.apiKey
    );
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.title).toBe('E2E Test Project (Updated)');
  });

  it('POST /api/projects/:id/publish → 200, status active', async () => {
    const { status, body } = await post(
      `/api/projects/${projectId}/publish`,
      {},
      seller.apiKey
    );
    // Some APIs return 200, some return the project object
    expect([200, 201]).toContain(status);
    const b = body as Record<string, unknown>;
    expect(b.status).toBe('active');
  });

  it('GET /api/projects → published project appears in list', async () => {
    const { status, body } = await get('/api/projects');
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    const projects = (b.projects ?? b.data ?? body) as unknown[];
    const ids = projects.map((p) => (p as Record<string, unknown>).id);
    expect(ids).toContain(projectId);
  });

  it('PATCH /api/projects/:id (wrong user) → 403', async () => {
    const { status } = await patch(
      `/api/projects/${projectId}`,
      { title: 'Should not work' },
      otherSeller.apiKey
    );
    expect([403, 404]).toContain(status);
  });

  it('DELETE /api/projects/:id → 200/204', async () => {
    const { status } = await del(`/api/projects/${projectId}`, seller.apiKey);
    expect([200, 204]).toContain(status);
  });

  it('POST /api/projects (non-seller buyer) → 403', async () => {
    const buyer = await createE2EUser({ isSeller: false });
    const { status } = await post(
      '/api/projects',
      { title: 'Should fail', priceCents: 1000 },
      buyer.apiKey
    );
    expect([400, 403]).toContain(status);
  });
});
