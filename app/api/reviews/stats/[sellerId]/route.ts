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

const componentName = 'ReviewStatsAPI';

/**
 * GET /api/reviews/stats/[sellerId]
 *
 * Get seller review statistics
 */
export async function GET(
  request: Request,
  { params }: { params: { sellerId: string } }
) {
  try {
    const { sellerId } = params;

    console.log(`[${componentName}] Fetching stats for seller:`, sellerId);

    // Validate seller exists
    const seller = await prisma.user.findUnique({
      where: { id: sellerId },
      select: { id: true, username: true },
    });

    if (!seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    // Get all reviews for seller
    const reviews = await prisma.review.findMany({
      where: { sellerId },
      select: {
        overallRating: true,
        codeQualityRating: true,
        documentationRating: true,
        responsivenessRating: true,
        accuracyRating: true,
      },
    });

    const totalReviews = reviews.length;

    if (totalReviews === 0) {
      return NextResponse.json(
        {
          sellerId,
          totalReviews: 0,
          averageRating: null,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          detailedAverages: {
            codeQuality: null,
            documentation: null,
            responsiveness: null,
            accuracy: null,
          },
        },
        { status: 200 }
      );
    }

    // Calculate overall average rating
    const totalRating = reviews.reduce((sum, review) => sum + review.overallRating, 0);
    const averageRating = parseFloat((totalRating / totalReviews).toFixed(2));

    // Calculate rating distribution (1-5 stars)
    const ratingDistribution = {
      1: reviews.filter((r) => r.overallRating === 1).length,
      2: reviews.filter((r) => r.overallRating === 2).length,
      3: reviews.filter((r) => r.overallRating === 3).length,
      4: reviews.filter((r) => r.overallRating === 4).length,
      5: reviews.filter((r) => r.overallRating === 5).length,
    };

    // Calculate detailed ratings (only if provided)
    const calculateDetailedAverage = (field: keyof typeof reviews[0]) => {
      const validReviews = reviews.filter((r) => r[field] !== null);
      if (validReviews.length === 0) return null;

      const total = validReviews.reduce((sum, r) => sum + (r[field] as number), 0);
      return parseFloat((total / validReviews.length).toFixed(2));
    };

    const detailedAverages = {
      codeQuality: calculateDetailedAverage('codeQualityRating'),
      documentation: calculateDetailedAverage('documentationRating'),
      responsiveness: calculateDetailedAverage('responsivenessRating'),
      accuracy: calculateDetailedAverage('accuracyRating'),
    };

    // Get seller analytics (should match calculated values)
    const analytics = await prisma.sellerAnalytics.findUnique({
      where: { sellerId },
    });

    console.log(`[${componentName}] Stats calculated:`, {
      averageRating,
      totalReviews,
    });

    return NextResponse.json(
      {
        sellerId,
        totalReviews,
        averageRating,
        ratingDistribution,
        detailedAverages,
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
