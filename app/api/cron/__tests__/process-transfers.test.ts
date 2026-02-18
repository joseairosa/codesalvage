/**
 * Process Transfers Cron Route Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockHeadersGet, mockProcessAutoTransfers } = vi.hoisted(() => ({
  mockHeadersGet: vi.fn(),
  mockProcessAutoTransfers: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({ get: mockHeadersGet }),
}));

vi.mock('@/config/env', () => ({
  env: { CRON_SECRET: 'test-cron-secret' },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {},
}));

vi.mock('@/lib/services/RepositoryTransferService', () => ({
  RepositoryTransferService: vi.fn().mockImplementation(() => ({
    processAutoTransfers: mockProcessAutoTransfers,
  })),
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

import { GET } from '../process-transfers/route';

describe('GET /api/cron/process-transfers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when authorization header is missing', async () => {
    mockHeadersGet.mockReturnValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(mockProcessAutoTransfers).not.toHaveBeenCalled();
  });

  it('should return 401 when authorization header has wrong secret', async () => {
    mockHeadersGet.mockReturnValue('Bearer wrong-secret');

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(mockProcessAutoTransfers).not.toHaveBeenCalled();
  });

  it('should call processAutoTransfers and return processed count on success', async () => {
    mockHeadersGet.mockReturnValue('Bearer test-cron-secret');
    mockProcessAutoTransfers.mockResolvedValue({ processed: 3 });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ processed: 3 });
    expect(mockProcessAutoTransfers).toHaveBeenCalledTimes(1);
  });

  it('should return 500 when processAutoTransfers throws', async () => {
    mockHeadersGet.mockReturnValue('Bearer test-cron-secret');
    mockProcessAutoTransfers.mockRejectedValue(new Error('DB failure'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBeDefined();
  });
});
