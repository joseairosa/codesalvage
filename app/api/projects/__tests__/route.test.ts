/**
 * Projects API Route Tests — GET /api/projects
 *
 * Focuses on the status filter defaulting behaviour:
 *  - Public marketplace: defaults to status=active (hides sold/draft/delisted)
 *  - Seller dashboard (sellerId param present): no status default, returns all
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockSearchProjects } = vi.hoisted(() => ({
  mockSearchProjects: vi
    .fn()
    .mockResolvedValue({ projects: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
}));

vi.mock('@/lib/services', () => ({
  ProjectService: vi.fn().mockImplementation(() => ({
    searchProjects: mockSearchProjects,
    createProject: vi.fn(),
  })),
  SubscriptionService: vi.fn().mockImplementation(() => ({})),
  r2Service: {},
  ProjectValidationError: class extends Error {},
}));

vi.mock('@/lib/repositories', () => ({
  ProjectRepository: vi.fn().mockImplementation(() => ({})),
  UserRepository: vi.fn().mockImplementation(() => ({})),
  SubscriptionRepository: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

vi.mock('@/lib/utils/cache', () => ({
  getOrSetCache: (_key: string, _ttl: number, fn: () => unknown) => fn(),
  CacheKeys: { searchResults: () => 'cache-key' },
  CacheTTL: { SEARCH_RESULTS: 60 },
  invalidateCache: { search: vi.fn(), seller: vi.fn() },
}));

vi.mock('@/lib/middleware/withRateLimit', () => ({
  withApiRateLimit: (handler: unknown) => handler,
  withPublicRateLimit: (handler: unknown) => handler,
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
}));

import { GET } from '../route';

function makeRequest(search = '') {
  return new NextRequest(`http://localhost/api/projects${search ? `?${search}` : ''}`);
}

describe('GET /api/projects — status filter defaulting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults status to "active" for the public marketplace (no sellerId)', async () => {
    await GET(makeRequest());

    expect(mockSearchProjects).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
      expect.any(Object)
    );
  });

  it('does NOT apply a default status when sellerId is present (seller dashboard)', async () => {
    await GET(makeRequest('sellerId=seller-123'));

    const [filters] = mockSearchProjects.mock.calls[0] as [Record<string, unknown>];
    expect(filters).not.toHaveProperty('status');
    expect(filters).toMatchObject({ sellerId: 'seller-123' });
  });

  it('respects an explicit status param even when sellerId is provided', async () => {
    await GET(makeRequest('sellerId=seller-123&status=sold'));

    expect(mockSearchProjects).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sold', sellerId: 'seller-123' }),
      expect.any(Object)
    );
  });

  it('returns 200 with project results', async () => {
    mockSearchProjects.mockResolvedValueOnce({
      projects: [{ id: 'proj-1', title: 'Test Project' }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const response = await GET(makeRequest('sellerId=seller-123'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.projects).toHaveLength(1);
  });
});
