/**
 * Reviews API Route
 *
 * Handles review operations for post-purchase seller ratings.
 *
 * GET /api/reviews?sellerId=xxx - List reviews for a seller
 * POST /api/reviews - Submit a new review
 *
 * @example
 * GET /api/reviews?sellerId=user123&limit=10
 * POST /api/reviews { transactionId, overallRating, comment, ... }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { withApiRateLimit, withPublicRateLimit } from '@/lib/middleware/withRateLimit';
import {
  ReviewService,
  ReviewValidationError,
  ReviewPermissionError,
} from '@/lib/services/ReviewService';
import { ReviewRepository } from '@/lib/repositories/ReviewRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import { z } from 'zod';

const componentName = 'ReviewsAPI';

// Initialize repositories and service
const reviewRepository = new ReviewRepository(prisma);
const userRepository = new UserRepository(prisma);
const transactionRepository = new TransactionRepository(prisma);
const reviewService = new ReviewService(
  reviewRepository,
  userRepository,
  transactionRepository,
  undefined // emailService - service will handle
);

const createReviewSchema = z.object({
  transactionId: z.string(),
  overallRating: z.number().min(1).max(5),
  comment: z.string().max(2000).optional(),
  codeQualityRating: z.number().min(1).max(5).optional(),
  documentationRating: z.number().min(1).max(5).optional(),
  responsivenessRating: z.number().min(1).max(5).optional(),
  accuracyRating: z.number().min(1).max(5).optional(),
  isAnonymous: z.boolean().optional(),
});

/**
 * GET /api/reviews (internal handler)
 *
 * List reviews for a seller
 */
async function listReviews(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sellerId = searchParams.get('sellerId');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!sellerId) {
      return NextResponse.json(
        { error: 'sellerId query parameter is required' },
        { status: 400 }
      );
    }

    console.log(`[${componentName}] Fetching reviews for seller:`, sellerId);

    // Convert offset to page number
    const page = Math.floor(offset / limit) + 1;

    // Use ReviewService to get reviews
    const result = await reviewService.getSellerReviews(sellerId, {
      page,
      limit,
    });

    // Anonymize buyer info if requested
    const sanitizedReviews = result.reviews.map((review) => ({
      ...review,
      buyer: review.isAnonymous
        ? {
            id: 'anonymous',
            username: 'Anonymous',
            fullName: null,
            avatarUrl: null,
          }
        : review.buyer,
    }));

    console.log(`[${componentName}] Found ${result.reviews.length} reviews`);

    return NextResponse.json(
      {
        reviews: sanitizedReviews,
        total: result.total,
        limit: result.limit,
        offset: (result.page - 1) * result.limit,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error fetching reviews:`, error);

    return NextResponse.json(
      {
        error: 'Failed to fetch reviews',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reviews (internal handler)
 *
 * Submit a new review
 */
async function createReview(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createReviewSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validatedData.error.errors,
        },
        { status: 400 }
      );
    }

    const {
      transactionId,
      overallRating,
      comment,
      codeQualityRating,
      documentationRating,
      responsivenessRating,
      accuracyRating,
      isAnonymous,
    } = validatedData.data;

    console.log(`[${componentName}] Creating review for transaction:`, transactionId);

    // Filter out undefined values for exactOptionalPropertyTypes
    const reviewData: any = {
      transactionId,
      overallRating,
    };
    if (comment !== undefined) reviewData.comment = comment;
    if (codeQualityRating !== undefined) reviewData.codeQualityRating = codeQualityRating;
    if (documentationRating !== undefined)
      reviewData.documentationRating = documentationRating;
    if (responsivenessRating !== undefined)
      reviewData.responsivenessRating = responsivenessRating;
    if (accuracyRating !== undefined) reviewData.accuracyRating = accuracyRating;
    if (isAnonymous !== undefined) reviewData.isAnonymous = isAnonymous;

    // Use ReviewService to create review
    const review = await reviewService.createReview(auth.user.id, reviewData);

    console.log(`[${componentName}] Review created:`, review.id);

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    console.error(`[${componentName}] Error creating review:`, error);

    // Map service errors to appropriate HTTP status codes
    if (error instanceof ReviewValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          field: error.field,
        },
        { status: 400 }
      );
    }

    if (error instanceof ReviewPermissionError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to create review',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Export rate-limited handlers
 *
 * GET: Public rate limiting (1000 requests / hour per IP) - anyone can view reviews
 * POST: API rate limiting (100 requests / minute per user) - authenticated only
 */
export const GET = withPublicRateLimit(listReviews);

export const POST = withApiRateLimit(createReview, async (request) => {
  const auth = await authenticateApiRequest(request);
  return auth?.user.id || 'anonymous';
});
