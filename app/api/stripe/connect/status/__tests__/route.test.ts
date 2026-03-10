/**
 * GET /api/stripe/connect/status — Route Tests
 *
 * Covers:
 * - 401 when unauthenticated
 * - 404 when user not found
 * - Returns needsOnboarding: true when no stripeAccountId stored
 * - Returns isOnboarded status when account exists
 * - Marks user as verified seller when onboarding completes
 * - Self-healing: resets stale account ID (resource_missing) and returns needsOnboarding
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockAuthenticateApiRequest,
  mockPrismaUserFindUnique,
  mockPrismaUserUpdate,
  mockIsAccountOnboarded,
  mockGetOrSetCache,
} = vi.hoisted(() => ({
  mockAuthenticateApiRequest: vi.fn(),
  mockPrismaUserFindUnique: vi.fn(),
  mockPrismaUserUpdate: vi.fn(),
  mockIsAccountOnboarded: vi.fn(),
  mockGetOrSetCache: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mockAuthenticateApiRequest,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: mockPrismaUserFindUnique,
      update: mockPrismaUserUpdate,
    },
  },
}));

vi.mock('@/lib/services', () => ({
  stripeService: {
    isAccountOnboarded: mockIsAccountOnboarded,
  },
}));

vi.mock('@/lib/middleware/withRateLimit', () => ({
  withApiRateLimit: (handler: unknown) => handler,
}));

vi.mock('@/lib/utils/cache', () => ({
  getOrSetCache: mockGetOrSetCache,
  CacheKeys: { stripeConnectStatus: (id: string) => `stripe-connect:${id}` },
  CacheTTL: { SUBSCRIPTION: 3600 },
}));

import { GET } from '../route';

function makeRequest() {
  return new NextRequest('http://localhost/api/stripe/connect/status');
}

const mockUser = {
  id: 'user1',
  stripeAccountId: 'acct_live123',
  isSeller: true,
  isVerifiedSeller: false,
};

describe('GET /api/stripe/connect/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue(null);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 404 when user not found', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'user1' } });
    mockPrismaUserFindUnique.mockResolvedValue(null);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('User not found');
  });

  it('returns needsOnboarding: true when no stripeAccountId stored', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'user1' } });
    mockPrismaUserFindUnique.mockResolvedValue({ ...mockUser, stripeAccountId: null });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isOnboarded).toBe(false);
    expect(body.needsOnboarding).toBe(true);
    expect(body.accountId).toBeNull();
    expect(mockGetOrSetCache).not.toHaveBeenCalled();
  });

  it('returns isOnboarded: true when account is fully onboarded', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'user1' } });
    mockPrismaUserFindUnique.mockResolvedValue({ ...mockUser, isVerifiedSeller: false });
    mockGetOrSetCache.mockResolvedValue(true);
    mockPrismaUserUpdate.mockResolvedValue({});

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isOnboarded).toBe(true);
    expect(body.needsOnboarding).toBe(false);
    expect(body.accountId).toBe('acct_live123');

    // Should mark as verified seller
    expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user1' },
      data: { isVerifiedSeller: true },
    });
  });

  it('does not update isVerifiedSeller if already verified', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'user1' } });
    mockPrismaUserFindUnique.mockResolvedValue({ ...mockUser, isVerifiedSeller: true });
    mockGetOrSetCache.mockResolvedValue(true);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(mockPrismaUserUpdate).not.toHaveBeenCalled();
  });

  it('returns isOnboarded: false when account exists but onboarding incomplete', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'user1' } });
    mockPrismaUserFindUnique.mockResolvedValue(mockUser);
    mockGetOrSetCache.mockResolvedValue(false);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isOnboarded).toBe(false);
    expect(body.needsOnboarding).toBe(true);
    expect(mockPrismaUserUpdate).not.toHaveBeenCalled();
  });

  it('self-heals: resets stale account ID and returns needsOnboarding when resource_missing', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'user1' } });
    mockPrismaUserFindUnique.mockResolvedValue({
      ...mockUser,
      stripeAccountId: 'acct_stale_test',
    });
    mockPrismaUserUpdate.mockResolvedValue({});

    const resourceMissingError = Object.assign(
      new Error('No such account: acct_stale_test'),
      {
        code: 'resource_missing',
      }
    );
    mockGetOrSetCache.mockRejectedValue(resourceMissingError);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.isOnboarded).toBe(false);
    expect(body.needsOnboarding).toBe(true);
    expect(body.accountId).toBeNull();

    expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user1' },
      data: { stripeAccountId: null, isVerifiedSeller: false },
    });
  });

  it('re-throws non-resource_missing errors as 500', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'user1' } });
    mockPrismaUserFindUnique.mockResolvedValue(mockUser);
    mockGetOrSetCache.mockRejectedValue(new Error('Stripe network timeout'));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to check account status');
  });
});
