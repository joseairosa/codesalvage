/**
 * Favorite Project API Route
 *
 * Remove a project from user's favorites.
 *
 * DELETE /api/favorites/[projectId] - Remove favorite
 *
 * @example
 * DELETE /api/favorites/project123
 */

import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { FavoriteService } from '@/lib/services/FavoriteService';
import { withApiRateLimit } from '@/lib/middleware/withRateLimit';
import { FavoriteRepository } from '@/lib/repositories/FavoriteRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';

const componentName = 'FavoriteProjectAPI';

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
 * DELETE /api/favorites/[projectId] (internal handler)
 *
 * Remove a project from favorites
 */
async function removeFavorite(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;

    console.log(`[${componentName}] Removing favorite:`, {
      userId: auth.user.id,
      projectId,
    });

    // Use FavoriteService to remove favorite
    const removed = await favoriteService.removeFavorite(auth.user.id, projectId);

    if (!removed) {
      return NextResponse.json({ error: 'Favorite not found' }, { status: 404 });
    }

    console.log(`[${componentName}] Favorite removed successfully`);

    return NextResponse.json(
      { success: true, message: 'Favorite removed' },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error removing favorite:`, error);

    return NextResponse.json(
      {
        error: 'Failed to remove favorite',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Export rate-limited handler
 *
 * DELETE: API rate limiting (100 requests / minute per user)
 */
export const DELETE = withApiRateLimit(removeFavorite, async (request) => {
  const auth = await authenticateApiRequest(request);
  return auth?.user.id || 'anonymous';
});
