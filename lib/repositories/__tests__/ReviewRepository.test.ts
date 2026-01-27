/**
 * ReviewRepository Unit Tests
 *
 * Tests all CRUD operations and query methods for reviews.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReviewRepository } from '../ReviewRepository';
import type { PrismaClient } from '@prisma/client';

// Mock Prisma Client
const mockPrismaClient = {
  review: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  sellerAnalytics: {
    upsert: vi.fn(),
  },
} as unknown as PrismaClient;

// Mock data helpers
const createMockUser = (id: string, username: string) => ({
  id,
  username,
  fullName: `${username} Name`,
  avatarUrl: `https://avatar.com/${username}.jpg`,
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
  createdAt: new Date('2026-01-15T10:00:00Z'),
  updatedAt: new Date('2026-01-15T10:00:00Z'),
  ...overrides,
});

const createMockReviewWithRelations = (overrides = {}) => ({
  ...createMockReview(overrides),
  buyer: createMockUser('buyer123', 'buyer'),
  transaction: {
    id: 'txn123',
    projectId: 'project123',
    project: {
      id: 'project123',
      title: 'Test Project',
    },
  },
});

describe('ReviewRepository', () => {
  let reviewRepository: ReviewRepository;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create fresh instance
    reviewRepository = new ReviewRepository(mockPrismaClient);
  });

  // ============================================
  // CREATE TESTS
  // ============================================

  describe('create', () => {
    it('should create review with all ratings', async () => {
      const reviewData = {
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
      };

      const mockReview = createMockReviewWithRelations(reviewData);
      vi.mocked(mockPrismaClient.review.create).mockResolvedValue(mockReview);

      const result = await reviewRepository.create(reviewData);

      expect(result).toEqual(mockReview);
      expect(mockPrismaClient.review.create).toHaveBeenCalledWith({
        data: {
          transactionId: reviewData.transactionId,
          sellerId: reviewData.sellerId,
          buyerId: reviewData.buyerId,
          overallRating: reviewData.overallRating,
          comment: reviewData.comment,
          codeQualityRating: reviewData.codeQualityRating,
          documentationRating: reviewData.documentationRating,
          responsivenessRating: reviewData.responsivenessRating,
          accuracyRating: reviewData.accuracyRating,
          isAnonymous: reviewData.isAnonymous,
        },
        include: expect.objectContaining({
          buyer: expect.any(Object),
          transaction: expect.any(Object),
        }),
      });
    });

    it('should create review with only required fields', async () => {
      const reviewData = {
        transactionId: 'txn123',
        sellerId: 'seller123',
        buyerId: 'buyer123',
        overallRating: 4,
      };

      const mockReview = createMockReviewWithRelations({
        ...reviewData,
        comment: null,
        codeQualityRating: null,
        documentationRating: null,
        responsivenessRating: null,
        accuracyRating: null,
      });
      vi.mocked(mockPrismaClient.review.create).mockResolvedValue(mockReview);

      const result = await reviewRepository.create(reviewData);

      expect(result).toEqual(mockReview);
      expect(mockPrismaClient.review.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            comment: null,
            codeQualityRating: null,
            documentationRating: null,
            responsivenessRating: null,
            accuracyRating: null,
          }),
        })
      );
    });

    it('should throw error when database operation fails', async () => {
      const reviewData = {
        transactionId: 'txn123',
        sellerId: 'seller123',
        buyerId: 'buyer123',
        overallRating: 5,
      };

      vi.mocked(mockPrismaClient.review.create).mockRejectedValue(new Error('DB Error'));

      await expect(reviewRepository.create(reviewData)).rejects.toThrow(
        '[ReviewRepository] Failed to create review'
      );
    });
  });

  // ============================================
  // FIND BY TRANSACTION ID TESTS
  // ============================================

  describe('findByTransactionId', () => {
    it('should find review by transaction ID', async () => {
      const mockReview = createMockReview();
      vi.mocked(mockPrismaClient.review.findUnique).mockResolvedValue(mockReview);

      const result = await reviewRepository.findByTransactionId('txn123');

      expect(result).toEqual(mockReview);
      expect(mockPrismaClient.review.findUnique).toHaveBeenCalledWith({
        where: { transactionId: 'txn123' },
      });
    });

    it('should return null when review not found', async () => {
      vi.mocked(mockPrismaClient.review.findUnique).mockResolvedValue(null);

      const result = await reviewRepository.findByTransactionId('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.review.findUnique).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(reviewRepository.findByTransactionId('txn123')).rejects.toThrow(
        '[ReviewRepository] Failed to find review'
      );
    });
  });

  // ============================================
  // GET SELLER REVIEWS TESTS
  // ============================================

  describe('getSellerReviews', () => {
    it('should get seller reviews with default pagination', async () => {
      const mockReviews = [
        createMockReviewWithRelations(),
        createMockReviewWithRelations({ id: 'review456' }),
      ];

      vi.mocked(mockPrismaClient.review.findMany).mockResolvedValue(mockReviews);
      vi.mocked(mockPrismaClient.review.count).mockResolvedValue(2);

      const result = await reviewRepository.getSellerReviews('seller123');

      expect(result.reviews).toEqual(mockReviews);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(false);
    });

    it('should get seller reviews with custom pagination', async () => {
      const mockReviews = [createMockReviewWithRelations()];

      vi.mocked(mockPrismaClient.review.findMany).mockResolvedValue(mockReviews);
      vi.mocked(mockPrismaClient.review.count).mockResolvedValue(25);

      const result = await reviewRepository.getSellerReviews('seller123', {
        page: 2,
        limit: 10,
      });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(result.hasNext).toBe(true);
      expect(result.hasPrev).toBe(true);
      expect(mockPrismaClient.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (page 2 - 1) * limit 10
          take: 10,
        })
      );
    });

    it('should return empty array when no reviews found', async () => {
      vi.mocked(mockPrismaClient.review.findMany).mockResolvedValue([]);
      vi.mocked(mockPrismaClient.review.count).mockResolvedValue(0);

      const result = await reviewRepository.getSellerReviews('seller123');

      expect(result.reviews).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.review.findMany).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(reviewRepository.getSellerReviews('seller123')).rejects.toThrow(
        '[ReviewRepository] Failed to get seller reviews'
      );
    });
  });

  // ============================================
  // GET BUYER REVIEWS TESTS
  // ============================================

  describe('getBuyerReviews', () => {
    it('should get buyer reviews with pagination', async () => {
      const mockReviews = [createMockReviewWithRelations()];

      vi.mocked(mockPrismaClient.review.findMany).mockResolvedValue(mockReviews);
      vi.mocked(mockPrismaClient.review.count).mockResolvedValue(1);

      const result = await reviewRepository.getBuyerReviews('buyer123');

      expect(result.reviews).toEqual(mockReviews);
      expect(result.total).toBe(1);
      expect(mockPrismaClient.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { buyerId: 'buyer123' },
        })
      );
    });

    it('should return empty array when no reviews found', async () => {
      vi.mocked(mockPrismaClient.review.findMany).mockResolvedValue([]);
      vi.mocked(mockPrismaClient.review.count).mockResolvedValue(0);

      const result = await reviewRepository.getBuyerReviews('buyer123');

      expect(result.reviews).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.review.findMany).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(reviewRepository.getBuyerReviews('buyer123')).rejects.toThrow(
        '[ReviewRepository] Failed to get buyer reviews'
      );
    });
  });

  // ============================================
  // GET SELLER RATING STATS TESTS
  // ============================================

  describe('getSellerRatingStats', () => {
    it('should calculate rating stats correctly', async () => {
      const mockReviews = [
        { overallRating: 5 },
        { overallRating: 5 },
        { overallRating: 4 },
        { overallRating: 3 },
        { overallRating: 5 },
      ];

      vi.mocked(mockPrismaClient.review.findMany).mockResolvedValue(mockReviews as any);

      const result = await reviewRepository.getSellerRatingStats('seller123');

      expect(result.averageRating).toBe(4.4);
      expect(result.totalReviews).toBe(5);
      expect(result.ratingBreakdown).toEqual({
        5: 3,
        4: 1,
        3: 1,
        2: 0,
        1: 0,
      });
    });

    it('should return zero stats when no reviews exist', async () => {
      vi.mocked(mockPrismaClient.review.findMany).mockResolvedValue([]);

      const result = await reviewRepository.getSellerRatingStats('seller123');

      expect(result.averageRating).toBe(0);
      expect(result.totalReviews).toBe(0);
      expect(result.ratingBreakdown).toEqual({
        5: 0,
        4: 0,
        3: 0,
        2: 0,
        1: 0,
      });
    });

    it('should handle all 5-star reviews', async () => {
      const mockReviews = [
        { overallRating: 5 },
        { overallRating: 5 },
        { overallRating: 5 },
      ];

      vi.mocked(mockPrismaClient.review.findMany).mockResolvedValue(mockReviews as any);

      const result = await reviewRepository.getSellerRatingStats('seller123');

      expect(result.averageRating).toBe(5);
      expect(result.totalReviews).toBe(3);
      expect(result.ratingBreakdown[5]).toBe(3);
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.review.findMany).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(reviewRepository.getSellerRatingStats('seller123')).rejects.toThrow(
        '[ReviewRepository] Failed to get seller rating stats'
      );
    });
  });

  // ============================================
  // UPDATE SELLER ANALYTICS TESTS
  // ============================================

  describe('updateSellerAnalytics', () => {
    it('should update seller analytics with rating stats', async () => {
      const mockReviews = [{ overallRating: 5 }, { overallRating: 4 }];

      const mockAnalytics = {
        id: 'analytics123',
        sellerId: 'seller123',
        averageRating: 4.5,
        totalReviews: 2,
        totalProjectsListed: 0,
        totalProjectsSold: 0,
        totalRevenueCents: 0,
        totalFavorites: 0,
        totalViews: 0,
        updatedAt: new Date(),
      };

      vi.mocked(mockPrismaClient.review.findMany).mockResolvedValue(mockReviews as any);
      vi.mocked(mockPrismaClient.sellerAnalytics.upsert).mockResolvedValue(mockAnalytics);

      const result = await reviewRepository.updateSellerAnalytics('seller123');

      expect(result).toEqual(mockAnalytics);
      expect(mockPrismaClient.sellerAnalytics.upsert).toHaveBeenCalledWith({
        where: { sellerId: 'seller123' },
        create: {
          sellerId: 'seller123',
          averageRating: 4.5,
          totalReviews: 2,
        },
        update: {
          averageRating: 4.5,
          totalReviews: 2,
        },
      });
    });

    it('should create analytics if not exists', async () => {
      const mockReviews = [{ overallRating: 5 }];
      const mockAnalytics = {
        id: 'analytics123',
        sellerId: 'seller123',
        averageRating: 5,
        totalReviews: 1,
      };

      vi.mocked(mockPrismaClient.review.findMany).mockResolvedValue(mockReviews as any);
      vi.mocked(mockPrismaClient.sellerAnalytics.upsert).mockResolvedValue(
        mockAnalytics as any
      );

      await reviewRepository.updateSellerAnalytics('seller123');

      expect(mockPrismaClient.sellerAnalytics.upsert).toHaveBeenCalled();
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.review.findMany).mockResolvedValue([]);
      vi.mocked(mockPrismaClient.sellerAnalytics.upsert).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(reviewRepository.updateSellerAnalytics('seller123')).rejects.toThrow(
        '[ReviewRepository] Failed to update seller analytics'
      );
    });
  });

  // ============================================
  // FIND BY ID TESTS
  // ============================================

  describe('findById', () => {
    it('should find review by ID with relations', async () => {
      const mockReview = createMockReviewWithRelations();
      vi.mocked(mockPrismaClient.review.findUnique).mockResolvedValue(mockReview);

      const result = await reviewRepository.findById('review123');

      expect(result).toEqual(mockReview);
      expect(mockPrismaClient.review.findUnique).toHaveBeenCalledWith({
        where: { id: 'review123' },
        include: expect.objectContaining({
          buyer: expect.any(Object),
          transaction: expect.any(Object),
        }),
      });
    });

    it('should return null when review not found', async () => {
      vi.mocked(mockPrismaClient.review.findUnique).mockResolvedValue(null);

      const result = await reviewRepository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.review.findUnique).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(reviewRepository.findById('review123')).rejects.toThrow(
        '[ReviewRepository] Failed to find review'
      );
    });
  });

  // ============================================
  // UPDATE TESTS
  // ============================================

  describe('update', () => {
    it('should update review fields', async () => {
      const updateData = {
        overallRating: 4,
        comment: 'Updated comment',
        codeQualityRating: 4,
      };

      const mockUpdated = createMockReview(updateData);
      vi.mocked(mockPrismaClient.review.update).mockResolvedValue(mockUpdated);

      const result = await reviewRepository.update('review123', updateData);

      expect(result).toEqual(mockUpdated);
      expect(mockPrismaClient.review.update).toHaveBeenCalledWith({
        where: { id: 'review123' },
        data: expect.objectContaining({
          overallRating: 4,
          comment: 'Updated comment',
          codeQualityRating: 4,
        }),
      });
    });

    it('should throw error when review not found', async () => {
      vi.mocked(mockPrismaClient.review.update).mockRejectedValue(
        new Error('Record not found')
      );

      await expect(
        reviewRepository.update('nonexistent', { overallRating: 5 })
      ).rejects.toThrow('[ReviewRepository] Failed to update review');
    });
  });

  // ============================================
  // DELETE TESTS
  // ============================================

  describe('delete', () => {
    it('should delete review by ID', async () => {
      const mockReview = createMockReview();
      vi.mocked(mockPrismaClient.review.delete).mockResolvedValue(mockReview);

      const result = await reviewRepository.delete('review123');

      expect(result).toEqual(mockReview);
      expect(mockPrismaClient.review.delete).toHaveBeenCalledWith({
        where: { id: 'review123' },
      });
    });

    it('should throw error when review not found', async () => {
      vi.mocked(mockPrismaClient.review.delete).mockRejectedValue(
        new Error('Record not found')
      );

      await expect(reviewRepository.delete('nonexistent')).rejects.toThrow(
        '[ReviewRepository] Failed to delete review'
      );
    });
  });
});
