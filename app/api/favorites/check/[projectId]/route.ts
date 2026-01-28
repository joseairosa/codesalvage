/**
 * Check Favorite Status API Route
 *
 * Check if user has favorited a specific project.
 *
 * GET /api/favorites/check/[projectId] - Check favorite status
 *
 * @example
 * GET /api/favorites/check/project123
 * Response: { isFavorited: true }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { FavoriteService } from '@/lib/services/FavoriteService';
import { withApiRateLimit } from '@/lib/middleware/withRateLimit';
import { FavoriteRepository } from '@/lib/repositories/FavoriteRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';

const componentName = 'CheckFavoriteAPI';

// Initialize repositories and service
const favoriteRepository = new FavoriteRepository(prisma);
const userRepository = new UserRepository(prisma);
const projectRepository = new ProjectRepository(prisma);
const favoriteService = new FavoriteService(
  favoriteRepository,
  userRepository,
  projectRepository
);

/**
 * GET /api/favorites/check/[projectId] (internal handler)
 *
 * Check if user has favorited a project
 */
async function checkFavoriteStatus(
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = params;

    console.log(`[${componentName}] Checking favorite status:`, {
      userId: session.user.id,
      projectId,
    });

    // Use FavoriteService to check status
    const isFavorited = await favoriteService.isFavorited(session.user.id, projectId);

    console.log(`[${componentName}] Favorite status:`, isFavorited);

    return NextResponse.json({ isFavorited }, { status: 200 });
  } catch (error) {
    console.error(`[${componentName}] Error checking favorite status:`, error);

    return NextResponse.json(
      {
        error: 'Failed to check favorite status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Export rate-limited handler
 *
 * GET: API rate limiting (100 requests / minute per user)
 */
export const GET = withApiRateLimit(checkFavoriteStatus, async (request) => {
  const session = await auth();
  return session?.user?.id || 'anonymous';
});
