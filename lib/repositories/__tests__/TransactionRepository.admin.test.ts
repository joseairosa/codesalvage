/**
 * TransactionRepository Admin Methods Tests
 *
 * Test suite for admin-specific TransactionRepository methods.
 *
 * Test Coverage:
 * - getAllTransactions()
 * - countAllTransactions()
 * - releaseEscrowManually()
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaClient, Transaction } from '@prisma/client';
import { TransactionRepository } from '../TransactionRepository';

// Mock Prisma Client
const mockPrisma = {
  transaction: {
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
} as unknown as PrismaClient;

describe('TransactionRepository - Admin Methods', () => {
  let transactionRepo: TransactionRepository;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create fresh instance
    transactionRepo = new TransactionRepository(mockPrisma);
  });

  describe('getAllTransactions()', () => {
    it('should return all transactions with default pagination', async () => {
      // Arrange
      const mockTransactions = [
        {
          id: 'tx1',
          amountCents: 50000,
          paymentStatus: 'succeeded',
          escrowStatus: 'held',
          project: { id: 'proj1', title: 'Project 1' },
          seller: { id: 'seller1', username: 'seller1' },
          buyer: { id: 'buyer1', username: 'buyer1' },
          review: null,
        },
        {
          id: 'tx2',
          amountCents: 75000,
          paymentStatus: 'succeeded',
          escrowStatus: 'released',
          project: { id: 'proj2', title: 'Project 2' },
          seller: { id: 'seller2', username: 'seller2' },
          buyer: { id: 'buyer2', username: 'buyer2' },
          review: null,
        },
      ];

      (mockPrisma.transaction.findMany as any).mockResolvedValue(mockTransactions);

      // Act
      const result = await transactionRepo.getAllTransactions();

      // Assert
      expect(result).toEqual(mockTransactions);
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith({
        where: {},
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
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
              email: true,
              fullName: true,
              avatarUrl: true,
              isVerifiedSeller: true,
              stripeAccountId: true,
            },
          },
          buyer: {
            select: {
              id: true,
              username: true,
              email: true,
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

    it('should filter transactions by paymentStatus', async () => {
      // Arrange
      (mockPrisma.transaction.findMany as any).mockResolvedValue([]);

      // Act
      await transactionRepo.getAllTransactions({
        paymentStatus: 'succeeded',
      });

      // Assert
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { paymentStatus: 'succeeded' },
        })
      );
    });

    it('should filter transactions by escrowStatus', async () => {
      // Arrange
      (mockPrisma.transaction.findMany as any).mockResolvedValue([]);

      // Act
      await transactionRepo.getAllTransactions({
        escrowStatus: 'held',
      });

      // Assert
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { escrowStatus: 'held' },
        })
      );
    });

    it('should filter transactions by sellerId', async () => {
      // Arrange
      (mockPrisma.transaction.findMany as any).mockResolvedValue([]);

      // Act
      await transactionRepo.getAllTransactions({
        sellerId: 'seller123',
      });

      // Assert
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sellerId: 'seller123' },
        })
      );
    });

    it('should filter transactions by buyerId', async () => {
      // Arrange
      (mockPrisma.transaction.findMany as any).mockResolvedValue([]);

      // Act
      await transactionRepo.getAllTransactions({
        buyerId: 'buyer123',
      });

      // Assert
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { buyerId: 'buyer123' },
        })
      );
    });

    it('should filter transactions by projectId', async () => {
      // Arrange
      (mockPrisma.transaction.findMany as any).mockResolvedValue([]);

      // Act
      await transactionRepo.getAllTransactions({
        projectId: 'proj123',
      });

      // Assert
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'proj123' },
        })
      );
    });

    it('should apply multiple filters simultaneously', async () => {
      // Arrange
      (mockPrisma.transaction.findMany as any).mockResolvedValue([]);

      // Act
      await transactionRepo.getAllTransactions({
        paymentStatus: 'succeeded',
        escrowStatus: 'held',
        sellerId: 'seller123',
      });

      // Assert
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            paymentStatus: 'succeeded',
            escrowStatus: 'held',
            sellerId: 'seller123',
          },
        })
      );
    });

    it('should support custom pagination', async () => {
      // Arrange
      (mockPrisma.transaction.findMany as any).mockResolvedValue([]);

      // Act
      await transactionRepo.getAllTransactions({
        limit: 20,
        offset: 40,
      });

      // Assert
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 40,
        })
      );
    });

    it('should support custom sorting by amountCents', async () => {
      // Arrange
      (mockPrisma.transaction.findMany as any).mockResolvedValue([]);

      // Act
      await transactionRepo.getAllTransactions({
        sortBy: 'amountCents',
        sortOrder: 'asc',
      });

      // Assert
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { amountCents: 'asc' },
        })
      );
    });

    it('should support custom sorting by escrowReleaseDate', async () => {
      // Arrange
      (mockPrisma.transaction.findMany as any).mockResolvedValue([]);

      // Act
      await transactionRepo.getAllTransactions({
        sortBy: 'escrowReleaseDate',
        sortOrder: 'desc',
      });

      // Assert
      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { escrowReleaseDate: 'desc' },
        })
      );
    });

    it('should throw error if query fails', async () => {
      // Arrange
      (mockPrisma.transaction.findMany as any).mockRejectedValue(
        new Error('Database error')
      );

      // Act & Assert
      await expect(transactionRepo.getAllTransactions()).rejects.toThrow(
        '[TransactionRepository] Failed to get all transactions'
      );
    });
  });

  describe('countAllTransactions()', () => {
    it('should count all transactions when no filters provided', async () => {
      // Arrange
      (mockPrisma.transaction.count as any).mockResolvedValue(500);

      // Act
      const result = await transactionRepo.countAllTransactions();

      // Assert
      expect(result).toBe(500);
      expect(mockPrisma.transaction.count).toHaveBeenCalledWith({
        where: {},
      });
    });

    it('should count transactions filtered by paymentStatus', async () => {
      // Arrange
      (mockPrisma.transaction.count as any).mockResolvedValue(425);

      // Act
      const result = await transactionRepo.countAllTransactions({
        paymentStatus: 'succeeded',
      });

      // Assert
      expect(result).toBe(425);
      expect(mockPrisma.transaction.count).toHaveBeenCalledWith({
        where: { paymentStatus: 'succeeded' },
      });
    });

    it('should count transactions filtered by escrowStatus', async () => {
      // Arrange
      (mockPrisma.transaction.count as any).mockResolvedValue(150);

      // Act
      const result = await transactionRepo.countAllTransactions({
        escrowStatus: 'held',
      });

      // Assert
      expect(result).toBe(150);
      expect(mockPrisma.transaction.count).toHaveBeenCalledWith({
        where: { escrowStatus: 'held' },
      });
    });

    it('should count transactions filtered by sellerId', async () => {
      // Arrange
      (mockPrisma.transaction.count as any).mockResolvedValue(25);

      // Act
      const result = await transactionRepo.countAllTransactions({
        sellerId: 'seller123',
      });

      // Assert
      expect(result).toBe(25);
      expect(mockPrisma.transaction.count).toHaveBeenCalledWith({
        where: { sellerId: 'seller123' },
      });
    });

    it('should count transactions filtered by buyerId', async () => {
      // Arrange
      (mockPrisma.transaction.count as any).mockResolvedValue(12);

      // Act
      const result = await transactionRepo.countAllTransactions({
        buyerId: 'buyer123',
      });

      // Assert
      expect(result).toBe(12);
      expect(mockPrisma.transaction.count).toHaveBeenCalledWith({
        where: { buyerId: 'buyer123' },
      });
    });

    it('should count transactions filtered by projectId', async () => {
      // Arrange
      (mockPrisma.transaction.count as any).mockResolvedValue(8);

      // Act
      const result = await transactionRepo.countAllTransactions({
        projectId: 'proj123',
      });

      // Assert
      expect(result).toBe(8);
      expect(mockPrisma.transaction.count).toHaveBeenCalledWith({
        where: { projectId: 'proj123' },
      });
    });

    it('should apply multiple filters', async () => {
      // Arrange
      (mockPrisma.transaction.count as any).mockResolvedValue(42);

      // Act
      const result = await transactionRepo.countAllTransactions({
        paymentStatus: 'succeeded',
        escrowStatus: 'released',
        sellerId: 'seller123',
      });

      // Assert
      expect(result).toBe(42);
      expect(mockPrisma.transaction.count).toHaveBeenCalledWith({
        where: {
          paymentStatus: 'succeeded',
          escrowStatus: 'released',
          sellerId: 'seller123',
        },
      });
    });

    it('should return zero when no transactions match filters', async () => {
      // Arrange
      (mockPrisma.transaction.count as any).mockResolvedValue(0);

      // Act
      const result = await transactionRepo.countAllTransactions({
        paymentStatus: 'refunded',
      });

      // Assert
      expect(result).toBe(0);
    });

    it('should throw error if count fails', async () => {
      // Arrange
      (mockPrisma.transaction.count as any).mockRejectedValue(
        new Error('Connection timeout')
      );

      // Act & Assert
      await expect(transactionRepo.countAllTransactions()).rejects.toThrow(
        '[TransactionRepository] Failed to count transactions'
      );
    });
  });

  describe('releaseEscrowManually()', () => {
    it('should release escrow and set release date', async () => {
      // Arrange
      const transactionId = 'tx123';

      const mockReleasedTransaction: Partial<Transaction> = {
        id: transactionId,
        amountCents: 50000,
        escrowStatus: 'released',
        escrowReleaseDate: expect.any(Date),
      };

      (mockPrisma.transaction.update as any).mockResolvedValue(mockReleasedTransaction);

      // Act
      const result = await transactionRepo.releaseEscrowManually(transactionId);

      // Assert
      expect(result).toEqual(mockReleasedTransaction);
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: transactionId },
        data: {
          escrowStatus: 'released',
          escrowReleaseDate: expect.any(Date),
        },
      });
    });

    it('should set escrowReleaseDate to current time', async () => {
      // Arrange
      const transactionId = 'tx123';
      const beforeTime = new Date();

      const mockTransaction: Partial<Transaction> = {
        id: transactionId,
        escrowStatus: 'released',
        escrowReleaseDate: new Date(),
      };

      (mockPrisma.transaction.update as any).mockResolvedValue(mockTransaction);

      // Act
      await transactionRepo.releaseEscrowManually(transactionId);

      // Assert
      const call = (mockPrisma.transaction.update as any).mock.calls[0][0];
      const releaseDate = call.data.escrowReleaseDate as Date;
      const afterTime = new Date();

      expect(releaseDate.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(releaseDate.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should throw error if transaction not found', async () => {
      // Arrange
      const transactionId = 'invalid';

      (mockPrisma.transaction.update as any).mockRejectedValue(
        new Error('Record to update not found')
      );

      // Act & Assert
      await expect(transactionRepo.releaseEscrowManually(transactionId)).rejects.toThrow(
        '[TransactionRepository] Failed to release escrow manually'
      );
    });

    it('should throw error if database update fails', async () => {
      // Arrange
      (mockPrisma.transaction.update as any).mockRejectedValue(
        new Error('Connection timeout')
      );

      // Act & Assert
      await expect(transactionRepo.releaseEscrowManually('tx123')).rejects.toThrow(
        '[TransactionRepository] Failed to release escrow manually'
      );
    });

    it('should work even if escrow was already released', async () => {
      // Arrange
      const transactionId = 'tx123';

      const mockTransaction: Partial<Transaction> = {
        id: transactionId,
        escrowStatus: 'released',
        escrowReleaseDate: new Date(),
      };

      (mockPrisma.transaction.update as any).mockResolvedValue(mockTransaction);

      // Act
      const result = await transactionRepo.releaseEscrowManually(transactionId);

      // Assert
      expect(result.escrowStatus).toBe('released');
      expect(result.escrowReleaseDate).toBeInstanceOf(Date);
    });
  });
});
