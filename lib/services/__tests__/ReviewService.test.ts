/**
 * ReviewService Unit Tests
 *
 * Tests validation logic, permission checks, and business rules
 * for review operations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ReviewService,
  ReviewValidationError,
  ReviewPermissionError,
  ReviewNotFoundError,
} from '../ReviewService';
import type { ReviewRepository } from '@/lib/repositories/ReviewRepository';
import type { UserRepository } from '@/lib/repositories/UserRepository';

const mockReviewRepository: ReviewRepository = {
  create: vi.fn(),
  findByTransactionId: vi.fn(),
  getSellerReviews: vi.fn(),
  getBuyerReviews: vi.fn(),
  getSellerRatingStats: vi.fn(),
  updateSellerAnalytics: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
} as any;

const mockUserRepository: UserRepository = {
  findById: vi.fn(),
  findByEmail: vi.fn(),
  findByGitHubId: vi.fn(),
  createUser: vi.fn(),
  updateUserProfile: vi.fn(),
  deleteUser: vi.fn(),
  getVerifiedSellers: vi.fn(),
  updateStripeAccount: vi.fn(),
} as any;

const mockTransactionRepository = {
  findById: vi.fn(),
};

const mockEmailService = {
  sendNewReviewNotification: vi.fn().mockResolvedValue(undefined),
};

const createMockUser = (id: string) => ({
  id,
  username: `user${id}`,
  email: `user${id}@example.com`,
  fullName: `User ${id}`,
  avatarUrl: `https://avatar.com/${id}.jpg`,
  isSeller: id.includes('seller'),
  isBuyer: id.includes('buyer'),
});

const createMockTransaction = (overrides = {}) => ({
  id: 'txn123',
  buyerId: 'buyer123',
  sellerId: 'seller123',
  projectId: 'project123',
  paymentStatus: 'succeeded',
  amountCents: 50000,
  ...overrides,
});

const createMockReview = (overrides = {}) => ({
  id: 'review123',
  transactionId: 'txn123',
  sellerId: 'seller123',
  buyerId: 'buyer123',
  overallRating: 5,
  comment: 'Excellent work!',
  codeQualityRating: 5,
  documentationRating: 5,
  responsivenessRating: 5,
  accuracyRating: 5,
  isAnonymous: false,
  helpfulCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  buyer: createMockUser('buyer123'),
  transaction: {
    id: 'txn123',
    projectId: 'project123',
    project: { id: 'project123', title: 'Test Project' },
  },
  ...overrides,
});

describe('ReviewService', () => {
  let reviewService: ReviewService;

  beforeEach(() => {
    vi.clearAllMocks();

    reviewService = new ReviewService(
      mockReviewRepository,
      mockUserRepository,
      mockTransactionRepository,
      mockEmailService
    );
  });


  describe('createReview', () => {
    const buyerId = 'buyer123';

    const validReviewData = {
      transactionId: 'txn123',
      overallRating: 5,
      comment: 'Excellent work!',
      codeQualityRating: 5,
    };

    beforeEach(() => {
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(
        createMockTransaction()
      );

      vi.mocked(mockUserRepository.findById)
        .mockResolvedValueOnce(createMockUser('buyer123') as any)
        .mockResolvedValueOnce(createMockUser('seller123') as any)
        .mockResolvedValueOnce(createMockUser('seller123') as any);

      vi.mocked(mockReviewRepository.findByTransactionId).mockResolvedValue(null);

      vi.mocked(mockReviewRepository.updateSellerAnalytics).mockResolvedValue({} as any);
    });

    it('should create review with valid data', async () => {
      const mockReview = createMockReview(validReviewData);
      vi.mocked(mockReviewRepository.create).mockResolvedValue(mockReview as any);

      const result = await reviewService.createReview(buyerId, validReviewData);

      expect(result).toEqual(mockReview);
      expect(mockReviewRepository.create).toHaveBeenCalledWith({
        transactionId: validReviewData.transactionId,
        sellerId: 'seller123',
        buyerId,
        overallRating: validReviewData.overallRating,
        comment: validReviewData.comment,
        codeQualityRating: validReviewData.codeQualityRating,
        documentationRating: null,
        responsivenessRating: null,
        accuracyRating: null,
        isAnonymous: false,
      });
    });

    it('should create review with only required fields', async () => {
      const minimalData = {
        transactionId: 'txn123',
        overallRating: 4,
      };

      const mockReview = createMockReview(minimalData);
      vi.mocked(mockReviewRepository.create).mockResolvedValue(mockReview as any);

      const result = await reviewService.createReview(buyerId, minimalData);

      expect(result).toBeDefined();
      expect(mockReviewRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          overallRating: 4,
          comment: null,
        })
      );
    });

    it('should trim comment before saving', async () => {
      const dataWithSpaces = {
        ...validReviewData,
        comment: '  Great work!  ',
      };

      const mockReview = createMockReview();
      vi.mocked(mockReviewRepository.create).mockResolvedValue(mockReview as any);

      await reviewService.createReview(buyerId, dataWithSpaces);

      expect(mockReviewRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          comment: 'Great work!',
        })
      );
    });

    it('should update seller analytics after review created', async () => {
      const mockReview = createMockReview();
      vi.mocked(mockReviewRepository.create).mockResolvedValue(mockReview as any);

      await reviewService.createReview(buyerId, validReviewData);

      expect(mockReviewRepository.updateSellerAnalytics).toHaveBeenCalledWith(
        'seller123'
      );
    });

    it('should send email notification after review created', async () => {
      const mockReview = createMockReview();
      vi.mocked(mockReviewRepository.create).mockResolvedValue(mockReview as any);

      await reviewService.createReview(buyerId, validReviewData);

      expect(mockEmailService.sendNewReviewNotification).toHaveBeenCalledWith(
        mockReview,
        {
          email: 'userseller123@example.com',
          fullName: 'User seller123',
          username: 'userseller123',
        }
      );
    });

    it('should not throw if email notification fails', async () => {
      const mockReview = createMockReview();
      vi.mocked(mockReviewRepository.create).mockResolvedValue(mockReview as any);
      vi.mocked(mockEmailService.sendNewReviewNotification).mockRejectedValue(
        new Error('Email service down')
      );

      await expect(
        reviewService.createReview(buyerId, validReviewData)
      ).resolves.toBeDefined();
    });

    it('should reject missing transaction ID', async () => {
      const invalidData = {
        ...validReviewData,
        transactionId: '',
      };

      await expect(reviewService.createReview(buyerId, invalidData)).rejects.toThrow(
        ReviewValidationError
      );
    });

    it('should reject missing overall rating', async () => {
      const invalidData = {
        transactionId: 'txn123',
        overallRating: undefined as any,
      };

      await expect(reviewService.createReview(buyerId, invalidData)).rejects.toThrow(
        ReviewValidationError
      );
    });

    it('should reject overall rating below 1', async () => {
      const invalidData = {
        ...validReviewData,
        overallRating: 0,
      };

      await expect(reviewService.createReview(buyerId, invalidData)).rejects.toThrow(
        ReviewValidationError
      );
    });

    it('should reject overall rating above 5', async () => {
      const invalidData = {
        ...validReviewData,
        overallRating: 6,
      };

      await expect(reviewService.createReview(buyerId, invalidData)).rejects.toThrow(
        ReviewValidationError
      );
    });

    it('should reject non-integer ratings', async () => {
      const invalidData = {
        ...validReviewData,
        overallRating: 4.5,
      };

      await expect(reviewService.createReview(buyerId, invalidData)).rejects.toThrow(
        ReviewValidationError
      );
    });

    it('should reject invalid code quality rating', async () => {
      const invalidData = {
        ...validReviewData,
        codeQualityRating: 10,
      };

      await expect(reviewService.createReview(buyerId, invalidData)).rejects.toThrow(
        ReviewValidationError
      );
    });

    it('should reject comment longer than 2000 characters', async () => {
      const invalidData = {
        ...validReviewData,
        comment: 'A'.repeat(2001),
      };

      await expect(reviewService.createReview(buyerId, invalidData)).rejects.toThrow(
        ReviewValidationError
      );
    });

    it('should accept comment at max length (2000 characters)', async () => {
      const validData = {
        ...validReviewData,
        comment: 'A'.repeat(2000),
      };

      const mockReview = createMockReview();
      vi.mocked(mockReviewRepository.create).mockResolvedValue(mockReview as any);

      await expect(reviewService.createReview(buyerId, validData)).resolves.toBeDefined();
    });

    it('should reject if transaction not found', async () => {
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(null);

      await expect(reviewService.createReview(buyerId, validReviewData)).rejects.toThrow(
        ReviewValidationError
      );
    });

    it('should reject if buyer is not the transaction buyer', async () => {
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(
        createMockTransaction({ buyerId: 'differentbuyer' })
      );

      await expect(reviewService.createReview(buyerId, validReviewData)).rejects.toThrow(
        ReviewPermissionError
      );
    });

    it('should reject if payment not succeeded', async () => {
      vi.mocked(mockTransactionRepository.findById).mockResolvedValue(
        createMockTransaction({ paymentStatus: 'pending' })
      );

      await expect(reviewService.createReview(buyerId, validReviewData)).rejects.toThrow(
        ReviewValidationError
      );
    });

    it('should reject if transaction already reviewed', async () => {
      vi.mocked(mockReviewRepository.findByTransactionId).mockResolvedValue(
        createMockReview() as any
      );

      await expect(reviewService.createReview(buyerId, validReviewData)).rejects.toThrow(
        ReviewValidationError
      );
    });

    it('should reject if buyer does not exist', async () => {
      vi.mocked(mockUserRepository.findById).mockReset().mockResolvedValueOnce(null);

      await expect(reviewService.createReview(buyerId, validReviewData)).rejects.toThrow(
        ReviewPermissionError
      );
    });

    it('should reject if seller does not exist', async () => {
      vi.mocked(mockUserRepository.findById)
        .mockReset()
        .mockResolvedValueOnce(createMockUser('buyer123') as any)
        .mockResolvedValueOnce(null);

      await expect(reviewService.createReview(buyerId, validReviewData)).rejects.toThrow(
        ReviewPermissionError
      );
    });
  });


  describe('getSellerReviews', () => {
    it('should get seller reviews', async () => {
      const sellerId = 'seller123';
      const mockPaginatedReviews = {
        reviews: [createMockReview()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(
        createMockUser(sellerId) as any
      );
      vi.mocked(mockReviewRepository.getSellerReviews).mockResolvedValue(
        mockPaginatedReviews as any
      );

      const result = await reviewService.getSellerReviews(sellerId);

      expect(result).toEqual(mockPaginatedReviews);
      expect(mockReviewRepository.getSellerReviews).toHaveBeenCalledWith(
        sellerId,
        undefined
      );
    });

    it('should get seller reviews with pagination', async () => {
      const sellerId = 'seller123';

      vi.mocked(mockUserRepository.findById).mockResolvedValue(
        createMockUser(sellerId) as any
      );
      vi.mocked(mockReviewRepository.getSellerReviews).mockResolvedValue({} as any);

      await reviewService.getSellerReviews(sellerId, { page: 2, limit: 10 });

      expect(mockReviewRepository.getSellerReviews).toHaveBeenCalledWith(sellerId, {
        page: 2,
        limit: 10,
      });
    });

    it('should throw if seller not found', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      await expect(reviewService.getSellerReviews('nonexistent')).rejects.toThrow(
        ReviewNotFoundError
      );
    });
  });


  describe('getSellerRatingStats', () => {
    it('should get seller rating stats', async () => {
      const sellerId = 'seller123';
      const mockStats = {
        averageRating: 4.5,
        totalReviews: 10,
        ratingBreakdown: { 5: 5, 4: 3, 3: 2, 2: 0, 1: 0 },
      };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(
        createMockUser(sellerId) as any
      );
      vi.mocked(mockReviewRepository.getSellerRatingStats).mockResolvedValue(mockStats);

      const result = await reviewService.getSellerRatingStats(sellerId);

      expect(result).toEqual(mockStats);
      expect(mockReviewRepository.getSellerRatingStats).toHaveBeenCalledWith(sellerId);
    });

    it('should throw if seller not found', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      await expect(reviewService.getSellerRatingStats('nonexistent')).rejects.toThrow(
        ReviewNotFoundError
      );
    });
  });


  describe('getBuyerReviews', () => {
    it('should get buyer reviews', async () => {
      const buyerId = 'buyer123';
      const mockPaginatedReviews = {
        reviews: [createMockReview()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(
        createMockUser(buyerId) as any
      );
      vi.mocked(mockReviewRepository.getBuyerReviews).mockResolvedValue(
        mockPaginatedReviews as any
      );

      const result = await reviewService.getBuyerReviews(buyerId);

      expect(result).toEqual(mockPaginatedReviews);
      expect(mockReviewRepository.getBuyerReviews).toHaveBeenCalledWith(
        buyerId,
        undefined
      );
    });

    it('should throw if buyer not found', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      await expect(reviewService.getBuyerReviews('nonexistent')).rejects.toThrow(
        ReviewNotFoundError
      );
    });
  });


  describe('isTransactionReviewed', () => {
    it('should return true if transaction is reviewed', async () => {
      vi.mocked(mockReviewRepository.findByTransactionId).mockResolvedValue(
        createMockReview() as any
      );

      const result = await reviewService.isTransactionReviewed('txn123');

      expect(result).toBe(true);
    });

    it('should return false if transaction is not reviewed', async () => {
      vi.mocked(mockReviewRepository.findByTransactionId).mockResolvedValue(null);

      const result = await reviewService.isTransactionReviewed('txn123');

      expect(result).toBe(false);
    });
  });
});
