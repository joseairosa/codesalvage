/**
 * Dispute API Route Tests
 *
 * POST /api/transactions/[id]/dispute — open a dispute
 * GET  /api/transactions/[id]/dispute — get dispute status
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockAuthenticateApiRequest,
  mockOpenDispute,
  mockGetDisputeForTransaction,
  MockValidationError,
  MockPermissionError,
} = vi.hoisted(() => {
  class MockValidationError extends Error {
    constructor(
      message: string,
      public field?: string
    ) {
      super(message);
      this.name = 'DisputeValidationError';
    }
  }
  class MockPermissionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'DisputePermissionError';
    }
  }
  return {
    mockAuthenticateApiRequest: vi.fn(),
    mockOpenDispute: vi.fn(),
    mockGetDisputeForTransaction: vi.fn(),
    MockValidationError,
    MockPermissionError,
  };
});

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mockAuthenticateApiRequest,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {},
}));

vi.mock('@/lib/services/DisputeService', () => ({
  DisputeService: vi.fn().mockImplementation(() => ({
    openDispute: mockOpenDispute,
    getDisputeForTransaction: mockGetDisputeForTransaction,
  })),
  DisputeValidationError: MockValidationError,
  DisputePermissionError: MockPermissionError,
}));

vi.mock('@/lib/repositories/DisputeRepository', () => ({
  DisputeRepository: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/lib/repositories/TransactionRepository', () => ({
  TransactionRepository: vi.fn().mockImplementation(() => ({})),
}));

import { POST, GET } from '../route';

function makePostRequest(id: string, body: object) {
  return new NextRequest(`http://localhost/api/transactions/${id}/dispute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(id: string) {
  return new NextRequest(`http://localhost/api/transactions/${id}/dispute`, {
    method: 'GET',
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const validBody = {
  reason: 'description_mismatch',
  description: 'The project code does not match the advertised description at all.',
};

describe('POST /api/transactions/[id]/dispute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue(null);

    const response = await POST(makePostRequest('tx1', validBody), makeParams('tx1'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(mockOpenDispute).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid request body (missing reason)', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'buyer1' } });

    const response = await POST(
      makePostRequest('tx1', {
        description: 'This is a long enough description for the test.',
      }),
      makeParams('tx1')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request');
  });

  it('returns 400 for description shorter than 20 chars', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'buyer1' } });

    const response = await POST(
      makePostRequest('tx1', {
        reason: 'description_mismatch',
        description: 'Too short',
      }),
      makeParams('tx1')
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request');
  });

  it('returns 201 with dispute when successfully opened', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'buyer1' } });
    mockOpenDispute.mockResolvedValue({ id: 'dispute1', status: 'pending' });

    const response = await POST(makePostRequest('tx1', validBody), makeParams('tx1'));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe('dispute1');
    expect(mockOpenDispute).toHaveBeenCalledWith(
      'buyer1',
      'tx1',
      validBody.reason,
      validBody.description
    );
  });

  it('returns 403 when service throws DisputePermissionError', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'seller1' } });
    mockOpenDispute.mockRejectedValue(
      new MockPermissionError('Only the buyer can open a dispute')
    );

    const response = await POST(makePostRequest('tx1', validBody), makeParams('tx1'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Only the buyer can open a dispute');
  });

  it('returns 400 when service throws DisputeValidationError', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'buyer1' } });
    mockOpenDispute.mockRejectedValue(
      new MockValidationError('A dispute has already been filed for this transaction')
    );

    const response = await POST(makePostRequest('tx1', validBody), makeParams('tx1'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('A dispute has already been filed for this transaction');
  });

  it('returns 500 on unexpected errors', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'buyer1' } });
    mockOpenDispute.mockRejectedValue(new Error('Unexpected DB error'));

    const response = await POST(makePostRequest('tx1', validBody), makeParams('tx1'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to open dispute');
  });
});

describe('GET /api/transactions/[id]/dispute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue(null);

    const response = await GET(makeGetRequest('tx1'), makeParams('tx1'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 200 with dispute when found', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'buyer1' } });
    mockGetDisputeForTransaction.mockResolvedValue({ id: 'dispute1', status: 'pending' });

    const response = await GET(makeGetRequest('tx1'), makeParams('tx1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.dispute.id).toBe('dispute1');
    expect(mockGetDisputeForTransaction).toHaveBeenCalledWith('buyer1', 'tx1');
  });

  it('returns 200 with null dispute when none exists', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'buyer1' } });
    mockGetDisputeForTransaction.mockResolvedValue(null);

    const response = await GET(makeGetRequest('tx1'), makeParams('tx1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.dispute).toBeNull();
  });

  it('returns 403 when service throws DisputePermissionError', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'random-user' } });
    mockGetDisputeForTransaction.mockRejectedValue(
      new MockPermissionError('Access denied')
    );

    const response = await GET(makeGetRequest('tx1'), makeParams('tx1'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Access denied');
  });

  it('returns 500 on unexpected errors', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'buyer1' } });
    mockGetDisputeForTransaction.mockRejectedValue(new Error('DB error'));

    const response = await GET(makeGetRequest('tx1'), makeParams('tx1'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to get dispute');
  });
});
