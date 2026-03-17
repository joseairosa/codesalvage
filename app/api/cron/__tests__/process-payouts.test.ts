import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockProcessBatch } = vi.hoisted(() => ({
  mockProcessBatch: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/services', () => ({ emailService: {} }));
vi.mock('@/lib/services/PayoutService', () => ({
  PayoutService: vi.fn().mockImplementation(() => ({
    processBatch: mockProcessBatch,
  })),
}));
vi.mock('@/config/env', () => ({
  env: { CRON_SECRET: 'test-secret' },
}));
vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

import { headers } from 'next/headers';
import { GET } from '../../cron/process-payouts/route';

const mockHeaders = headers as ReturnType<typeof vi.fn>;

describe('GET /api/cron/process-payouts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 without valid auth header', async () => {
    mockHeaders.mockResolvedValue({
      get: () => null,
    });

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('should return 401 with wrong secret', async () => {
    mockHeaders.mockResolvedValue({
      get: () => 'Bearer wrong-secret',
    });

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('should process batch and return results on success', async () => {
    mockHeaders.mockResolvedValue({
      get: () => 'Bearer test-secret',
    });
    mockProcessBatch.mockResolvedValue({
      processed: 3,
      successful: 2,
      failed: 1,
      batchId: 'CS-test-batch',
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.processed).toBe(3);
    expect(data.successful).toBe(2);
    expect(data.failed).toBe(1);
    expect(data.batchId).toBe('CS-test-batch');
    expect(mockProcessBatch).toHaveBeenCalledOnce();
  });

  it('should return 500 when batch processing fails', async () => {
    mockHeaders.mockResolvedValue({
      get: () => 'Bearer test-secret',
    });
    mockProcessBatch.mockRejectedValue(new Error('PayPal API down'));

    const response = await GET();
    expect(response.status).toBe(500);
  });
});
