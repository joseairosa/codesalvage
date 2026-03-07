/**
 * GET /api/u/[username]/reviews
 *
 * Public endpoint for paginated seller reviews.
 * Used by SellerReviewsSection for client-side pagination.
 *
 * @example
 * GET /api/u/johndoe/reviews?page=1&limit=10
 */

import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { ReviewRepository } from '@/lib/repositories/ReviewRepository';
import { withPublicRateLimit } from '@/lib/middleware/withRateLimit';

const componentName = 'SellerReviewsAPI';

const userRepository = new UserRepository(prisma);
const reviewRepository = new ReviewRepository(prisma);

async function getSellerReviews(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '10', 10)));

    console.log(`[${componentName}] Fetching reviews for username:`, username, { page, limit });

    const user = await userRepository.findByUsername(username);

    if (!user || !user.isSeller || user.isBanned) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    const result = await reviewRepository.getSellerReviews(user.id, { page, limit });

    // Mask anonymous buyer info
    const reviews = result.reviews.map((review) => ({
      ...review,
      buyer: review.isAnonymous
        ? { id: review.buyer.id, username: 'Anonymous', fullName: null, avatarUrl: null }
        : review.buyer,
    }));

    console.log(`[${componentName}] Returning ${reviews.length} reviews (total: ${result.total})`);

    return NextResponse.json(
      {
        reviews,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
          hasNext: result.hasNext,
          hasPrev: result.hasPrev,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error fetching reviews:`, error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

export const GET = withPublicRateLimit(getSellerReviews);
