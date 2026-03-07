/**
 * DisputeRepository Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { DisputeRepository } from '../DisputeRepository';

const mockPrismaClient = {
  dispute: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
} as unknown as PrismaClient;

describe('DisputeRepository', () => {
  let repo: DisputeRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new DisputeRepository(mockPrismaClient);
  });

  describe('create', () => {
    it('should create a dispute with generated ULID', async () => {
      const input = {
        transactionId: 'tx1',
        buyerId: 'buyer1',
        reason: 'description_mismatch',
        description: 'The code does not match the description.',
      };

      vi.mocked(mockPrismaClient.dispute.create).mockResolvedValue({
        id: 'ulid123',
        ...input,
        status: 'pending',
        resolution: null,
        resolvedBy: null,
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await repo.create(input);

      expect(mockPrismaClient.dispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            transactionId: 'tx1',
            buyerId: 'buyer1',
            reason: 'description_mismatch',
            description: 'The code does not match the description.',
            status: 'pending',
          }),
        })
      );
      expect(result.status).toBe('pending');
    });
  });

  describe('findByTransactionId', () => {
    it('should return dispute for a transaction', async () => {
      vi.mocked(mockPrismaClient.dispute.findUnique).mockResolvedValue({
        id: 'ulid123',
        transactionId: 'tx1',
        status: 'pending',
      } as any);

      const result = await repo.findByTransactionId('tx1');

      expect(mockPrismaClient.dispute.findUnique).toHaveBeenCalledWith({
        where: { transactionId: 'tx1' },
      });
      expect(result?.status).toBe('pending');
    });

    it('should return null when no dispute exists', async () => {
      vi.mocked(mockPrismaClient.dispute.findUnique).mockResolvedValue(null);

      const result = await repo.findByTransactionId('tx-no-dispute');
      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should update status and set resolvedAt for resolved statuses', async () => {
      vi.mocked(mockPrismaClient.dispute.update).mockResolvedValue({
        id: 'ulid123',
        status: 'resolved_refund',
        resolvedAt: new Date(),
      } as any);

      await repo.updateStatus(
        'ulid123',
        'resolved_refund',
        'Full refund approved',
        'admin1'
      );

      expect(mockPrismaClient.dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ulid123' },
          data: expect.objectContaining({
            status: 'resolved_refund',
            resolution: 'Full refund approved',
            resolvedBy: 'admin1',
            resolvedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should not set resolvedAt for non-resolved status updates', async () => {
      vi.mocked(mockPrismaClient.dispute.update).mockResolvedValue({
        id: 'ulid123',
        status: 'reviewing',
      } as any);

      await repo.updateStatus('ulid123', 'reviewing');

      const call = vi.mocked(mockPrismaClient.dispute.update).mock.calls[0]![0] as any;
      expect(call.data).not.toHaveProperty('resolvedAt');
    });
  });
});
