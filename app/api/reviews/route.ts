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

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services';
import { env } from '@/config/env';
import { z } from 'zod';

const componentName = 'ReviewsAPI';

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
 * GET /api/reviews
 *
 * List reviews for a seller
 */
export async function GET(request: Request) {
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

    // Validate seller exists
    const seller = await prisma.user.findUnique({
      where: { id: sellerId },
      select: { id: true, username: true },
    });

    if (!seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    // Get total count
    const totalCount = await prisma.review.count({
      where: { sellerId },
    });

    // Get reviews with pagination
    const reviews = await prisma.review.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      skip: offset,
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
    });

    // Anonymize buyer info if requested
    const sanitizedReviews = reviews.map((review) => ({
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

    console.log(`[${componentName}] Found ${reviews.length} reviews`);

    return NextResponse.json(
      {
        reviews: sanitizedReviews,
        total: totalCount,
        limit,
        offset,
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
 * POST /api/reviews
 *
 * Submit a new review
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
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

    // Get transaction and validate
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        seller: {
          select: {
            id: true,
            username: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
          },
        },
        review: true, // Check if review already exists
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Only buyer can review
    if (transaction.buyerId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the buyer can review this transaction' },
        { status: 403 }
      );
    }

    // Payment must be successful
    if (transaction.paymentStatus !== 'succeeded') {
      return NextResponse.json(
        { error: 'Cannot review transaction that did not complete successfully' },
        { status: 400 }
      );
    }

    // Check if review already exists
    if (transaction.review) {
      return NextResponse.json(
        { error: 'You have already reviewed this transaction' },
        { status: 400 }
      );
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        transactionId,
        sellerId: transaction.sellerId,
        buyerId: session.user.id,
        overallRating,
        comment: comment || null,
        codeQualityRating: codeQualityRating || null,
        documentationRating: documentationRating || null,
        responsivenessRating: responsivenessRating || null,
        accuracyRating: accuracyRating || null,
        isAnonymous: isAnonymous || false,
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

    console.log(`[${componentName}] Review created:`, review.id);

    // Update seller analytics (average rating, total reviews)
    await updateSellerAnalytics(transaction.sellerId);

    // Send review notification to seller
    const appUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3011';
    const reviewUrl = `${appUrl}/seller/reviews`; // Or specific review page if it exists

    try {
      await emailService.sendReviewNotification(
        {
          email: transaction.seller.email!,
          name: transaction.seller.fullName || transaction.seller.username,
        },
        {
          sellerName: transaction.seller.fullName || transaction.seller.username,
          buyerName: review.buyer.fullName || review.buyer.username,
          projectTitle: review.transaction.project.title,
          rating: review.overallRating,
          comment: review.comment || undefined,
          reviewUrl,
        }
      );

      console.log(`[${componentName}] Review notification sent to seller`);
    } catch (emailError) {
      console.error(`[${componentName}] Failed to send email notification:`, emailError);
      // Don't fail review creation if email fails
    }

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    console.error(`[${componentName}] Error creating review:`, error);

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
 * Update seller analytics after new review
 */
async function updateSellerAnalytics(sellerId: string) {
  console.log(`[${componentName}] Updating analytics for seller:`, sellerId);

  // Get all reviews for seller
  const reviews = await prisma.review.findMany({
    where: { sellerId },
    select: { overallRating: true },
  });

  if (reviews.length === 0) return;

  // Calculate average rating
  const totalRating = reviews.reduce((sum, review) => sum + review.overallRating, 0);
  const averageRating = totalRating / reviews.length;

  // Update or create seller analytics
  await prisma.sellerAnalytics.upsert({
    where: { sellerId },
    update: {
      averageRating,
      totalReviews: reviews.length,
    },
    create: {
      sellerId,
      averageRating,
      totalReviews: reviews.length,
      totalProjectsListed: 0,
      totalProjectsSold: 0,
      totalRevenueCents: 0,
      totalFavorites: 0,
      totalViews: 0,
    },
  });

  console.log(`[${componentName}] Analytics updated:`, {
    averageRating: averageRating.toFixed(2),
    totalReviews: reviews.length,
  });
}
