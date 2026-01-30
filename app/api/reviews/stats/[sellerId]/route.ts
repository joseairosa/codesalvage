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

import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ReviewService } from '@/lib/services/ReviewService';
import { ReviewRepository } from '@/lib/repositories/ReviewRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { withPublicRateLimit } from '@/lib/middleware/withRateLimit';
import { getOrSetCache, CacheKeys, CacheTTL } from '@/lib/utils/cache';

const componentName = 'ReviewStatsAPI';

// Initialize repositories and service
const reviewRepository = new ReviewRepository(prisma);
const userRepository = new UserRepository(prisma);
const reviewService = new ReviewService(reviewRepository, userRepository);

/**
 * GET /api/reviews/stats/[sellerId] (internal handler)
 *
 * Get seller review statistics
 * Cached for 15 minutes (expensive aggregation queries)
 */
async function getSellerStats(
  _request: NextRequest,
  { params }: { params: { sellerId: string } }
) {
  try {
    const { sellerId } = params;

    console.log(`[${componentName}] Fetching stats for seller:`, sellerId);

    // Get cached rating stats or fetch fresh data
    const result = await getOrSetCache(
      CacheKeys.sellerRatingStats(sellerId),
      CacheTTL.ANALYTICS,
      async () => {
        // Use ReviewService to get rating stats
        const stats = await reviewService.getSellerRatingStats(sellerId);

        // Get seller analytics for additional info
        const analytics = await prisma.sellerAnalytics.findUnique({
          where: { sellerId },
        });

        return {
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
        };
      }
    );

    console.log(`[${componentName}] Stats calculated:`, {
      averageRating: result.averageRating,
      totalReviews: result.totalReviews,
    });

    // Return stats
    return NextResponse.json(result, { status: 200 });
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

/**
 * Export rate-limited handler
 *
 * GET: Public rate limiting (1000 requests / hour per IP) - publicly accessible stats
 */
export const GET = withPublicRateLimit(getSellerStats);
