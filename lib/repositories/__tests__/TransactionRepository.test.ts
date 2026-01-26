/**
 * TransactionRepository Unit Tests
 *
 * Tests all database operations for transactions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  TransactionRepository,
  CreateTransactionInput,
  TransactionWithRelations,
} from '../TransactionRepository';

// Mock Prisma Client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    transaction: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const mockPrismaClient = {
  transaction: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
} as unknown as PrismaClient;

// Helper to create mock transaction with relations
const createMockTransactionWithRelations = (
  overrides: Partial<TransactionWithRelations> = {}
): TransactionWithRelations => ({
  id: 'transaction123',
  projectId: 'project456',
  sellerId: 'seller789',
  buyerId: 'buyer012',
  amountCents: 10000,
  commissionCents: 1800,
  sellerReceivesCents: 8200,
  stripePaymentIntentId: 'pi_123',
  stripeChargeId: 'ch_123',
  paymentStatus: 'succeeded',
  escrowStatus: 'held',
  escrowReleaseDate: new Date('2026-02-02'),
  releasedToSellerAt: null,
  codeDeliveryStatus: 'delivered',
  codeZipUrl: 'https://r2.dev/code.zip',
  codeAccessedAt: null,
  githubAccessGrantedAt: null,
  notes: null,
  createdAt: new Date('2026-01-26'),
  completedAt: null,
  project: {
    id: 'project456',
    title: 'E-commerce Platform',
    description: 'Full-stack e-commerce solution',
    thumbnailImageUrl: 'https://example.com/thumb.jpg',
    priceCents: 10000,
    status: 'active',
  },
  seller: {
    id: 'seller789',
    username: 'seller_user',
    fullName: 'Seller Name',
    avatarUrl: 'https://example.com/seller.jpg',
    stripeAccountId: 'acct_123',
  },
  buyer: {
    id: 'buyer012',
    username: 'buyer_user',
    fullName: 'Buyer Name',
    avatarUrl: 'https://example.com/buyer.jpg',
  },
  review: null,
  ...overrides,
});

describe('TransactionRepository', () => {
  let transactionRepository: TransactionRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    transactionRepository = new TransactionRepository(mockPrismaClient);
  });

  describe('findById', () => {
    it('should find transaction by ID with relations', async () => {
      const mockTransaction = createMockTransactionWithRelations();
      vi.mocked(mockPrismaClient.transaction.findUnique).mockResolvedValue(
        mockTransaction as any
      );

      const result = await transactionRepository.findById('transaction123');

      expect(result).toEqual(mockTransaction);
      expect(mockPrismaClient.transaction.findUnique).toHaveBeenCalledWith({
        where: { id: 'transaction123' },
        include: {
          project: {
            select: {
              id: true,
              title: true,
              description: true,
              thumbnailImageUrl: true,
              priceCents: true,
              status: true,
            },
          },
          seller: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
              stripeAccountId: true,
            },
          },
          buyer: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          review: {
            select: {
              id: true,
              overallRating: true,
              comment: true,
              createdAt: true,
            },
          },
        },
      });
    });

    it('should return null when transaction not found', async () => {
      vi.mocked(mockPrismaClient.transaction.findUnique).mockResolvedValue(null);

      const result = await transactionRepository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      vi.mocked(mockPrismaClient.transaction.findUnique).mockRejectedValue(
        new Error('Database error')
      );

      await expect(transactionRepository.findById('transaction123')).rejects.toThrow(
        '[TransactionRepository] Failed to find transaction by ID'
      );
    });
  });

  describe('findByBuyerId', () => {
    it('should find transactions by buyer ID with default pagination', async () => {
      const mockTransactions = [createMockTransactionWithRelations()];
      vi.mocked(mockPrismaClient.transaction.findMany).mockResolvedValue(
        mockTransactions as any
      );
      vi.mocked(mockPrismaClient.transaction.count).mockResolvedValue(1);

      const result = await transactionRepository.findByBuyerId('buyer012');

      expect(result.transactions).toEqual(mockTransactions);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(false);
    });

    it('should find transactions by buyer ID with custom pagination', async () => {
      const mockTransactions = [createMockTransactionWithRelations()];
      vi.mocked(mockPrismaClient.transaction.findMany).mockResolvedValue(
        mockTransactions as any
      );
      vi.mocked(mockPrismaClient.transaction.count).mockResolvedValue(25);

      const result = await transactionRepository.findByBuyerId('buyer012', {
        page: 2,
        limit: 10,
      });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(result.hasNext).toBe(true);
      expect(result.hasPrev).toBe(true);
      expect(mockPrismaClient.transaction.findMany).toHaveBeenCalledWith({
        where: { buyerId: 'buyer012' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      });
    });

    it('should throw error on database failure', async () => {
      vi.mocked(mockPrismaClient.transaction.findMany).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        transactionRepository.findByBuyerId('buyer012')
      ).rejects.toThrow('[TransactionRepository] Failed to find transactions by buyer');
    });
  });

  describe('findBySellerId', () => {
    it('should find transactions by seller ID with default pagination', async () => {
      const mockTransactions = [createMockTransactionWithRelations()];
      vi.mocked(mockPrismaClient.transaction.findMany).mockResolvedValue(
        mockTransactions as any
      );
      vi.mocked(mockPrismaClient.transaction.count).mockResolvedValue(1);

      const result = await transactionRepository.findBySellerId('seller789');

      expect(result.transactions).toEqual(mockTransactions);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should find transactions by seller ID with custom pagination', async () => {
      const mockTransactions = [createMockTransactionWithRelations()];
      vi.mocked(mockPrismaClient.transaction.findMany).mockResolvedValue(
        mockTransactions as any
      );
      vi.mocked(mockPrismaClient.transaction.count).mockResolvedValue(30);

      const result = await transactionRepository.findBySellerId('seller789', {
        page: 3,
        limit: 5,
      });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(5);
      expect(result.totalPages).toBe(6);
      expect(mockPrismaClient.transaction.findMany).toHaveBeenCalledWith({
        where: { sellerId: 'seller789' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 5,
      });
    });

    it('should throw error on database failure', async () => {
      vi.mocked(mockPrismaClient.transaction.findMany).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        transactionRepository.findBySellerId('seller789')
      ).rejects.toThrow('[TransactionRepository] Failed to find transactions by seller');
    });
  });

  describe('findByProjectId', () => {
    it('should find transactions by project ID with pagination', async () => {
      const mockTransactions = [createMockTransactionWithRelations()];
      vi.mocked(mockPrismaClient.transaction.findMany).mockResolvedValue(
        mockTransactions as any
      );
      vi.mocked(mockPrismaClient.transaction.count).mockResolvedValue(1);

      const result = await transactionRepository.findByProjectId('project456');

      expect(result.transactions).toEqual(mockTransactions);
      expect(result.total).toBe(1);
      expect(mockPrismaClient.transaction.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project456' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    it('should throw error on database failure', async () => {
      vi.mocked(mockPrismaClient.transaction.findMany).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        transactionRepository.findByProjectId('project456')
      ).rejects.toThrow('[TransactionRepository] Failed to find transactions by project');
    });
  });

  describe('create', () => {
    it('should create a new transaction', async () => {
      const mockTransaction = createMockTransactionWithRelations();
      vi.mocked(mockPrismaClient.transaction.create).mockResolvedValue(
        mockTransaction as any
      );

      const input: CreateTransactionInput = {
        projectId: 'project456',
        sellerId: 'seller789',
        buyerId: 'buyer012',
        amountCents: 10000,
        commissionCents: 1800,
        sellerReceivesCents: 8200,
        stripePaymentIntentId: 'pi_123',
        escrowReleaseDate: new Date('2026-02-02'),
      };

      const result = await transactionRepository.create(input);

      expect(result).toEqual(mockTransaction);
      expect(mockPrismaClient.transaction.create).toHaveBeenCalledWith({
        data: {
          projectId: input.projectId,
          sellerId: input.sellerId,
          buyerId: input.buyerId,
          amountCents: input.amountCents,
          commissionCents: input.commissionCents,
          sellerReceivesCents: input.sellerReceivesCents,
          stripePaymentIntentId: input.stripePaymentIntentId,
          escrowReleaseDate: input.escrowReleaseDate,
          notes: input.notes,
        },
        include: expect.any(Object),
      });
    });

    it('should create transaction with optional fields', async () => {
      const mockTransaction = createMockTransactionWithRelations();
      vi.mocked(mockPrismaClient.transaction.create).mockResolvedValue(
        mockTransaction as any
      );

      const input: CreateTransactionInput = {
        projectId: 'project456',
        sellerId: 'seller789',
        buyerId: 'buyer012',
        amountCents: 10000,
        commissionCents: 1800,
        sellerReceivesCents: 8200,
        notes: 'Test transaction',
      };

      await transactionRepository.create(input);

      expect(mockPrismaClient.transaction.create).toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      vi.mocked(mockPrismaClient.transaction.create).mockRejectedValue(
        new Error('Database error')
      );

      const input: CreateTransactionInput = {
        projectId: 'project456',
        sellerId: 'seller789',
        buyerId: 'buyer012',
        amountCents: 10000,
        commissionCents: 1800,
        sellerReceivesCents: 8200,
      };

      await expect(transactionRepository.create(input)).rejects.toThrow(
        '[TransactionRepository] Failed to create transaction'
      );
    });
  });

  describe('updatePaymentStatus', () => {
    it('should update payment status', async () => {
      const mockTransaction = createMockTransactionWithRelations({
        paymentStatus: 'succeeded',
      });
      vi.mocked(mockPrismaClient.transaction.update).mockResolvedValue(
        mockTransaction as any
      );

      const result = await transactionRepository.updatePaymentStatus(
        'transaction123',
        'succeeded'
      );

      expect(result.paymentStatus).toBe('succeeded');
      expect(mockPrismaClient.transaction.update).toHaveBeenCalledWith({
        where: { id: 'transaction123' },
        data: { paymentStatus: 'succeeded' },
      });
    });

    it('should throw error on database failure', async () => {
      vi.mocked(mockPrismaClient.transaction.update).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        transactionRepository.updatePaymentStatus('transaction123', 'succeeded')
      ).rejects.toThrow('[TransactionRepository] Failed to update payment status');
    });
  });

  describe('updateEscrowStatus', () => {
    it('should update escrow status', async () => {
      const mockTransaction = createMockTransactionWithRelations({
        escrowStatus: 'released',
      });
      vi.mocked(mockPrismaClient.transaction.update).mockResolvedValue(
        mockTransaction as any
      );

      const result = await transactionRepository.updateEscrowStatus(
        'transaction123',
        'released'
      );

      expect(result.escrowStatus).toBe('released');
      expect(mockPrismaClient.transaction.update).toHaveBeenCalledWith({
        where: { id: 'transaction123' },
        data: { escrowStatus: 'released' },
      });
    });

    it('should throw error on database failure', async () => {
      vi.mocked(mockPrismaClient.transaction.update).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        transactionRepository.updateEscrowStatus('transaction123', 'released')
      ).rejects.toThrow('[TransactionRepository] Failed to update escrow status');
    });
  });

  describe('releaseEscrow', () => {
    it('should release escrow and set timestamp', async () => {
      const mockTransaction = createMockTransactionWithRelations({
        escrowStatus: 'released',
        releasedToSellerAt: new Date(),
      });
      vi.mocked(mockPrismaClient.transaction.update).mockResolvedValue(
        mockTransaction as any
      );

      const result = await transactionRepository.releaseEscrow('transaction123');

      expect(result.escrowStatus).toBe('released');
      expect(result.releasedToSellerAt).toBeTruthy();
      expect(mockPrismaClient.transaction.update).toHaveBeenCalledWith({
        where: { id: 'transaction123' },
        data: {
          escrowStatus: 'released',
          releasedToSellerAt: expect.any(Date),
        },
      });
    });

    it('should throw error on database failure', async () => {
      vi.mocked(mockPrismaClient.transaction.update).mockRejectedValue(
        new Error('Database error')
      );

      await expect(transactionRepository.releaseEscrow('transaction123')).rejects.toThrow(
        '[TransactionRepository] Failed to release escrow'
      );
    });
  });

  describe('updateCodeDeliveryStatus', () => {
    it('should update code delivery status', async () => {
      const mockTransaction = createMockTransactionWithRelations({
        codeDeliveryStatus: 'accessed',
      });
      vi.mocked(mockPrismaClient.transaction.update).mockResolvedValue(
        mockTransaction as any
      );

      const result = await transactionRepository.updateCodeDeliveryStatus(
        'transaction123',
        'accessed'
      );

      expect(result.codeDeliveryStatus).toBe('accessed');
      expect(mockPrismaClient.transaction.update).toHaveBeenCalledWith({
        where: { id: 'transaction123' },
        data: { codeDeliveryStatus: 'accessed' },
      });
    });

    it('should throw error on database failure', async () => {
      vi.mocked(mockPrismaClient.transaction.update).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        transactionRepository.updateCodeDeliveryStatus('transaction123', 'accessed')
      ).rejects.toThrow(
        '[TransactionRepository] Failed to update code delivery status'
      );
    });
  });

  describe('markCodeAccessed', () => {
    it('should mark code as accessed with timestamp', async () => {
      const mockTransaction = createMockTransactionWithRelations({
        codeAccessedAt: new Date(),
        codeDeliveryStatus: 'accessed',
      });
      vi.mocked(mockPrismaClient.transaction.update).mockResolvedValue(
        mockTransaction as any
      );

      const result = await transactionRepository.markCodeAccessed('transaction123');

      expect(result.codeAccessedAt).toBeTruthy();
      expect(result.codeDeliveryStatus).toBe('accessed');
      expect(mockPrismaClient.transaction.update).toHaveBeenCalledWith({
        where: { id: 'transaction123' },
        data: {
          codeAccessedAt: expect.any(Date),
          codeDeliveryStatus: 'accessed',
        },
      });
    });

    it('should throw error on database failure', async () => {
      vi.mocked(mockPrismaClient.transaction.update).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        transactionRepository.markCodeAccessed('transaction123')
      ).rejects.toThrow('[TransactionRepository] Failed to mark code as accessed');
    });
  });

  describe('findByStripePaymentIntentId', () => {
    it('should find transaction by Stripe Payment Intent ID', async () => {
      const mockTransaction = createMockTransactionWithRelations();
      vi.mocked(mockPrismaClient.transaction.findUnique).mockResolvedValue(
        mockTransaction as any
      );

      const result = await transactionRepository.findByStripePaymentIntentId('pi_123');

      expect(result).toEqual(mockTransaction);
      expect(mockPrismaClient.transaction.findUnique).toHaveBeenCalledWith({
        where: { stripePaymentIntentId: 'pi_123' },
        include: expect.any(Object),
      });
    });

    it('should return null when transaction not found', async () => {
      vi.mocked(mockPrismaClient.transaction.findUnique).mockResolvedValue(null);

      const result =
        await transactionRepository.findByStripePaymentIntentId('pi_nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on database failure', async () => {
      vi.mocked(mockPrismaClient.transaction.findUnique).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        transactionRepository.findByStripePaymentIntentId('pi_123')
      ).rejects.toThrow(
        '[TransactionRepository] Failed to find transaction by Stripe Payment Intent ID'
      );
    });
  });
});
