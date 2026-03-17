import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PayoutRequestRepository } from '../PayoutRequestRepository';

const mockPrisma = {
  payoutRequest: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
} as any;

describe('PayoutRequestRepository', () => {
  let repo: PayoutRequestRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PayoutRequestRepository(mockPrisma);
  });

  describe('create', () => {
    it('should create a payout request with ULID ID', async () => {
      const input = {
        transactionId: 'txn-1',
        sellerId: 'user-1',
        amountCents: 82000,
        commissionCents: 18000,
        payoutMethod: 'paypal',
        payoutEmail: 'seller@paypal.com',
      };

      mockPrisma.payoutRequest.create.mockResolvedValue({
        id: 'some-ulid',
        ...input,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await repo.create(input);

      expect(mockPrisma.payoutRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: expect.any(String),
          transactionId: 'txn-1',
          sellerId: 'user-1',
          amountCents: 82000,
          commissionCents: 18000,
          payoutMethod: 'paypal',
          payoutEmail: 'seller@paypal.com',
        }),
      });
      expect(result.amountCents).toBe(82000);
    });
  });

  describe('findById', () => {
    it('should find payout request with seller info', async () => {
      const request = {
        id: 'ulid-1',
        transactionId: 'txn-1',
        sellerId: 'user-1',
        amountCents: 82000,
        status: 'pending',
        seller: { id: 'user-1', email: 'seller@test.com', username: 'seller1' },
      };

      mockPrisma.payoutRequest.findUnique.mockResolvedValue(request);

      const result = await repo.findById('ulid-1');

      expect(mockPrisma.payoutRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'ulid-1' },
        include: {
          seller: { select: { id: true, email: true, fullName: true, username: true } },
          transaction: { select: { id: true, projectId: true, project: { select: { title: true } } } },
        },
      });
      expect(result).toEqual(request);
    });
  });

  describe('findPending', () => {
    it('should find all pending payout requests', async () => {
      const pending = [
        { id: 'ulid-1', status: 'pending', amountCents: 82000 },
        { id: 'ulid-2', status: 'pending', amountCents: 50000 },
      ];

      mockPrisma.payoutRequest.findMany.mockResolvedValue(pending);

      const result = await repo.findPending();

      expect(mockPrisma.payoutRequest.findMany).toHaveBeenCalledWith({
        where: { status: 'pending' },
        include: {
          seller: { select: { id: true, email: true, fullName: true, username: true } },
          transaction: { select: { id: true, projectId: true, project: { select: { title: true } } } },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('updateStatus', () => {
    it('should update status to completed with processing details', async () => {
      mockPrisma.payoutRequest.update.mockResolvedValue({
        id: 'ulid-1',
        status: 'completed',
        processedAt: new Date(),
      });

      await repo.updateStatus('ulid-1', {
        status: 'completed',
        externalReference: 'PP-BATCH-123',
        batchId: 'batch-1',
        processedAt: new Date(),
      });

      expect(mockPrisma.payoutRequest.update).toHaveBeenCalledWith({
        where: { id: 'ulid-1' },
        data: expect.objectContaining({
          status: 'completed',
          externalReference: 'PP-BATCH-123',
          batchId: 'batch-1',
          processedAt: expect.any(Date),
        }),
      });
    });

    it('should update status to failed with reason', async () => {
      mockPrisma.payoutRequest.update.mockResolvedValue({
        id: 'ulid-1',
        status: 'failed',
        failedReason: 'Invalid PayPal email',
      });

      await repo.updateStatus('ulid-1', {
        status: 'failed',
        failedReason: 'Invalid PayPal email',
      });

      expect(mockPrisma.payoutRequest.update).toHaveBeenCalledWith({
        where: { id: 'ulid-1' },
        data: expect.objectContaining({
          status: 'failed',
          failedReason: 'Invalid PayPal email',
        }),
      });
    });
  });

  describe('listWithFilters', () => {
    it('should list payout requests with status filter and pagination', async () => {
      mockPrisma.payoutRequest.findMany.mockResolvedValue([]);
      mockPrisma.payoutRequest.count.mockResolvedValue(0);

      const result = await repo.listWithFilters({ status: 'pending', page: 1, limit: 20 });

      expect(mockPrisma.payoutRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'pending' },
          skip: 0,
          take: 20,
        })
      );
      expect(result).toEqual({ payoutRequests: [], total: 0, page: 1, limit: 20 });
    });

    it('should list all payout requests when no status filter', async () => {
      mockPrisma.payoutRequest.findMany.mockResolvedValue([]);
      mockPrisma.payoutRequest.count.mockResolvedValue(0);

      await repo.listWithFilters({ page: 2, limit: 10 });

      expect(mockPrisma.payoutRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          skip: 10,
          take: 10,
        })
      );
    });
  });
});
