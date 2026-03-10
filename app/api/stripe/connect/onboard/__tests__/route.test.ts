/**
 * POST /api/stripe/connect/onboard — Route Tests
 *
 * Covers:
 * - 401 when unauthenticated
 * - 404 when user not found
 * - Creates new Connect account when none stored
 * - Uses existing account ID when one is stored
 * - Self-healing: resets stale account ID (resource_missing) and creates fresh account
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockAuthenticateApiRequest,
  mockPrismaUserFindUnique,
  mockPrismaUserUpdate,
  mockCreateConnectAccount,
  mockCreateAccountLink,
} = vi.hoisted(() => ({
  mockAuthenticateApiRequest: vi.fn(),
  mockPrismaUserFindUnique: vi.fn(),
  mockPrismaUserUpdate: vi.fn(),
  mockCreateConnectAccount: vi.fn(),
  mockCreateAccountLink: vi.fn(),
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
    createConnectAccount: mockCreateConnectAccount,
    createAccountLink: mockCreateAccountLink,
  },
}));

vi.mock('@/config/env', () => ({
  env: { NEXT_PUBLIC_APP_URL: 'https://codesalvage.com' },
}));

import { POST } from '../route';

function makeRequest() {
  return new Request('http://localhost/api/stripe/connect/onboard', {
    method: 'POST',
  });
}

const mockUser = {
  id: 'user1',
  email: 'seller@example.com',
  fullName: 'Seller User',
  stripeAccountId: null,
  isSeller: true,
};

describe('POST /api/stripe/connect/onboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue(null);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(mockPrismaUserFindUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when user not found', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'user1' } });
    mockPrismaUserFindUnique.mockResolvedValue(null);

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('User not found');
  });

  it('creates new Connect account when none stored', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'user1' } });
    mockPrismaUserFindUnique.mockResolvedValue({ ...mockUser, stripeAccountId: null });
    mockCreateConnectAccount.mockResolvedValue('acct_new123');
    mockPrismaUserUpdate.mockResolvedValue({});
    mockCreateAccountLink.mockResolvedValue('https://connect.stripe.com/onboard/acct_new123');

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe('https://connect.stripe.com/onboard/acct_new123');
    expect(body.accountId).toBe('acct_new123');
    expect(mockCreateConnectAccount).toHaveBeenCalledWith({
      id: 'user1',
      email: 'seller@example.com',
      fullName: 'Seller User',
    });
    expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user1' },
      data: { stripeAccountId: 'acct_new123', isSeller: true },
    });
  });

  it('uses existing account ID when one is already stored', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'user1' } });
    mockPrismaUserFindUnique.mockResolvedValue({ ...mockUser, stripeAccountId: 'acct_existing' });
    mockCreateAccountLink.mockResolvedValue('https://connect.stripe.com/onboard/acct_existing');

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe('https://connect.stripe.com/onboard/acct_existing');
    expect(body.accountId).toBe('acct_existing');
    expect(mockCreateConnectAccount).not.toHaveBeenCalled();
  });

  it('self-heals: resets stale account ID and creates fresh account when resource_missing', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'user1' } });
    mockPrismaUserFindUnique.mockResolvedValue({ ...mockUser, stripeAccountId: 'acct_stale_test' });

    const resourceMissingError = Object.assign(new Error('No such account: acct_stale_test'), {
      code: 'resource_missing',
    });
    mockCreateAccountLink
      .mockRejectedValueOnce(resourceMissingError)
      .mockResolvedValueOnce('https://connect.stripe.com/onboard/acct_fresh');

    mockCreateConnectAccount.mockResolvedValue('acct_fresh');
    mockPrismaUserUpdate.mockResolvedValue({});

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe('https://connect.stripe.com/onboard/acct_fresh');
    expect(body.accountId).toBe('acct_fresh');

    // First update: clears the stale account
    expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user1' },
      data: { stripeAccountId: null, isVerifiedSeller: false },
    });

    // Second update: saves the new account
    expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user1' },
      data: { stripeAccountId: 'acct_fresh', isSeller: true },
    });
  });

  it('re-throws non-resource_missing Stripe errors', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'user1' } });
    mockPrismaUserFindUnique.mockResolvedValue({ ...mockUser, stripeAccountId: 'acct_existing' });
    mockCreateAccountLink.mockRejectedValue(new Error('Stripe network error'));

    const res = await POST(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to create onboarding link');
  });
});
