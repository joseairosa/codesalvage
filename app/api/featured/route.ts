/**
 * Featured Listings API Route
 *
 * Handles featured project operations.
 *
 * GET /api/featured - List featured projects (public)
 * POST /api/featured - Purchase featured placement (sellers only)
 *
 * @example
 * GET /api/featured?page=1&limit=10
 * POST /api/featured { projectId, durationDays }
 */

import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import {
  FeaturedListingService,
  FeaturedListingValidationError,
  FeaturedListingPermissionError,
  FeaturedListingNotFoundError,
} from '@/lib/services/FeaturedListingService';
import { FeaturedListingRepository } from '@/lib/repositories/FeaturedListingRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { SubscriptionRepository } from '@/lib/repositories/SubscriptionRepository';
import { SubscriptionService } from '@/lib/services/SubscriptionService';
import { getOrSetCache, CacheKeys, CacheTTL, invalidateCache } from '@/lib/utils/cache';
import { z } from 'zod';

const componentName = 'FeaturedListingsAPI';

// Initialize repositories and service
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

const purchaseFeaturedSchema = z.object({
  projectId: z.string(),
  durationDays: z.number().int().positive(),
});

/**
 * GET /api/featured
 *
 * List all active featured projects (public endpoint)
 * Cached for 5 minutes (featured listings change infrequently)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    console.log(`[${componentName}] Fetching featured projects:`, { page, limit });

    // Get cached featured projects or fetch fresh data
    const result = await getOrSetCache(
      CacheKeys.featuredProjects(page, limit),
      CacheTTL.FEATURED_PROJECTS,
      async () => {
        return await featuredListingService.getFeaturedProjects(page, limit);
      }
    );

    console.log(`[${componentName}] Found ${result.projects.length} featured projects`);

    return NextResponse.json(
      {
        projects: result.projects,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasNext: result.hasNext,
        hasPrev: result.hasPrev,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error fetching featured projects:`, error);

    return NextResponse.json(
      {
        error: 'Failed to fetch featured projects',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/featured
 *
 * ⚠️ ADMIN/INTERNAL USE ONLY ⚠️
 *
 * Manually set project as featured WITHOUT payment.
 * Used for:
 * - Promotional featured placements
 * - Refunds/compensations
 * - Testing
 *
 * IMPORTANT: In production, this should be restricted to admin users only.
 * Regular sellers should use POST /api/featured/create-payment-intent
 *
 * @deprecated Use create-payment-intent for paid featured placements
 */
export async function POST(request: Request) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = purchaseFeaturedSchema.safeParse(body);

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

    console.log(`[${componentName}] Purchasing featured placement:`, {
      userId: auth.user.id,
      projectId,
      durationDays,
    });

    const result = await featuredListingService.purchaseFeaturedPlacement(auth.user.id, {
      projectId,
      durationDays,
    });

    console.log(`[${componentName}] Featured placement purchased:`, result.projectId);

    // Invalidate featured projects cache (new placement should appear in list)
    await invalidateCache.featured();

    return NextResponse.json(
      {
        projectId: result.projectId,
        featuredUntil: result.featuredUntil,
        durationDays: result.durationDays,
        costCents: result.costCents,
        message: result.message,
      },
      { status: 201 }
    );
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
