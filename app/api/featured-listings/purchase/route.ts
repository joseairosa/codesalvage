/**
 * Featured Listing Purchase API Route
 *
 * Handles featured placement purchases for sellers.
 *
 * POST /api/featured-listings/purchase - Purchase featured placement
 *
 * @example
 * POST /api/featured-listings/purchase
 * {
 *   "projectId": "proj123",
 *   "durationDays": 7
 * }
 */

import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import {
  FeaturedListingRepository,
  ProjectRepository,
  UserRepository,
  SubscriptionRepository,
} from '@/lib/repositories';
import {
  FeaturedListingService,
  SubscriptionService,
  FeaturedListingValidationError,
  FeaturedListingPermissionError,
  FeaturedListingNotFoundError,
} from '@/lib/services';
import { z } from 'zod';

const componentName = 'FeaturedListingPurchaseAPI';

// Initialize repositories and services
const featuredListingRepository = new FeaturedListingRepository(prisma);
const projectRepository = new ProjectRepository(prisma);
const userRepository = new UserRepository(prisma);
const subscriptionRepository = new SubscriptionRepository(prisma);
const subscriptionService = new SubscriptionService(
  subscriptionRepository,
  userRepository
);
const featuredListingService = new FeaturedListingService(
  featuredListingRepository,
  projectRepository,
  userRepository,
  subscriptionService
);

/**
 * Purchase request schema
 */
const purchaseSchema = z.object({
  projectId: z.string(),
  durationDays: z.number().int().positive(),
});

/**
 * POST /api/featured-listings/purchase
 *
 * Purchase featured placement for a project
 *
 * Access control: Only sellers can purchase
 * Business rules:
 * - Valid durations: 7, 14, 30 days
 * - Pro subscribers get 20% discount
 * - Only active projects can be featured
 * - Seller must own the project
 */
export async function POST(request: Request) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = purchaseSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validatedData.error.errors,
        },
        { status: 400 }
      );
    }

    const { projectId, durationDays } = validatedData.data;

    console.log(`[${componentName}] Processing purchase:`, {
      userId: auth.user.id,
      projectId,
      durationDays,
    });

    // Purchase featured placement
    const result = await featuredListingService.purchaseFeaturedPlacement(
      auth.user.id,
      {
        projectId,
        durationDays,
      }
    );

    console.log(`[${componentName}] Featured placement purchased successfully`);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(`[${componentName}] Error purchasing featured placement:`, error);

    // Map service errors to appropriate HTTP status codes
    if (error instanceof FeaturedListingValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          field: error.field,
        },
        { status: 400 }
      );
    }

    if (error instanceof FeaturedListingPermissionError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 403 }
      );
    }

    if (error instanceof FeaturedListingNotFoundError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to purchase featured placement',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
