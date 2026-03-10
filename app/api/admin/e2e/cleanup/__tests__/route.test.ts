/**
 * Admin E2E Cleanup Route Tests
 *
 * DELETE /api/admin/e2e/cleanup
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockRequireAdminApiAuth, mockPrismaFindMany, mockPrismaDeleteMany } = vi.hoisted(
  () => ({
    mockRequireAdminApiAuth: vi.fn(),
    mockPrismaFindMany: vi.fn(),
    mockPrismaDeleteMany: vi.fn(),
  })
);

vi.mock('@/lib/api-auth', () => ({
  requireAdminApiAuth: mockRequireAdminApiAuth,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: mockPrismaFindMany,
      deleteMany: mockPrismaDeleteMany,
    },
    apiKey: { deleteMany: mockPrismaDeleteMany },
    review: { deleteMany: mockPrismaDeleteMany },
    message: { deleteMany: mockPrismaDeleteMany },
    favorite: { deleteMany: mockPrismaDeleteMany },
    offer: { deleteMany: mockPrismaDeleteMany },
    adminAuditLog: { deleteMany: mockPrismaDeleteMany },
    transaction: { deleteMany: mockPrismaDeleteMany },
    project: { deleteMany: mockPrismaDeleteMany },
  },
}));

import { DELETE } from '../route';

const ADMIN_AUTH = {
  user: { id: 'admin1', isAdmin: true, email: 'admin@example.com' },
};

function makeDeleteRequest() {
  return new NextRequest('http://localhost/api/admin/e2e/cleanup', {
    method: 'DELETE',
  });
}

describe('DELETE /api/admin/e2e/cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when E2E_SEED_ENABLED is not set', async () => {
    const original = process.env['E2E_SEED_ENABLED'];
    delete process.env['E2E_SEED_ENABLED'];
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);

    const res = await DELETE(makeDeleteRequest());

    expect(res.status).toBe(404);
    if (original !== undefined) process.env['E2E_SEED_ENABLED'] = original;
  });

  it('returns 401 when not authenticated', async () => {
    process.env['E2E_SEED_ENABLED'] = 'true';
    mockRequireAdminApiAuth.mockResolvedValue(null);

    const res = await DELETE(makeDeleteRequest());

    expect(res.status).toBe(401);
  });

  it('returns 200 with count when cleanup succeeds', async () => {
    process.env['E2E_SEED_ENABLED'] = 'true';
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);
    mockPrismaFindMany.mockResolvedValue([{ id: 'user1' }, { id: 'user2' }]);
    mockPrismaDeleteMany.mockResolvedValue({ count: 2 });

    const res = await DELETE(makeDeleteRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBeDefined();
    expect(typeof body.deleted.users).toBe('number');
  });

  it('returns 200 with zeros when no e2e users exist', async () => {
    process.env['E2E_SEED_ENABLED'] = 'true';
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);
    mockPrismaFindMany.mockResolvedValue([]);
    mockPrismaDeleteMany.mockResolvedValue({ count: 0 });

    const res = await DELETE(makeDeleteRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted.users).toBe(0);
  });
});
