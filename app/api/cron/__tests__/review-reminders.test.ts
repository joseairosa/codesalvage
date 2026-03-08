/**
 * Review Reminder Cron Route Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockHeadersGet, mockFindMany, mockSendReviewReminder } = vi.hoisted(() => ({
  mockHeadersGet: vi.fn(),
  mockFindMany: vi.fn(),
  mockSendReviewReminder: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({ get: mockHeadersGet }),
}));

vi.mock('@/config/env', () => ({
  env: { CRON_SECRET: 'test-cron-secret' },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    transaction: { findMany: mockFindMany },
  },
}));

vi.mock('@/lib/services', () => ({
  emailService: { sendReviewReminder: mockSendReviewReminder },
}));

import { GET } from '../review-reminders/route';

const makeTransaction = (overrides = {}) => ({
  id: 'txn-1',
  buyer: { email: 'buyer@test.com', fullName: 'Test Buyer', username: 'buyer' },
  seller: { fullName: 'Test Seller', username: 'seller' },
  project: { id: 'proj-1', title: 'Awesome Project' },
  ...overrides,
});

describe('GET /api/cron/review-reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendReviewReminder.mockResolvedValue(undefined);
  });

  it('returns 401 when authorization header is missing', async () => {
    mockHeadersGet.mockReturnValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('returns 401 when authorization header has wrong secret', async () => {
    mockHeadersGet.mockReturnValue('Bearer wrong-secret');

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('returns processed counts when reminders send successfully', async () => {
    mockHeadersGet.mockReturnValue('Bearer test-cron-secret');
    mockFindMany.mockResolvedValue([makeTransaction(), makeTransaction({ id: 'txn-2' })]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.processed).toBe(2);
    expect(body.successful).toBe(2);
    expect(body.failed).toBe(0);
    expect(body.timestamp).toBeDefined();
  });

  it('sends reminder email to buyer with correct data', async () => {
    mockHeadersGet.mockReturnValue('Bearer test-cron-secret');
    mockFindMany.mockResolvedValue([makeTransaction()]);

    await GET();

    expect(mockSendReviewReminder).toHaveBeenCalledWith(
      { email: 'buyer@test.com', name: 'Test Buyer' },
      expect.objectContaining({
        buyerName: 'Test Buyer',
        sellerName: 'Test Seller',
        projectTitle: 'Awesome Project',
        reviewUrl: '/transactions/txn-1/review',
      })
    );
  });

  it('queries with the correct time window and filters', async () => {
    mockHeadersGet.mockReturnValue('Bearer test-cron-secret');
    mockFindMany.mockResolvedValue([]);

    await GET();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          paymentStatus: 'succeeded',
          escrowStatus: 'released',
          review: null,
          escrowReleaseDate: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      })
    );
  });

  it('skips transactions with no buyer email', async () => {
    mockHeadersGet.mockReturnValue('Bearer test-cron-secret');
    mockFindMany.mockResolvedValue([
      makeTransaction({
        buyer: { email: null, fullName: 'No Email', username: 'noemail' },
      }),
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.processed).toBe(1);
    expect(body.successful).toBe(0);
    expect(mockSendReviewReminder).not.toHaveBeenCalled();
  });

  it('counts email failures and continues processing', async () => {
    mockHeadersGet.mockReturnValue('Bearer test-cron-secret');
    mockFindMany.mockResolvedValue([
      makeTransaction({ id: 'txn-1' }),
      makeTransaction({ id: 'txn-2' }),
    ]);
    mockSendReviewReminder
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Email failed'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.successful).toBe(1);
    expect(body.failed).toBe(1);
  });

  it('returns 200 with zero counts when no eligible transactions found', async () => {
    mockHeadersGet.mockReturnValue('Bearer test-cron-secret');
    mockFindMany.mockResolvedValue([]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.processed).toBe(0);
    expect(body.successful).toBe(0);
    expect(body.failed).toBe(0);
    expect(mockSendReviewReminder).not.toHaveBeenCalled();
  });

  it('returns 500 when database query throws', async () => {
    mockHeadersGet.mockReturnValue('Bearer test-cron-secret');
    mockFindMany.mockRejectedValue(new Error('DB connection failed'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Review reminder job failed');
    expect(body.message).toBe('DB connection failed');
  });

  it('falls back to username when fullName is null', async () => {
    mockHeadersGet.mockReturnValue('Bearer test-cron-secret');
    mockFindMany.mockResolvedValue([
      makeTransaction({
        buyer: { email: 'buyer@test.com', fullName: null, username: 'buyeruser' },
        seller: { fullName: null, username: 'selleruser' },
      }),
    ]);

    await GET();

    expect(mockSendReviewReminder).toHaveBeenCalledWith(
      { email: 'buyer@test.com', name: 'buyeruser' },
      expect.objectContaining({
        buyerName: 'buyeruser',
        sellerName: 'selleruser',
      })
    );
  });
});
