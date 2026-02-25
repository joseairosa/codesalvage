/**
 * ReviewService - Business Logic for Reviews
 *
 * Responsibilities:
 * - Validate review data before database operations
 * - Implement business rules for review submission
 * - Verify user permissions (only buyer can review, payment succeeded)
 * - Enforce one review per transaction rule
 * - Handle seller analytics updates after review creation
 * - Coordinate email notifications for new reviews
 * - Validate rating constraints (1-5 stars)
 *
 * Architecture:
 * - Service Pattern: Encapsulates business logic
 * - Single Responsibility: Manages review-related operations
 * - Dependency Injection: Receives repositories via constructor
 * - Error handling: Provides business-level error messages
 *
 * @example
 * const reviewService = new ReviewService(reviewRepo, userRepo, emailService);
 * const review = await reviewService.createReview(buyerId, {
 *   transactionId: 'txn123',
 *   overallRating: 5,
 *   comment: 'Excellent work!',
 * });
 */

import type {
  ReviewRepository,
  CreateReviewInput,
  ReviewWithRelations,
  PaginatedReviews,
  PaginationOptions,
  SellerRatingStats,
} from '@/lib/repositories/ReviewRepository';
import type { UserRepository } from '@/lib/repositories/UserRepository';

/**
 * Review creation request (from user input)
 */
export interface CreateReviewRequest {
  transactionId: string;
  overallRating: number;
  comment?: string;
  codeQualityRating?: number;
  documentationRating?: number;
  responsivenessRating?: number;
  accuracyRating?: number;
  isAnonymous?: boolean;
}

/**
 * Review validation errors
 */
export class ReviewValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'ReviewValidationError';
  }
}

/**
 * Review permission error
 */
export class ReviewPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReviewPermissionError';
  }
}

/**
 * Review not found error
 */
export class ReviewNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReviewNotFoundError';
  }
}

/**
 * Rating constraints
 */
export const MIN_RATING = 1;
export const MAX_RATING = 5;
export const MAX_COMMENT_LENGTH = 2000;

/**
 * ReviewService
 *
 * Handles all business logic for reviews.
 */
export class ReviewService {
  constructor(
    private reviewRepository: ReviewRepository,
    private userRepository: UserRepository,
    private transactionRepository?: any,
    private emailService?: any
  ) {
    console.log('[ReviewService] Initialized');
  }

  /**
   * Create a new review
   *
   * @param buyerId - Buyer user ID
   * @param data - Review creation data
   * @returns Created review with relations
   *
   * @throws ReviewValidationError if validation fails
   * @throws ReviewPermissionError if permission validation fails
   *
   * @example
   * const review = await reviewService.createReview('buyer123', {
   *   transactionId: 'txn123',
   *   overallRating: 5,
   *   comment: 'Excellent project!',
   *   codeQualityRating: 5,
   * });
   */
  async createReview(
    buyerId: string,
    data: CreateReviewRequest
  ): Promise<ReviewWithRelations> {
    console.log('[ReviewService] Creating review for transaction:', data.transactionId);

    await this.validateReviewData(buyerId, data);

    // TODO: Replace with actual TransactionRepository when implemented
    const transaction = await this.getTransaction(data.transactionId);

    const createInput: CreateReviewInput = {
      transactionId: data.transactionId,
      sellerId: transaction.sellerId,
      buyerId,
      overallRating: data.overallRating,
      comment: data.comment?.trim() || null,
      codeQualityRating: data.codeQualityRating || null,
      documentationRating: data.documentationRating || null,
      responsivenessRating: data.responsivenessRating || null,
      accuracyRating: data.accuracyRating || null,
      isAnonymous: data.isAnonymous || false,
    };

    const review = await this.reviewRepository.create(createInput);

    this.reviewRepository.updateSellerAnalytics(transaction.sellerId).catch((err) => {
      console.error('[ReviewService] Failed to update seller analytics:', err);
    });

    if (this.emailService) {
      this.userRepository
        .findById(transaction.sellerId)
        .then((seller) => {
          if (seller?.email) {
            return this.emailService.sendNewReviewNotification(review, {
              email: seller.email,
              fullName: seller.fullName,
              username: seller.username,
            });
          }
        })
        .catch((err: Error) => {
          console.error('[ReviewService] Failed to send email notification:', err);
        });
    }

    console.log('[ReviewService] Review created successfully:', review.id);
    return review;
  }

  /**
   * Get seller reviews with pagination
   *
   * @param sellerId - Seller user ID
   * @param options - Pagination options
   * @returns Paginated reviews
   *
   * @example
   * const reviews = await reviewService.getSellerReviews('seller123', { page: 1, limit: 10 });
   */
  async getSellerReviews(
    sellerId: string,
    options?: PaginationOptions
  ): Promise<PaginatedReviews> {
    console.log('[ReviewService] Getting reviews for seller:', sellerId);

    const seller = await this.userRepository.findById(sellerId);
    if (!seller) {
      throw new ReviewNotFoundError('Seller not found');
    }

    return await this.reviewRepository.getSellerReviews(sellerId, options);
  }

  /**
   * Get seller rating statistics
   *
   * @param sellerId - Seller user ID
   * @returns Rating statistics
   *
   * @example
   * const stats = await reviewService.getSellerRatingStats('seller123');
   */
  async getSellerRatingStats(sellerId: string): Promise<SellerRatingStats> {
    console.log('[ReviewService] Getting rating stats for seller:', sellerId);

    const seller = await this.userRepository.findById(sellerId);
    if (!seller) {
      throw new ReviewNotFoundError('Seller not found');
    }

    return await this.reviewRepository.getSellerRatingStats(sellerId);
  }

  /**
   * Get buyer reviews with pagination
   *
   * @param buyerId - Buyer user ID
   * @param options - Pagination options
   * @returns Paginated reviews
   *
   * @example
   * const reviews = await reviewService.getBuyerReviews('buyer123', { page: 1, limit: 10 });
   */
  async getBuyerReviews(
    buyerId: string,
    options?: PaginationOptions
  ): Promise<PaginatedReviews> {
    console.log('[ReviewService] Getting reviews by buyer:', buyerId);

    const buyer = await this.userRepository.findById(buyerId);
    if (!buyer) {
      throw new ReviewNotFoundError('Buyer not found');
    }

    return await this.reviewRepository.getBuyerReviews(buyerId, options);
  }

  /**
   * Check if transaction has been reviewed
   *
   * @param transactionId - Transaction ID
   * @returns true if reviewed
   *
   * @example
   * const isReviewed = await reviewService.isTransactionReviewed('txn123');
   */
  async isTransactionReviewed(transactionId: string): Promise<boolean> {
    console.log('[ReviewService] Checking if transaction is reviewed:', transactionId);

    const review = await this.reviewRepository.findByTransactionId(transactionId);
    return review !== null;
  }

  /**
   * Validate review data
   *
   * @param buyerId - Buyer user ID
   * @param data - Review data
   * @throws ReviewValidationError if validation fails
   * @throws ReviewPermissionError if permission validation fails
   *
   * @private
   */
  private async validateReviewData(
    buyerId: string,
    data: CreateReviewRequest
  ): Promise<void> {
    if (!data.transactionId || data.transactionId.trim().length === 0) {
      throw new ReviewValidationError('Transaction ID is required', 'transactionId');
    }

    const transaction = await this.getTransaction(data.transactionId);
    if (!transaction) {
      throw new ReviewValidationError('Transaction not found', 'transactionId');
    }

    if (transaction.buyerId !== buyerId) {
      throw new ReviewPermissionError(
        'Only the buyer of this transaction can submit a review'
      );
    }

    if (transaction.paymentStatus !== 'succeeded') {
      throw new ReviewValidationError(
        'Can only review completed transactions',
        'transactionId'
      );
    }

    const existingReview = await this.reviewRepository.findByTransactionId(
      data.transactionId
    );
    if (existingReview) {
      throw new ReviewValidationError(
        'This transaction has already been reviewed',
        'transactionId'
      );
    }

    if (data.overallRating === undefined || data.overallRating === null) {
      throw new ReviewValidationError('Overall rating is required', 'overallRating');
    }

    if (!this.isValidRating(data.overallRating)) {
      throw new ReviewValidationError(
        `Overall rating must be between ${MIN_RATING} and ${MAX_RATING}`,
        'overallRating'
      );
    }

    if (
      data.codeQualityRating !== undefined &&
      data.codeQualityRating !== null &&
      !this.isValidRating(data.codeQualityRating)
    ) {
      throw new ReviewValidationError(
        `Code quality rating must be between ${MIN_RATING} and ${MAX_RATING}`,
        'codeQualityRating'
      );
    }

    if (
      data.documentationRating !== undefined &&
      data.documentationRating !== null &&
      !this.isValidRating(data.documentationRating)
    ) {
      throw new ReviewValidationError(
        `Documentation rating must be between ${MIN_RATING} and ${MAX_RATING}`,
        'documentationRating'
      );
    }

    if (
      data.responsivenessRating !== undefined &&
      data.responsivenessRating !== null &&
      !this.isValidRating(data.responsivenessRating)
    ) {
      throw new ReviewValidationError(
        `Responsiveness rating must be between ${MIN_RATING} and ${MAX_RATING}`,
        'responsivenessRating'
      );
    }

    if (
      data.accuracyRating !== undefined &&
      data.accuracyRating !== null &&
      !this.isValidRating(data.accuracyRating)
    ) {
      throw new ReviewValidationError(
        `Accuracy rating must be between ${MIN_RATING} and ${MAX_RATING}`,
        'accuracyRating'
      );
    }

    if (data.comment) {
      const commentLength = data.comment.trim().length;
      if (commentLength > MAX_COMMENT_LENGTH) {
        throw new ReviewValidationError(
          `Comment must be less than ${MAX_COMMENT_LENGTH} characters`,
          'comment'
        );
      }
    }

    const buyer = await this.userRepository.findById(buyerId);
    if (!buyer) {
      throw new ReviewPermissionError('Buyer user not found');
    }

    const seller = await this.userRepository.findById(transaction.sellerId);
    if (!seller) {
      throw new ReviewPermissionError('Seller user not found');
    }
  }

  /**
   * Validate rating is within range
   *
   * @param rating - Rating value
   * @returns true if valid
   *
   * @private
   */
  private isValidRating(rating: number): boolean {
    return Number.isInteger(rating) && rating >= MIN_RATING && rating <= MAX_RATING;
  }

  /**
   * Get transaction (mock implementation until TransactionRepository exists)
   *
   * @param transactionId - Transaction ID
   * @returns Transaction
   *
   * @private
   */
  private async getTransaction(transactionId: string): Promise<any> {
    // TODO: Replace with actual TransactionRepository.findById() call
    console.warn(
      '[ReviewService] Using temporary transaction lookup - replace with TransactionRepository'
    );

    if (this.transactionRepository) {
      return await this.transactionRepository.findById(transactionId);
    }

    throw new ReviewValidationError(
      'Transaction lookup not yet implemented',
      'transactionId'
    );
  }
}
