/**
 * Admin E2E Seed Transaction Route Tests
 *
 * POST /api/admin/e2e/seed-transaction
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockRequireAdminApiAuth, mockPrismaCreate } = vi.hoisted(() => ({
  mockRequireAdminApiAuth: vi.fn(),
  mockPrismaCreate: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  requireAdminApiAuth: mockRequireAdminApiAuth,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    transaction: { create: mockPrismaCreate },
  },
}));

import { POST } from '../route';

const ADMIN_AUTH = {
  user: { id: 'admin1', isAdmin: true, email: 'admin@example.com' },
};

const VALID_BODY = {
  projectId: 'proj1',
  sellerId: 'seller1',
  buyerId: 'buyer1',
  amountCents: 10000,
};

const MOCK_TRANSACTION = {
  id: 'txn1',
  projectId: 'proj1',
  sellerId: 'seller1',
  buyerId: 'buyer1',
  amountCents: 10000,
  commissionCents: 1800,
  sellerReceivesCents: 8200,
  paymentStatus: 'succeeded',
  escrowStatus: 'released',
  stripePaymentIntentId: 'e2e_pi_test',
  stripeChargeId: 'e2e_ch_test',
  codeDeliveryStatus: 'delivered',
  escrowReleaseDate: new Date(Date.now() - 86400000),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/e2e/seed-transaction', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/admin/e2e/seed-transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when E2E_SEED_ENABLED is not set', async () => {
    const original = process.env['E2E_SEED_ENABLED'];
    delete process.env['E2E_SEED_ENABLED'];
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);

    const req = makePostRequest(VALID_BODY);
    const res = await POST(req);

    expect(res.status).toBe(404);
    if (original !== undefined) process.env['E2E_SEED_ENABLED'] = original;
  });

  it('returns 401 when not authenticated', async () => {
    process.env['E2E_SEED_ENABLED'] = 'true';
    mockRequireAdminApiAuth.mockResolvedValue(null);

    const req = makePostRequest(VALID_BODY);
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('returns 201 with transaction when E2E_SEED_ENABLED is true', async () => {
    process.env['E2E_SEED_ENABLED'] = 'true';
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);
    mockPrismaCreate.mockResolvedValue(MOCK_TRANSACTION);

    const req = makePostRequest(VALID_BODY);
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.transaction.paymentStatus).toBe('succeeded');
    expect(body.transaction.escrowStatus).toBe('released');
  });

  it('returns 400 when required fields are missing', async () => {
    process.env['E2E_SEED_ENABLED'] = 'true';
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);

    const req = makePostRequest({ projectId: 'proj1' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});
