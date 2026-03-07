/**
 * Admin Disputes API Route Tests
 *
 * GET /api/admin/disputes — list all disputes (admin only)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockRequireAdminApiAuth, mockFindAll } = vi.hoisted(() => ({
  mockRequireAdminApiAuth: vi.fn(),
  mockFindAll: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  requireAdminApiAuth: mockRequireAdminApiAuth,
}));

vi.mock('@/lib/utils/admin-services', () => ({
  getDisputeRepository: vi.fn(() => ({ findAll: mockFindAll })),
}));

import { GET } from '../route';

const ADMIN_AUTH = { user: { id: 'admin1', isAdmin: true, email: 'admin@example.com' } };

const MOCK_DISPUTES = [
  {
    id: 'dispute1',
    reason: 'code_not_functional',
    description: 'Nothing works',
    status: 'pending',
    resolution: null,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    buyer: {
      id: 'buyer1',
      username: 'buyer',
      fullName: 'Buyer One',
      email: 'buyer@example.com',
    },
    transaction: {
      id: 'tx1',
      amountCents: 9900,
      project: { id: 'proj1', title: 'My Project' },
    },
  },
];

function makeGetRequest(search = '') {
  return new NextRequest(`http://localhost/api/admin/disputes${search}`, {
    method: 'GET',
  });
}

describe('GET /api/admin/disputes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(null);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 200 with disputes list', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);
    mockFindAll.mockResolvedValue(MOCK_DISPUTES);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.disputes).toHaveLength(1);
    expect(body.disputes[0].id).toBe('dispute1');
    expect(mockFindAll).toHaveBeenCalledWith(undefined);
  });

  it('passes status filter to repository', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);
    mockFindAll.mockResolvedValue([]);

    const res = await GET(makeGetRequest('?status=pending'));
    expect(res.status).toBe(200);
    expect(mockFindAll).toHaveBeenCalledWith('pending');
  });

  it('returns empty array when no disputes match', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);
    mockFindAll.mockResolvedValue([]);

    const res = await GET(makeGetRequest('?status=resolved_refund'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.disputes).toHaveLength(0);
  });

  it('returns 500 on repository error', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);
    mockFindAll.mockRejectedValue(new Error('DB error'));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch disputes');
  });
});
