/**
 * Seller Review Stats API Route
 *
 * Get aggregated review statistics for a seller.
 *
 * GET /api/reviews/stats/[sellerId]
 *
 * @example
 * GET /api/reviews/stats/user123
 * Response: { averageRating, totalReviews, ratingDistribution, ... }
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ReviewService } from '@/lib/services/ReviewService';
import { ReviewRepository } from '@/lib/repositories/ReviewRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';

const componentName = 'ReviewStatsAPI';

// Initialize repositories and service
const reviewRepository = new ReviewRepository(prisma);
const userRepository = new UserRepository(prisma);
const reviewService = new ReviewService(
  reviewRepository,
  userRepository
);

/**
 * GET /api/reviews/stats/[sellerId]
 *
 * Get seller review statistics
 */
export async function GET(
  _request: Request,
  { params }: { params: { sellerId: string } }
) {
  try {
    const { sellerId } = params;

    console.log(`[${componentName}] Fetching stats for seller:`, sellerId);

    // Use ReviewService to get rating stats
    const stats = await reviewService.getSellerRatingStats(sellerId);

    // Get seller analytics for additional info
    const analytics = await prisma.sellerAnalytics.findUnique({
      where: { sellerId },
    });

    console.log(`[${componentName}] Stats calculated:`, {
      averageRating: stats.averageRating,
      totalReviews: stats.totalReviews,
    });

    // Return stats in expected format
    return NextResponse.json(
      {
        sellerId,
        totalReviews: stats.totalReviews,
        averageRating: stats.totalReviews > 0 ? stats.averageRating : null,
        ratingDistribution: stats.ratingBreakdown,
        detailedAverages: {
          codeQuality: null, // Not yet calculated by service
          documentation: null,
          responsiveness: null,
          accuracy: null,
        },
        analytics, // Include full analytics if available
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error fetching stats:`, error);

    return NextResponse.json(
      {
        error: 'Failed to fetch review stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
