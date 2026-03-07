/**
 * GET /api/u/[username]/reviews - Unit Tests
 *
 * Tests for the public seller reviews API endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockFindByUsername = vi.fn();
const mockGetSellerReviews = vi.fn();

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

vi.mock('@/lib/repositories/UserRepository', () => ({
  UserRepository: vi.fn().mockImplementation(() => ({
    findByUsername: mockFindByUsername,
  })),
}));

vi.mock('@/lib/repositories/ReviewRepository', () => ({
  ReviewRepository: vi.fn().mockImplementation(() => ({
    getSellerReviews: mockGetSellerReviews,
  })),
}));

vi.mock('@/lib/middleware/withRateLimit', () => ({
  withPublicRateLimit: (handler: (...args: unknown[]) => unknown) => handler,
}));

const makeRequest = (username: string, page = '1', limit = '10') =>
  new NextRequest(
    `http://localhost:3011/api/u/${username}/reviews?page=${page}&limit=${limit}`
  );

const makeContext = (username: string) => ({
  params: Promise.resolve({ username }),
});

describe('GET /api/u/[username]/reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 404 when user does not exist', async () => {
    mockFindByUsername.mockResolvedValue(null);

    const { GET } = await import('../route');
    const response = await GET(makeRequest('nobody'), makeContext('nobody'));

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBeDefined();
  });

  it('should return 404 when user is not a seller', async () => {
    mockFindByUsername.mockResolvedValue({
      id: 'user-1',
      username: 'buyeronly',
      isSeller: false,
      isBanned: false,
    });

    const { GET } = await import('../route');
    const response = await GET(makeRequest('buyeronly'), makeContext('buyeronly'));

    expect(response.status).toBe(404);
  });

  it('should return 404 when user is banned', async () => {
    mockFindByUsername.mockResolvedValue({
      id: 'user-1',
      username: 'banned',
      isSeller: true,
      isBanned: true,
    });

    const { GET } = await import('../route');
    const response = await GET(makeRequest('banned'), makeContext('banned'));

    expect(response.status).toBe(404);
  });

  it('should return paginated reviews for a valid seller', async () => {
    mockFindByUsername.mockResolvedValue({
      id: 'seller-1',
      username: 'testseller',
      isSeller: true,
      isBanned: false,
    });

    const mockReviews = [
      {
        id: 'rev-1',
        sellerId: 'seller-1',
        buyerId: 'buyer-1',
        overallRating: 5,
        comment: 'Great seller!',
        isAnonymous: false,
        createdAt: new Date('2026-01-01'),
        buyer: {
          id: 'buyer-1',
          username: 'buyer1',
          fullName: 'Buyer One',
          avatarUrl: null,
        },
        transaction: {
          id: 'txn-1',
          projectId: 'proj-1',
          project: { id: 'proj-1', title: 'My Project' },
        },
      },
    ];

    mockGetSellerReviews.mockResolvedValue({
      reviews: mockReviews,
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });

    const { GET } = await import('../route');
    const response = await GET(makeRequest('testseller'), makeContext('testseller'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.reviews).toHaveLength(1);
    expect(body.reviews[0].overallRating).toBe(5);
    expect(body.pagination.total).toBe(1);
  });

  it('should mask anonymous buyer info in reviews', async () => {
    mockFindByUsername.mockResolvedValue({
      id: 'seller-1',
      username: 'testseller',
      isSeller: true,
      isBanned: false,
    });

    mockGetSellerReviews.mockResolvedValue({
      reviews: [
        {
          id: 'rev-2',
          sellerId: 'seller-1',
          buyerId: 'buyer-2',
          overallRating: 4,
          comment: 'Good project',
          isAnonymous: true,
          createdAt: new Date('2026-01-02'),
          buyer: {
            id: 'buyer-2',
            username: 'buyer2',
            fullName: 'Buyer Two',
            avatarUrl: null,
          },
          transaction: {
            id: 'txn-2',
            projectId: 'proj-2',
            project: { id: 'proj-2', title: 'Another Project' },
          },
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    });

    const { GET } = await import('../route');
    const response = await GET(makeRequest('testseller'), makeContext('testseller'));

    expect(response.status).toBe(200);
    const body = await response.json();
    const review = body.reviews[0];
    expect(review.buyer.username).toBe('Anonymous');
    expect(review.buyer.fullName).toBeNull();
    expect(review.buyer.avatarUrl).toBeNull();
  });

  it('should use page and limit query params', async () => {
    mockFindByUsername.mockResolvedValue({
      id: 'seller-1',
      username: 'testseller',
      isSeller: true,
      isBanned: false,
    });
    mockGetSellerReviews.mockResolvedValue({
      reviews: [],
      total: 0,
      page: 2,
      limit: 5,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });

    const { GET } = await import('../route');
    await GET(makeRequest('testseller', '2', '5'), makeContext('testseller'));

    expect(mockGetSellerReviews).toHaveBeenCalledWith('seller-1', { page: 2, limit: 5 });
  });
});
