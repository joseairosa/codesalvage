/**
 * GET /api/transactions Route Tests
 *
 * Verifies the transaction listing endpoint for both buyer and seller views.
 * These tests exist to catch route-level failures that unit tests on
 * TransactionService/TransactionRepository cannot detect (auth wiring,
 * HTTP status codes, response shape, error mapping).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockAuthenticateApiRequest,
  mockGetSellerTransactions,
  mockGetBuyerTransactions,
  MockValidationError,
  MockPermissionError,
} = vi.hoisted(() => {
  class MockValidationError extends Error {
    constructor(
      message: string,
      public field?: string
    ) {
      super(message);
      this.name = 'TransactionValidationError';
    }
  }
  class MockPermissionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'TransactionPermissionError';
    }
  }
  return {
    mockAuthenticateApiRequest: vi.fn(),
    mockGetSellerTransactions: vi.fn(),
    mockGetBuyerTransactions: vi.fn(),
    MockValidationError,
    MockPermissionError,
  };
});

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mockAuthenticateApiRequest,
}));

vi.mock('@/lib/prisma', () => ({ prisma: {} }));

vi.mock('@/lib/middleware/withRateLimit', () => ({
  withApiRateLimit: (handler: any) => handler,
  withPollingRateLimit: (handler: any) => handler,
}));

vi.mock('@/lib/services/TransactionService', () => ({
  TransactionService: vi.fn().mockImplementation(() => ({
    getSellerTransactions: mockGetSellerTransactions,
    getBuyerTransactions: mockGetBuyerTransactions,
  })),
  TransactionValidationError: MockValidationError,
  TransactionPermissionError: MockPermissionError,
  TransactionNotFoundError: class extends Error {},
}));

vi.mock('@/lib/repositories/TransactionRepository', () => ({
  TransactionRepository: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/lib/repositories/UserRepository', () => ({
  UserRepository: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/lib/repositories/ProjectRepository', () => ({
  ProjectRepository: vi.fn().mockImplementation(() => ({})),
}));

import { GET } from '../route';

function makeRequest(params: Record<string, string> = {}) {
  const query = new URLSearchParams(params).toString();
  return new NextRequest(`http://localhost/api/transactions?${query}`);
}

const mockPaginatedResult = {
  transactions: [
    {
      id: 'tx1',
      amountCents: 10000,
      sellerReceivesCents: 8500,
      paymentStatus: 'succeeded',
      escrowStatus: 'held',
      escrowReleaseDate: '2026-03-15T00:00:00Z',
      releasedToSellerAt: null,
      createdAt: '2026-03-08T00:00:00Z',
      project: {
        id: 'proj1',
        title: 'My App',
        description: 'A cool app',
        status: 'sold',
      },
      buyer: { id: 'buyer1', username: 'buyeruser', fullName: 'Buyer User' },
      seller: { id: 'seller1', username: 'selleruser', fullName: 'Seller User' },
    },
  ],
  total: 1,
  page: 1,
  limit: 10,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

describe('GET /api/transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue(null);

    const response = await GET(makeRequest({ view: 'seller' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(mockGetSellerTransactions).not.toHaveBeenCalled();
  });

  describe('view=seller', () => {
    it('returns 200 with seller transactions', async () => {
      mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'seller1' } });
      mockGetSellerTransactions.mockResolvedValue(mockPaginatedResult);

      const response = await GET(makeRequest({ view: 'seller', page: '1', limit: '10' }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.transactions).toHaveLength(1);
      expect(body.transactions[0].id).toBe('tx1');
      expect(body.total).toBe(1);
      expect(body.page).toBe(1);
      expect(body.totalPages).toBe(1);
      expect(body.hasNext).toBe(false);
      expect(body.hasPrev).toBe(false);
      expect(mockGetSellerTransactions).toHaveBeenCalledWith('seller1', {
        page: 1,
        limit: 10,
      });
    });

    it('returns 200 with empty list when seller has no transactions', async () => {
      mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'seller1' } });
      mockGetSellerTransactions.mockResolvedValue({
        transactions: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      });

      const response = await GET(makeRequest({ view: 'seller' }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.transactions).toHaveLength(0);
    });

    it('returns 400 when service throws TransactionValidationError', async () => {
      mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'seller1' } });
      mockGetSellerTransactions.mockRejectedValue(
        new MockValidationError('Seller not found', 'sellerId')
      );

      const response = await GET(makeRequest({ view: 'seller' }));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Seller not found');
    });

    it('returns 500 on unexpected errors', async () => {
      mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'seller1' } });
      mockGetSellerTransactions.mockRejectedValue(new Error('DB connection lost'));

      const response = await GET(makeRequest({ view: 'seller' }));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to fetch transactions');
    });
  });

  describe('view=buyer', () => {
    it('returns 200 with buyer transactions', async () => {
      mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'buyer1' } });
      mockGetBuyerTransactions.mockResolvedValue(mockPaginatedResult);

      const response = await GET(makeRequest({ view: 'buyer', page: '1', limit: '20' }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.transactions).toHaveLength(1);
      expect(mockGetBuyerTransactions).toHaveBeenCalledWith('buyer1', {
        page: 1,
        limit: 20,
      });
    });

    it('returns 200 when view param is absent (defaults to buyer)', async () => {
      mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'buyer1' } });
      mockGetBuyerTransactions.mockResolvedValue({
        transactions: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      });

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.transactions).toHaveLength(0);
      expect(mockGetBuyerTransactions).toHaveBeenCalled();
      expect(mockGetSellerTransactions).not.toHaveBeenCalled();
    });

    it('returns 500 on unexpected errors', async () => {
      mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'buyer1' } });
      mockGetBuyerTransactions.mockRejectedValue(new Error('Unexpected failure'));

      const response = await GET(makeRequest({ view: 'buyer' }));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Failed to fetch transactions');
    });
  });
});
