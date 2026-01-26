/**
 * ReviewRepository - Data Access Layer for Reviews
 *
 * Responsibilities:
 * - CRUD operations for reviews
 * - Query seller/buyer reviews with pagination
 * - Calculate seller rating statistics
 * - Update seller analytics based on reviews
 * - Handle review relationships (buyer, seller, transaction, project)
 *
 * Architecture:
 * - Repository Pattern: Abstracts database operations
 * - Single Responsibility: Only handles data access
 * - Type-safe: Returns properly typed Prisma models
 * - Error handling: Catches and wraps database errors
 *
 * @example
 * const reviewRepo = new ReviewRepository(prisma);
 * const review = await reviewRepo.create({...});
 */

import { PrismaClient, Review, Prisma } from '@prisma/client';

/**
 * Review creation input
 */
export interface CreateReviewInput {
  transactionId: string;
  sellerId: string;
  buyerId: string;
  overallRating: number; // 1-5
  comment?: string | null;
  codeQualityRating?: number | null;
  documentationRating?: number | null;
  responsivenessRating?: number | null;
  accuracyRating?: number | null;
  isAnonymous?: boolean;
}

/**
 * Review with full relations
 */
export interface ReviewWithRelations extends Review {
  buyer: {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  transaction: {
    id: string;
    projectId: string;
    project: {
      id: string;
      title: string;
    };
  };
}

/**
 * Paginated reviews response
 */
export interface PaginatedReviews {
  reviews: ReviewWithRelations[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

/**
 * Seller rating statistics
 */
export interface SellerRatingStats {
  averageRating: number;
  totalReviews: number;
  ratingBreakdown: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export class ReviewRepository {
  constructor(private prisma: PrismaClient) {
    console.log('[ReviewRepository] Initialized');
  }

  /**
   * Create a new review
   *
   * @param data - Review creation data
   * @returns Created review with relations
   * @throws Error if database operation fails
   *
   * @example
   * const review = await reviewRepo.create({
   *   transactionId: 'txn123',
   *   sellerId: 'seller123',
   *   buyerId: 'buyer123',
   *   overallRating: 5,
   *   comment: 'Excellent work!',
   * });
   */
  async create(data: CreateReviewInput): Promise<ReviewWithRelations> {
    console.log('[ReviewRepository] Creating review for transaction:', data.transactionId);

    try {
      const review = await this.prisma.review.create({
        data: {
          transactionId: data.transactionId,
          sellerId: data.sellerId,
          buyerId: data.buyerId,
          overallRating: data.overallRating,
          comment: data.comment || null,
          codeQualityRating: data.codeQualityRating || null,
          documentationRating: data.documentationRating || null,
          responsivenessRating: data.responsivenessRating || null,
          accuracyRating: data.accuracyRating || null,
          isAnonymous: data.isAnonymous || false,
        },
        include: {
          buyer: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          transaction: {
            select: {
              id: true,
              projectId: true,
              project: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      });

      console.log('[ReviewRepository] Review created:', review.id);
      return review as ReviewWithRelations;
    } catch (error) {
      console.error('[ReviewRepository] create failed:', error);
      throw new Error('[ReviewRepository] Failed to create review');
    }
  }

  /**
   * Find review by transaction ID
   *
   * @param transactionId - Transaction ID
   * @returns Review or null
   *
   * @example
   * const review = await reviewRepo.findByTransactionId('txn123');
   */
  async findByTransactionId(transactionId: string): Promise<Review | null> {
    console.log('[ReviewRepository] Finding review by transaction:', transactionId);

    try {
      const review = await this.prisma.review.findUnique({
        where: { transactionId },
      });

      console.log('[ReviewRepository] Review found:', !!review);
      return review;
    } catch (error) {
      console.error('[ReviewRepository] findByTransactionId failed:', error);
      throw new Error('[ReviewRepository] Failed to find review');
    }
  }

  /**
   * Get seller reviews with pagination
   *
   * @param sellerId - Seller user ID
   * @param options - Pagination options
   * @returns Paginated reviews
   *
   * @example
   * const reviews = await reviewRepo.getSellerReviews('seller123', { page: 1, limit: 10 });
   */
  async getSellerReviews(
    sellerId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedReviews> {
    console.log('[ReviewRepository] Getting reviews for seller:', sellerId);

    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    try {
      const [reviews, total] = await Promise.all([
        this.prisma.review.findMany({
          where: { sellerId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            buyer: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
              },
            },
            transaction: {
              select: {
                id: true,
                projectId: true,
                project: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.review.count({
          where: { sellerId },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      console.log('[ReviewRepository] Found', reviews.length, 'reviews');

      return {
        reviews: reviews as ReviewWithRelations[],
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    } catch (error) {
      console.error('[ReviewRepository] getSellerReviews failed:', error);
      throw new Error('[ReviewRepository] Failed to get seller reviews');
    }
  }

  /**
   * Get buyer reviews with pagination
   *
   * @param buyerId - Buyer user ID
   * @param options - Pagination options
   * @returns Paginated reviews
   *
   * @example
   * const reviews = await reviewRepo.getBuyerReviews('buyer123', { page: 1, limit: 10 });
   */
  async getBuyerReviews(
    buyerId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedReviews> {
    console.log('[ReviewRepository] Getting reviews by buyer:', buyerId);

    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    try {
      const [reviews, total] = await Promise.all([
        this.prisma.review.findMany({
          where: { buyerId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            buyer: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
              },
            },
            transaction: {
              select: {
                id: true,
                projectId: true,
                project: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.review.count({
          where: { buyerId },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      console.log('[ReviewRepository] Found', reviews.length, 'reviews');

      return {
        reviews: reviews as ReviewWithRelations[],
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    } catch (error) {
      console.error('[ReviewRepository] getBuyerReviews failed:', error);
      throw new Error('[ReviewRepository] Failed to get buyer reviews');
    }
  }

  /**
   * Get seller rating statistics
   *
   * @param sellerId - Seller user ID
   * @returns Rating statistics
   *
   * @example
   * const stats = await reviewRepo.getSellerRatingStats('seller123');
   */
  async getSellerRatingStats(sellerId: string): Promise<SellerRatingStats> {
    console.log('[ReviewRepository] Getting rating stats for seller:', sellerId);

    try {
      const reviews = await this.prisma.review.findMany({
        where: { sellerId },
        select: { overallRating: true },
      });

      if (reviews.length === 0) {
        return {
          averageRating: 0,
          totalReviews: 0,
          ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        };
      }

      // Calculate average
      const sum = reviews.reduce((acc, r) => acc + r.overallRating, 0);
      const averageRating = Number((sum / reviews.length).toFixed(2));

      // Calculate breakdown
      const ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      reviews.forEach((r) => {
        if (r.overallRating >= 1 && r.overallRating <= 5) {
          ratingBreakdown[r.overallRating as keyof typeof ratingBreakdown]++;
        }
      });

      console.log('[ReviewRepository] Rating stats calculated:', {
        averageRating,
        totalReviews: reviews.length,
      });

      return {
        averageRating,
        totalReviews: reviews.length,
        ratingBreakdown,
      };
    } catch (error) {
      console.error('[ReviewRepository] getSellerRatingStats failed:', error);
      throw new Error('[ReviewRepository] Failed to get seller rating stats');
    }
  }

  /**
   * Update seller analytics based on reviews
   *
   * @param sellerId - Seller user ID
   * @returns Updated seller analytics
   *
   * @example
   * const analytics = await reviewRepo.updateSellerAnalytics('seller123');
   */
  async updateSellerAnalytics(sellerId: string): Promise<any> {
    console.log('[ReviewRepository] Updating seller analytics:', sellerId);

    try {
      // Get rating stats
      const stats = await this.getSellerRatingStats(sellerId);

      // Upsert seller analytics
      const analytics = await this.prisma.sellerAnalytics.upsert({
        where: { sellerId },
        create: {
          sellerId,
          averageRating: stats.averageRating,
          totalReviews: stats.totalReviews,
        },
        update: {
          averageRating: stats.averageRating,
          totalReviews: stats.totalReviews,
        },
      });

      console.log('[ReviewRepository] Seller analytics updated');
      return analytics;
    } catch (error) {
      console.error('[ReviewRepository] updateSellerAnalytics failed:', error);
      throw new Error('[ReviewRepository] Failed to update seller analytics');
    }
  }

  /**
   * Find review by ID
   *
   * @param id - Review ID
   * @returns Review with relations or null
   *
   * @example
   * const review = await reviewRepo.findById('review123');
   */
  async findById(id: string): Promise<ReviewWithRelations | null> {
    console.log('[ReviewRepository] Finding review by ID:', id);

    try {
      const review = await this.prisma.review.findUnique({
        where: { id },
        include: {
          buyer: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          transaction: {
            select: {
              id: true,
              projectId: true,
              project: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      });

      console.log('[ReviewRepository] Review found:', !!review);
      return review as ReviewWithRelations | null;
    } catch (error) {
      console.error('[ReviewRepository] findById failed:', error);
      throw new Error('[ReviewRepository] Failed to find review');
    }
  }

  /**
   * Update review
   *
   * @param id - Review ID
   * @param data - Update data
   * @returns Updated review
   * @throws Error if review not found
   *
   * @example
   * const updated = await reviewRepo.update('review123', { comment: 'Updated comment' });
   */
  async update(id: string, data: Partial<CreateReviewInput>): Promise<Review> {
    console.log('[ReviewRepository] Updating review:', id);

    try {
      const review = await this.prisma.review.update({
        where: { id },
        data: {
          overallRating: data.overallRating,
          comment: data.comment,
          codeQualityRating: data.codeQualityRating,
          documentationRating: data.documentationRating,
          responsivenessRating: data.responsivenessRating,
          accuracyRating: data.accuracyRating,
          isAnonymous: data.isAnonymous,
        },
      });

      console.log('[ReviewRepository] Review updated:', id);
      return review;
    } catch (error) {
      console.error('[ReviewRepository] update failed:', error);
      throw new Error('[ReviewRepository] Failed to update review');
    }
  }

  /**
   * Delete review
   *
   * @param id - Review ID
   * @returns Deleted review
   * @throws Error if review not found
   *
   * @example
   * const deleted = await reviewRepo.delete('review123');
   */
  async delete(id: string): Promise<Review> {
    console.log('[ReviewRepository] Deleting review:', id);

    try {
      const review = await this.prisma.review.delete({
        where: { id },
      });

      console.log('[ReviewRepository] Review deleted:', id);
      return review;
    } catch (error) {
      console.error('[ReviewRepository] delete failed:', error);
      throw new Error('[ReviewRepository] Failed to delete review');
    }
  }
}
