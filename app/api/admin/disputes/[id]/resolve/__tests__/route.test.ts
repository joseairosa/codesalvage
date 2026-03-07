/**
 * Admin Dispute Resolve API Route Tests
 *
 * PATCH /api/admin/disputes/[id]/resolve
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockRequireAdminApiAuth,
  mockUpdateStatus,
  mockReleaseEscrowManually,
  mockRefundTransaction,
  mockSendDisputeResolvedNotification,
  mockPrismaDisputeFindUnique,
} = vi.hoisted(() => ({
  mockRequireAdminApiAuth: vi.fn(),
  mockUpdateStatus: vi.fn(),
  mockReleaseEscrowManually: vi.fn(),
  mockRefundTransaction: vi.fn(),
  mockSendDisputeResolvedNotification: vi.fn(),
  mockPrismaDisputeFindUnique: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  requireAdminApiAuth: mockRequireAdminApiAuth,
}));

vi.mock('@/lib/utils/admin-services', () => ({
  getDisputeRepository: vi.fn(() => ({ updateStatus: mockUpdateStatus })),
  getAdminService: vi.fn(() => ({
    releaseEscrowManually: mockReleaseEscrowManually,
    refundTransaction: mockRefundTransaction,
  })),
}));

vi.mock('@/lib/services/EmailService', () => ({
  emailService: {
    sendDisputeResolvedNotification: mockSendDisputeResolvedNotification,
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    dispute: { findUnique: mockPrismaDisputeFindUnique },
  },
}));

import { PATCH } from '../route';

const ADMIN_AUTH = { user: { id: 'admin1', isAdmin: true, email: 'admin@example.com' } };

const MOCK_DISPUTE = {
  id: 'dispute1',
  transactionId: 'tx1',
  reason: 'code_not_functional',
  description: 'Nothing works at all',
  status: 'pending',
  transaction: {
    id: 'tx1',
    amountCents: 9900,
    buyer: {
      id: 'buyer1',
      email: 'buyer@example.com',
      fullName: 'Buyer One',
      username: 'buyer',
    },
    seller: {
      id: 'seller1',
      email: 'seller@example.com',
      fullName: 'Seller One',
      username: 'seller',
    },
    project: { id: 'proj1', title: 'My Project' },
  },
};

const RESOLVED_DISPUTE = {
  ...MOCK_DISPUTE,
  status: 'resolved_refund',
  resolution: 'Full refund issued after review',
};

function makeRequest(id: string, body: object) {
  return new NextRequest(`http://localhost/api/admin/disputes/${id}/resolve`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  status: 'resolved_refund',
  resolution: 'Full refund issued after thorough review',
  action: 'issue_refund',
};

describe('PATCH /api/admin/disputes/[id]/resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendDisputeResolvedNotification.mockResolvedValue(undefined);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(null);

    const res = await PATCH(makeRequest('dispute1', VALID_BODY), {
      params: Promise.resolve({ id: 'dispute1' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);

    const res = await PATCH(
      makeRequest('dispute1', { status: 'invalid', resolution: 'x', action: 'none' }),
      {
        params: Promise.resolve({ id: 'dispute1' }),
      }
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid request');
  });

  it('returns 400 when resolution notes too short', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);

    const res = await PATCH(
      makeRequest('dispute1', {
        status: 'resolved_no_refund',
        resolution: 'short',
        action: 'none',
      }),
      { params: Promise.resolve({ id: 'dispute1' }) }
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when dispute not found', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);
    mockPrismaDisputeFindUnique.mockResolvedValue(null);

    const res = await PATCH(makeRequest('nonexistent', VALID_BODY), {
      params: Promise.resolve({ id: 'nonexistent' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Dispute not found');
  });

  it('resolves with issue_refund action and returns 200', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);
    mockPrismaDisputeFindUnique.mockResolvedValue(MOCK_DISPUTE);
    mockRefundTransaction.mockResolvedValue({ id: 'tx1' });
    mockUpdateStatus.mockResolvedValue(RESOLVED_DISPUTE);

    const res = await PATCH(makeRequest('dispute1', VALID_BODY), {
      params: Promise.resolve({ id: 'dispute1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dispute.status).toBe('resolved_refund');
    expect(mockRefundTransaction).toHaveBeenCalledWith(
      'admin1',
      'tx1',
      expect.stringContaining('dispute1'),
      undefined
    );
    expect(mockUpdateStatus).toHaveBeenCalledWith(
      'dispute1',
      'resolved_refund',
      VALID_BODY.resolution,
      'admin1'
    );
  });

  it('resolves with release_escrow action', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);
    mockPrismaDisputeFindUnique.mockResolvedValue(MOCK_DISPUTE);
    mockReleaseEscrowManually.mockResolvedValue({ id: 'tx1' });
    mockUpdateStatus.mockResolvedValue({
      ...RESOLVED_DISPUTE,
      status: 'resolved_no_refund',
    });

    const body = {
      status: 'resolved_no_refund',
      resolution: 'Seller fulfilled obligations',
      action: 'release_escrow',
    };
    const res = await PATCH(makeRequest('dispute1', body), {
      params: Promise.resolve({ id: 'dispute1' }),
    });
    expect(res.status).toBe(200);
    expect(mockReleaseEscrowManually).toHaveBeenCalled();
    expect(mockRefundTransaction).not.toHaveBeenCalled();
  });

  it('resolves with none action (no escrow change)', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);
    mockPrismaDisputeFindUnique.mockResolvedValue(MOCK_DISPUTE);
    mockUpdateStatus.mockResolvedValue({
      ...RESOLVED_DISPUTE,
      status: 'resolved_partial',
    });

    const body = {
      status: 'resolved_partial',
      resolution: 'Partial credit agreed manually',
      action: 'none',
    };
    const res = await PATCH(makeRequest('dispute1', body), {
      params: Promise.resolve({ id: 'dispute1' }),
    });
    expect(res.status).toBe(200);
    expect(mockReleaseEscrowManually).not.toHaveBeenCalled();
    expect(mockRefundTransaction).not.toHaveBeenCalled();
  });

  it('sends resolution emails to buyer and seller', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);
    mockPrismaDisputeFindUnique.mockResolvedValue(MOCK_DISPUTE);
    mockRefundTransaction.mockResolvedValue({ id: 'tx1' });
    mockUpdateStatus.mockResolvedValue(RESOLVED_DISPUTE);

    await PATCH(makeRequest('dispute1', VALID_BODY), {
      params: Promise.resolve({ id: 'dispute1' }),
    });

    // Emails are fire-and-forget, give microtasks time to run
    await new Promise((r) => setTimeout(r, 0));
    expect(mockSendDisputeResolvedNotification).toHaveBeenCalledTimes(2);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);
    mockPrismaDisputeFindUnique.mockRejectedValue(new Error('DB error'));

    const res = await PATCH(makeRequest('dispute1', VALID_BODY), {
      params: Promise.resolve({ id: 'dispute1' }),
    });
    expect(res.status).toBe(500);
  });
});
