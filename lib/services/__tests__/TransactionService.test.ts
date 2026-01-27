/**
 * TransactionService Unit Tests
 *
 * Tests all business logic for transaction operations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TransactionService,
  TransactionValidationError,
  TransactionPermissionError,
  TransactionNotFoundError,
} from '../TransactionService';
import type { TransactionRepository } from '../../repositories/TransactionRepository';
import type { UserRepository } from '../../repositories/UserRepository';
import type { ProjectRepository } from '../../repositories/ProjectRepository';

// Mock repositories
const mockTransactionRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByBuyerId: vi.fn(),
  findBySellerId: vi.fn(),
  findByProjectId: vi.fn(),
  updatePaymentStatus: vi.fn(),
  updateEscrowStatus: vi.fn(),
  releaseEscrow: vi.fn(),
  markCodeAccessed: vi.fn(),
  findByStripePaymentIntentId: vi.fn(),
} as unknown as TransactionRepository;

const mockUserRepository = {
  findById: vi.fn(),
} as unknown as UserRepository;

const mockProjectRepository = {
  findById: vi.fn(),
} as unknown as ProjectRepository;

// Helper to create mock user
const createMockUser = (overrides = {}) => ({
  id: 'user123',
  email: 'user@example.com',
  username: 'testuser',
  fullName: 'Test User',
  avatarUrl: null,
  isSeller: false,
  isBuyer: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// Helper to create mock project
const createMockProject = (overrides = {}) => ({
  id: 'project456',
  sellerId: 'seller789',
  title: 'Test Project',
  description: 'Test description',
  status: 'active',
  priceCents: 10000,
  category: 'web_app',
  completionPercentage: 100,
  ...overrides,
});

// Helper to create mock transaction
const createMockTransaction = (overrides = {}) => ({
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
  escrowReleaseDate: new Date(),
  releasedToSellerAt: null,
  codeDeliveryStatus: 'delivered',
  codeZipUrl: 'https://r2.dev/code.zip',
  codeAccessedAt: null,
  githubAccessGrantedAt: null,
  notes: null,
  createdAt: new Date(),
  completedAt: null,
  project: {
    id: 'project456',
    title: 'Test Project',
    description: 'Test description',
    thumbnailImageUrl: null,
    priceCents: 10000,
    status: 'active',
  },
  seller: {
    id: 'seller789',
    username: 'seller_user',
    fullName: 'Seller Name',
    avatarUrl: null,
    stripeAccountId: 'acct_123',
  },
  buyer: {
    id: 'buyer012',
    username: 'buyer_user',
    fullName: 'Buyer Name',
    avatarUrl: null,
  },
  review: null,
  ...overrides,
});

describe('TransactionService', () => {
  let transactionService: TransactionService;

  beforeEach(() => {
    vi.clearAllMocks();
    transactionService = new TransactionService(
      mockTransactionRepository,
      mockUserRepository,
      mockProjectRepository
    );
  });

  describe('createTransaction', () => {
    it('should create a new transaction', async () => {
      const mockBuyer = createMockUser({ id: 'buyer012' });
      const mockProject = createMockProject();
      const mockTransaction = createMockTransaction();

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockBuyer as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        mockProject as any
      );
      vi.mocked(mockTransactionRepository.findByProjectId).mockResolvedValue({
        transactions: [],
        total: 0,
        page: 1,
        limit: 100,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      });
      vi.mocked(mockTransactionRepository.create).mockResolvedValue(
        mockTransaction as any
      );

      const result = await transactionService.createTransaction('buyer012', {
        projectId: 'project456',
      });

      expect(result).toEqual(mockTransaction);
      expect(mockTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project456',
          sellerId: 'seller789',
          buyerId: 'buyer012',
          amountCents: 10000,
          commissionCents: 1800,
          sellerReceivesCents: 8200,
        })
      );
    });

    it('should throw error if buyer not found', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      await expect(
        transactionService.createTransaction('buyer012', { projectId: 'project456' })
      ).rejects.toThrow(TransactionValidationError);
      await expect(
        transactionService.createTransaction('buyer012', { projectId: 'project456' })
      ).rejects.toThrow('Buyer not found');
    });

    it('should throw error if project not found', async () => {
      const mockBuyer = createMockUser();
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockBuyer as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      await expect(
        transactionService.createTransaction('buyer012', { projectId: 'project456' })
      ).rejects.toThrow(TransactionValidationError);
      await expect(
        transactionService.createTransaction('buyer012', { projectId: 'project456' })
      ).rejects.toThrow('Project not found');
    });

    it('should throw error if project is not active', async () => {
      const mockBuyer = createMockUser();
      const mockProject = createMockProject({ status: 'draft' });
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockBuyer as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        mockProject as any
      );

      await expect(
        transactionService.createTransaction('buyer012', { projectId: 'project456' })
      ).rejects.toThrow(TransactionValidationError);
      await expect(
        transactionService.createTransaction('buyer012', { projectId: 'project456' })
      ).rejects.toThrow('Project is not available for purchase');
    });

    it('should throw error if buyer is the seller', async () => {
      const mockBuyer = createMockUser({ id: 'seller789' });
      const mockProject = createMockProject({ sellerId: 'seller789' });
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockBuyer as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        mockProject as any
      );

      await expect(
        transactionService.createTransaction('seller789', { projectId: 'project456' })
      ).rejects.toThrow(TransactionPermissionError);
      await expect(
        transactionService.createTransaction('seller789', { projectId: 'project456' })
      ).rejects.toThrow('Cannot purchase your own project');
    });

    it('should throw error if buyer already purchased this project', async () => {
      const mockBuyer = createMockUser({ id: 'buyer012' });
      const mockProject = createMockProject();
      const existingTransaction = createMockTransaction({
        buyerId: 'buyer012',
        paymentStatus: 'succeeded',
      });

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockBuyer as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        mockProject as any
      );
      vi.mocked(mockTransactionRepository.findByProjectId).mockResolvedValue({
        transactions: [existingTransaction],
        total: 1,
        page: 1,
        limit: 100,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });

      await expect(
        transactionService.createTransaction('buyer012', { projectId: 'project456' })
      ).rejects.toThrow(TransactionValidationError);
      await expect(
        transactionService.createTransaction('buyer012', { projectId: 'project456' })
      ).rejects.toThrow('You have already purchased this project');
    });

    it('should calculate commission correctly (18%)', async () => {
      const mockBuyer = createMockUser({ id: 'buyer012' });
      const mockProject = createMockProject({ priceCents: 10000 });
      const mockTransaction = createMockTransaction();

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockBuyer as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        mockProject as any
      );
      vi.mocked(mockTransactionRepository.findByProjectId).mockResolvedValue({
        transactions: [],
        total: 0,
        page: 1,
        limit: 100,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      });
      vi.mocked(mockTransactionRepository.create).mockResolvedValue(
        mockTransaction as any
      );

      await transactionService.createTransaction('buyer012', {
        projectId: 'project456',
      });

      expect(mockTransactionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCents: 10000,
          commissionCents: 1800, // 18% of 10000
          sellerReceivesCents: 8200, // 10000 - 1800
        })
      );
    });
  });

  describe('getBuyerTransactions', () => {
    it('should get buyer transactions', async () => {
      const mockBuyer = createMockUser();
      const mockTransactions = {
        transactions: [createMockTransaction()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockBuyer as any);
      vi.mocked(mockTransactionRepository.findByBuyerId).mockResolvedValue(
        mockTransactions
      );

      const result = await transactionService.getBuyerTransactions('buyer012');

      expect(result).toEqual(mockTransactions);
      expect(mockTransactionRepository.findByBuyerId).toHaveBeenCalledWith(
        'buyer012',
        undefined
      );
    });

    it('should throw error if buyer not found', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      await expect(
        transactionService.getBuyerTransactions('buyer012')
      ).rejects.toThrow(TransactionValidationError);
      await expect(
        transactionService.getBuyerTransactions('buyer012')
      ).rejects.toThrow('Buyer not found');
    });
  });

  describe('getSellerTransactions', () => {
    it('should get seller transactions', async () => {
      const mockSeller = createMockUser();
      const mockTransactions = {
        transactions: [createMockTransaction()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockSeller as any);
      vi.mocked(mockTransactionRepository.findBySellerId).mockResolvedValue(
        mockTransactions
      );

      const result = await transactionService.getSellerTransactions('seller789');

      expect(result).toEqual(mockTransactions);
      expect(mockTransactionRepository.findBySellerId).toHaveBeenCalledWith(
        'seller789',
        undefined
      );
    });

    it('should throw error if seller not found', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      await expect(
        transactionService.getSellerTransactions('seller789')
      ).rejects.toThrow(TransactionValidationError);
      await expect(
        transactionService.getSellerTransactions('seller789')
      ).rejects.toThrow('Seller not found');
    });
  });

  describe('getTransactionById', () => {
    it('should get transaction if user is buyer', async () => {
      const mockTransaction = createMockTransaction({ buyerId: 'buyer012' });
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(
        mockTransaction as any
      );

      const result = await transactionService.getTransactionById(
        'transaction123',
        'buyer012'
      );

      expect(result).toEqual(mockTransaction);
    });

    it('should get transaction if user is seller', async () => {
      const mockTransaction = createMockTransaction({ sellerId: 'seller789' });
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(
        mockTransaction as any
      );

      const result = await transactionService.getTransactionById(
        'transaction123',
        'seller789'
      );

      expect(result).toEqual(mockTransaction);
    });

    it('should throw error if transaction not found', async () => {
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(null);

      await expect(
        transactionService.getTransactionById('transaction123', 'user123')
      ).rejects.toThrow(TransactionNotFoundError);
      await expect(
        transactionService.getTransactionById('transaction123', 'user123')
      ).rejects.toThrow('Transaction not found');
    });

    it('should throw error if user is not buyer or seller', async () => {
      const mockTransaction = createMockTransaction({
        buyerId: 'buyer012',
        sellerId: 'seller789',
      });
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(
        mockTransaction as any
      );

      await expect(
        transactionService.getTransactionById('transaction123', 'other_user')
      ).rejects.toThrow(TransactionPermissionError);
      await expect(
        transactionService.getTransactionById('transaction123', 'other_user')
      ).rejects.toThrow('You do not have access to this transaction');
    });
  });

  describe('isUserBuyerOrSeller', () => {
    it('should return true if user is buyer', async () => {
      const mockTransaction = createMockTransaction({ buyerId: 'buyer012' });
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(
        mockTransaction as any
      );

      const result = await transactionService.isUserBuyerOrSeller(
        'transaction123',
        'buyer012'
      );

      expect(result).toBe(true);
    });

    it('should return true if user is seller', async () => {
      const mockTransaction = createMockTransaction({ sellerId: 'seller789' });
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(
        mockTransaction as any
      );

      const result = await transactionService.isUserBuyerOrSeller(
        'transaction123',
        'seller789'
      );

      expect(result).toBe(true);
    });

    it('should return false if user is neither buyer nor seller', async () => {
      const mockTransaction = createMockTransaction();
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(
        mockTransaction as any
      );

      const result = await transactionService.isUserBuyerOrSeller(
        'transaction123',
        'other_user'
      );

      expect(result).toBe(false);
    });

    it('should return false if transaction not found', async () => {
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(null);

      const result = await transactionService.isUserBuyerOrSeller(
        'transaction123',
        'user123'
      );

      expect(result).toBe(false);
    });
  });

  describe('validateUserIsBuyer', () => {
    it('should return true if user is buyer', async () => {
      const mockTransaction = createMockTransaction({ buyerId: 'buyer012' });
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(
        mockTransaction as any
      );

      const result = await transactionService.validateUserIsBuyer(
        'transaction123',
        'buyer012'
      );

      expect(result).toBe(true);
    });

    it('should throw error if transaction not found', async () => {
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(null);

      await expect(
        transactionService.validateUserIsBuyer('transaction123', 'buyer012')
      ).rejects.toThrow(TransactionNotFoundError);
    });

    it('should throw error if user is not buyer', async () => {
      const mockTransaction = createMockTransaction({ buyerId: 'buyer012' });
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(
        mockTransaction as any
      );

      await expect(
        transactionService.validateUserIsBuyer('transaction123', 'seller789')
      ).rejects.toThrow(TransactionPermissionError);
      await expect(
        transactionService.validateUserIsBuyer('transaction123', 'seller789')
      ).rejects.toThrow('Only the buyer can perform this action');
    });
  });

  describe('hasPaymentSucceeded', () => {
    it('should return true if payment succeeded', async () => {
      const mockTransaction = createMockTransaction({ paymentStatus: 'succeeded' });
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(
        mockTransaction as any
      );

      const result = await transactionService.hasPaymentSucceeded('transaction123');

      expect(result).toBe(true);
    });

    it('should return false if payment not succeeded', async () => {
      const mockTransaction = createMockTransaction({ paymentStatus: 'pending' });
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(
        mockTransaction as any
      );

      const result = await transactionService.hasPaymentSucceeded('transaction123');

      expect(result).toBe(false);
    });

    it('should throw error if transaction not found', async () => {
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(null);

      await expect(
        transactionService.hasPaymentSucceeded('transaction123')
      ).rejects.toThrow(TransactionNotFoundError);
    });
  });

  describe('releaseEscrow', () => {
    it('should release escrow for valid transaction', async () => {
      const mockTransaction = createMockTransaction({
        paymentStatus: 'succeeded',
        escrowStatus: 'held',
      });
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(
        mockTransaction as any
      );
      vi.mocked(mockTransactionRepository.releaseEscrow).mockResolvedValue(
        mockTransaction as any
      );

      await transactionService.releaseEscrow('transaction123');

      expect(mockTransactionRepository.releaseEscrow).toHaveBeenCalledWith(
        'transaction123'
      );
    });

    it('should skip if escrow already released', async () => {
      const mockTransaction = createMockTransaction({ escrowStatus: 'released' });
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(
        mockTransaction as any
      );

      await transactionService.releaseEscrow('transaction123');

      expect(mockTransactionRepository.releaseEscrow).not.toHaveBeenCalled();
    });

    it('should throw error if payment not succeeded', async () => {
      const mockTransaction = createMockTransaction({
        paymentStatus: 'pending',
        escrowStatus: 'held',
      });
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(
        mockTransaction as any
      );

      await expect(
        transactionService.releaseEscrow('transaction123')
      ).rejects.toThrow(TransactionValidationError);
      await expect(
        transactionService.releaseEscrow('transaction123')
      ).rejects.toThrow('Cannot release escrow for unsuccessful payment');
    });

    it('should throw error if transaction not found', async () => {
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(null);

      await expect(
        transactionService.releaseEscrow('transaction123')
      ).rejects.toThrow(TransactionNotFoundError);
    });
  });

  describe('markCodeAccessed', () => {
    it('should mark code as accessed by buyer', async () => {
      const mockTransaction = createMockTransaction({
        buyerId: 'buyer012',
        paymentStatus: 'succeeded',
      });
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(
        mockTransaction as any
      );
      vi.mocked(mockTransactionRepository.markCodeAccessed).mockResolvedValue(
        mockTransaction as any
      );

      await transactionService.markCodeAccessed('transaction123', 'buyer012');

      expect(mockTransactionRepository.markCodeAccessed).toHaveBeenCalledWith(
        'transaction123'
      );
    });

    it('should throw error if user is not buyer', async () => {
      const mockTransaction = createMockTransaction({ buyerId: 'buyer012' });
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(
        mockTransaction as any
      );

      await expect(
        transactionService.markCodeAccessed('transaction123', 'seller789')
      ).rejects.toThrow(TransactionPermissionError);
      await expect(
        transactionService.markCodeAccessed('transaction123', 'seller789')
      ).rejects.toThrow('Only the buyer can access the code');
    });

    it('should throw error if payment not succeeded', async () => {
      const mockTransaction = createMockTransaction({
        buyerId: 'buyer012',
        paymentStatus: 'pending',
      });
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(
        mockTransaction as any
      );

      await expect(
        transactionService.markCodeAccessed('transaction123', 'buyer012')
      ).rejects.toThrow(TransactionValidationError);
      await expect(
        transactionService.markCodeAccessed('transaction123', 'buyer012')
      ).rejects.toThrow('Code cannot be accessed before successful payment');
    });

    it('should throw error if transaction not found', async () => {
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(null);

      await expect(
        transactionService.markCodeAccessed('transaction123', 'buyer012')
      ).rejects.toThrow(TransactionNotFoundError);
    });
  });
});
