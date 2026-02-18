/**
 * Transfer Ownership Route Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockAuthenticateApiRequest,
  mockTransferOwnership,
  MockPermissionError,
  MockNotFoundError,
  MockValidationError,
} = vi.hoisted(() => {
  class MockPermissionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'RepositoryTransferPermissionError';
    }
  }
  class MockNotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'RepositoryTransferNotFoundError';
    }
  }
  class MockValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'RepositoryTransferValidationError';
    }
  }
  return {
    mockAuthenticateApiRequest: vi.fn(),
    mockTransferOwnership: vi.fn(),
    MockPermissionError,
    MockNotFoundError,
    MockValidationError,
  };
});

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mockAuthenticateApiRequest,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {},
}));

vi.mock('@/lib/services/RepositoryTransferService', () => ({
  RepositoryTransferService: vi.fn().mockImplementation(() => ({
    transferOwnership: mockTransferOwnership,
  })),
  RepositoryTransferPermissionError: MockPermissionError,
  RepositoryTransferNotFoundError: MockNotFoundError,
  RepositoryTransferValidationError: MockValidationError,
}));

vi.mock('@/lib/repositories/RepositoryTransferRepository', () => ({
  RepositoryTransferRepository: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/lib/repositories/TransactionRepository', () => ({
  TransactionRepository: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/lib/services/GitHubService', () => ({
  githubService: {},
}));

vi.mock('@/lib/services/NotificationService', () => ({
  NotificationService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/lib/repositories/NotificationRepository', () => ({
  NotificationRepository: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/lib/middleware/withRateLimit', () => ({
  withApiRateLimit: (handler: any) => handler,
}));

import { POST } from '../route';

function makeRequest(id: string) {
  return new NextRequest(`http://localhost/api/transactions/${id}/transfer-ownership`, {
    method: 'POST',
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/transactions/[id]/transfer-ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when request is not authenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue(null);

    const response = await POST(makeRequest('txn-123'), makeParams('txn-123'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(mockTransferOwnership).not.toHaveBeenCalled();
  });

  it('should return 403 when service throws PermissionError', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'user-456' } });
    mockTransferOwnership.mockRejectedValue(
      new MockPermissionError('Only the seller can initiate a transfer')
    );

    const response = await POST(makeRequest('txn-123'), makeParams('txn-123'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  it('should return 200 with success result when transfer succeeds', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'seller-123' } });
    mockTransferOwnership.mockResolvedValue({ success: true });

    const response = await POST(makeRequest('txn-123'), makeParams('txn-123'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.transactionId).toBe('txn-123');
    expect(mockTransferOwnership).toHaveBeenCalledWith('txn-123', 'seller-123');
  });

  it('should return 200 with skipped result when transfer is skipped', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'seller-123' } });
    mockTransferOwnership.mockResolvedValue({
      success: false,
      skipped: true,
      reason: 'Already processed',
    });

    const response = await POST(makeRequest('txn-123'), makeParams('txn-123'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.transactionId).toBe('txn-123');
  });

  it('should return 404 when service throws NotFoundError', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'seller-123' } });
    mockTransferOwnership.mockRejectedValue(
      new MockNotFoundError('Transaction not found')
    );

    const response = await POST(makeRequest('txn-123'), makeParams('txn-123'));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBeDefined();
  });

  it('should return 500 on unexpected errors', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'seller-123' } });
    mockTransferOwnership.mockRejectedValue(new Error('Unexpected DB error'));

    const response = await POST(makeRequest('txn-123'), makeParams('txn-123'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBeDefined();
  });
});
