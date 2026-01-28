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

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
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
  _request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = params;

    console.log(`[${componentName}] Removing favorite:`, {
      userId: session.user.id,
      projectId,
    });

    // Use FavoriteService to remove favorite
    const removed = await favoriteService.removeFavorite(session.user.id, projectId);

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
export const DELETE = withApiRateLimit(removeFavorite, async (_request) => {
  const session = await auth();
  return session?.user?.id || 'anonymous';
});
