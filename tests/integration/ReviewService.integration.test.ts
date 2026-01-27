/**
 * ReviewService Integration Tests
 *
 * Tests review/rating business logic with real database operations.
 *
 * Prerequisites:
 * - Test database must be running: `npm run test:db:setup`
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
} from '@/tests/helpers/db';
import { createTestUser, createTestProject } from '@/tests/helpers/fixtures';
import { ReviewService } from '@/lib/services/ReviewService';
import { ReviewRepository } from '@/lib/repositories/ReviewRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import { prisma } from '@/lib/prisma';

// Mock EmailService
vi.mock('@/lib/services/EmailService', () => ({
  EmailService: class {
    async sendReviewNotification() {
      return true;
    }
  },
  emailService: {
    sendReviewNotification: vi.fn().mockResolvedValue(true),
  },
}));

describe('ReviewService (Integration)', () => {
  let reviewService: ReviewService;
  let reviewRepository: ReviewRepository;
  let userRepository: UserRepository;
  let transactionRepository: TransactionRepository;

  beforeAll(async () => {
    await setupTestDatabase();
    reviewRepository = new ReviewRepository(prisma);
    userRepository = new UserRepository(prisma);
    transactionRepository = new TransactionRepository(prisma);
    reviewService = new ReviewService(
      reviewRepository,
      userRepository,
      transactionRepository,
      undefined // emailService mocked
    );
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('createReview', () => {
    it('should create review for completed transaction', async () => {
      const seller = await createTestUser({ username: 'seller', isSeller: true });
      const buyer = await createTestUser({ username: 'buyer' });
      const project = await createTestProject({ sellerId: seller.id });

      // Create successful transaction
      const transaction = await prisma.transaction.create({
        data: {
          projectId: project.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 10000,
          commissionCents: 1800,
          sellerReceivesCents: 8200,
          paymentStatus: 'succeeded',
          escrowStatus: 'released',
        },
      });

      const review = await reviewService.createReview(buyer.id, {
        transactionId: transaction.id,
        overallRating: 5,
        comment: 'Excellent code quality and great documentation!',
        codeQualityRating: 5,
        documentationRating: 5,
        responsivenessRating: 5,
        accuracyRating: 5,
      });

      expect(review.id).toBeDefined();
      expect(review.transactionId).toBe(transaction.id);
      expect(review.sellerId).toBe(seller.id);
      expect(review.buyerId).toBe(buyer.id);
      expect(review.overallRating).toBe(5);
      expect(review.comment).toBe('Excellent code quality and great documentation!');

      // Verify in database
      const dbReview = await prisma.review.findUnique({
        where: { transactionId: transaction.id },
      });
      expect(dbReview).toBeTruthy();
      expect(dbReview?.overallRating).toBe(5);
    });

    it('should update seller analytics after review', async () => {
      const seller = await createTestUser({ username: 'seller', isSeller: true });
      const buyer = await createTestUser({ username: 'buyer' });
      const project = await createTestProject({ sellerId: seller.id });

      const transaction = await prisma.transaction.create({
        data: {
          projectId: project.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 10000,
          commissionCents: 1800,
          sellerReceivesCents: 8200,
          paymentStatus: 'succeeded',
        },
      });

      await reviewService.createReview(buyer.id, {
        transactionId: transaction.id,
        overallRating: 4,
      });

      // Check seller analytics updated
      const analytics = await prisma.sellerAnalytics.findUnique({
        where: { sellerId: seller.id },
      });

      expect(analytics).toBeTruthy();
      expect(analytics?.totalReviews).toBe(1);
      expect(Number(analytics?.averageRating)).toBe(4.0);
    });

    it('should enforce only buyer can review', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const randomUser = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id });

      const transaction = await prisma.transaction.create({
        data: {
          projectId: project.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 10000,
          commissionCents: 1800,
          sellerReceivesCents: 8200,
          paymentStatus: 'succeeded',
        },
      });

      // Random user tries to review
      await expect(
        reviewService.createReview(randomUser.id, {
          transactionId: transaction.id,
          overallRating: 5,
        })
      ).rejects.toThrow('Only the buyer can review this transaction');
    });

    it('should enforce payment must be successful', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id });

      const transaction = await prisma.transaction.create({
        data: {
          projectId: project.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 10000,
          commissionCents: 1800,
          sellerReceivesCents: 8200,
          paymentStatus: 'pending', // Not succeeded
        },
      });

      await expect(
        reviewService.createReview(buyer.id, {
          transactionId: transaction.id,
          overallRating: 5,
        })
      ).rejects.toThrow('Cannot review transaction with unsuccessful payment');
    });

    it('should prevent duplicate reviews', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id });

      const transaction = await prisma.transaction.create({
        data: {
          projectId: project.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 10000,
          commissionCents: 1800,
          sellerReceivesCents: 8200,
          paymentStatus: 'succeeded',
        },
      });

      // First review succeeds
      await reviewService.createReview(buyer.id, {
        transactionId: transaction.id,
        overallRating: 5,
      });

      // Second review fails
      await expect(
        reviewService.createReview(buyer.id, {
          transactionId: transaction.id,
          overallRating: 4,
        })
      ).rejects.toThrow('Transaction has already been reviewed');
    });

    it('should validate rating ranges', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id });

      const transaction = await prisma.transaction.create({
        data: {
          projectId: project.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 10000,
          commissionCents: 1800,
          sellerReceivesCents: 8200,
          paymentStatus: 'succeeded',
        },
      });

      // Rating too low
      await expect(
        reviewService.createReview(buyer.id, {
          transactionId: transaction.id,
          overallRating: 0,
        })
      ).rejects.toThrow('Overall rating must be between 1 and 5');

      // Rating too high
      await expect(
        reviewService.createReview(buyer.id, {
          transactionId: transaction.id,
          overallRating: 6,
        })
      ).rejects.toThrow('Overall rating must be between 1 and 5');
    });

    it('should allow anonymous reviews', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id });

      const transaction = await prisma.transaction.create({
        data: {
          projectId: project.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 10000,
          commissionCents: 1800,
          sellerReceivesCents: 8200,
          paymentStatus: 'succeeded',
        },
      });

      const review = await reviewService.createReview(buyer.id, {
        transactionId: transaction.id,
        overallRating: 4,
        comment: 'Good project but could be better documented',
        isAnonymous: true,
      });

      expect(review.isAnonymous).toBe(true);
      expect(review.buyerId).toBe(buyer.id); // Still tracked in DB
    });
  });

  describe('getSellerReviews', () => {
    it('should get all reviews for a seller with pagination', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer1 = await createTestUser({ username: 'buyer1' });
      const buyer2 = await createTestUser({ username: 'buyer2' });
      const project = await createTestProject({ sellerId: seller.id });

      // Create 2 transactions and reviews
      for (const buyer of [buyer1, buyer2]) {
        const transaction = await prisma.transaction.create({
          data: {
            projectId: project.id,
            sellerId: seller.id,
            buyerId: buyer.id,
            amountCents: 10000,
            commissionCents: 1800,
            sellerReceivesCents: 8200,
            paymentStatus: 'succeeded',
          },
        });

        await reviewService.createReview(buyer.id, {
          transactionId: transaction.id,
          overallRating: 5,
        });
      }

      const result = await reviewService.getSellerReviews(seller.id);

      expect(result.reviews).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.reviews[0]!.sellerId).toBe(seller.id);
    });
  });

  describe('getSellerRatingStats', () => {
    it('should calculate average rating correctly', async () => {
      const seller = await createTestUser({ isSeller: true });
      const project = await createTestProject({ sellerId: seller.id });

      // Create reviews with different ratings
      const ratings = [5, 4, 4, 3, 5]; // Average: 4.2
      for (let i = 0; i < ratings.length; i++) {
        const buyer = await createTestUser({ username: `buyer${i}` });
        const transaction = await prisma.transaction.create({
          data: {
            projectId: project.id,
            sellerId: seller.id,
            buyerId: buyer.id,
            amountCents: 10000,
            commissionCents: 1800,
            sellerReceivesCents: 8200,
            paymentStatus: 'succeeded',
          },
        });

        await reviewService.createReview(buyer.id, {
          transactionId: transaction.id,
          overallRating: ratings[i]!,
        });
      }

      const stats = await reviewService.getSellerRatingStats(seller.id);

      expect(stats.totalReviews).toBe(5);
      expect(Number(stats.averageRating)).toBeCloseTo(4.2, 1);
      expect(stats.ratingBreakdown[5]).toBe(2);
      expect(stats.ratingBreakdown[4]).toBe(2);
      expect(stats.ratingBreakdown[3]).toBe(1);
    });
  });
});
