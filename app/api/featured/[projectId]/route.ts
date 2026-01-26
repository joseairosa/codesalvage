/**
 * Featured Listing Project API Route
 *
 * DELETE /api/featured/[projectId] - Remove featured status from project
 *
 * @example
 * DELETE /api/featured/proj_123
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  FeaturedListingService,
  FeaturedListingPermissionError,
  FeaturedListingNotFoundError,
} from '@/lib/services/FeaturedListingService';
import { FeaturedListingRepository } from '@/lib/repositories/FeaturedListingRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { SubscriptionRepository } from '@/lib/repositories/SubscriptionRepository';
import { SubscriptionService } from '@/lib/services/SubscriptionService';

const componentName = 'FeaturedListingProjectAPI';

// Initialize repositories and service
const featuredListingRepository = new FeaturedListingRepository(prisma);
const projectRepository = new ProjectRepository(prisma);
const userRepository = new UserRepository(prisma);
const subscriptionRepository = new SubscriptionRepository(prisma);
const subscriptionService = new SubscriptionService(subscriptionRepository, userRepository);
const featuredListingService = new FeaturedListingService(
  featuredListingRepository,
  projectRepository,
  userRepository,
  subscriptionService
);

/**
 * DELETE /api/featured/[projectId]
 *
 * Remove featured status from a project (seller only)
 */
export async function DELETE(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = params;

    console.log(`[${componentName}] Removing featured status:`, {
      userId: session.user.id,
      projectId,
    });

    await featuredListingService.removeFeaturedStatus(session.user.id, projectId);

    console.log(`[${componentName}] Featured status removed:`, projectId);

    return NextResponse.json(
      {
        message: 'Featured status removed successfully',
        projectId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error removing featured status:`, error);

    // Map service errors to appropriate HTTP status codes
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
        error: 'Failed to remove featured status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
