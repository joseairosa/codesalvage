/**
 * Favorites API Route
 *
 * Handles user favorite/watchlist operations.
 *
 * GET /api/favorites - List user's favorite projects
 * POST /api/favorites - Add project to favorites
 *
 * @example
 * GET /api/favorites?page=1&limit=20
 * POST /api/favorites { projectId }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { withApiRateLimit } from '@/lib/middleware/withRateLimit';
import {
  FavoriteService,
  FavoriteValidationError,
  FavoritePermissionError,
} from '@/lib/services/FavoriteService';
import { FavoriteRepository } from '@/lib/repositories/FavoriteRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import { z } from 'zod';

const componentName = 'FavoritesAPI';

// Initialize repositories and service
const favoriteRepository = new FavoriteRepository(prisma);
const userRepository = new UserRepository(prisma);
const projectRepository = new ProjectRepository(prisma);
const favoriteService = new FavoriteService(
  favoriteRepository,
  userRepository,
  projectRepository
);

const addFavoriteSchema = z.object({
  projectId: z.string(),
});

/**
 * GET /api/favorites (internal handler)
 *
 * List user's favorite projects with pagination
 */
async function listFavorites(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    console.log(`[${componentName}] Fetching favorites for user:`, session.user.id);

    // Use FavoriteService to get favorites
    const result = await favoriteService.getUserFavorites(session.user.id, {
      page,
      limit,
    });

    console.log(`[${componentName}] Found ${result.favorites.length} favorites`);

    return NextResponse.json(
      {
        favorites: result.favorites,
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
    console.error(`[${componentName}] Error fetching favorites:`, error);

    return NextResponse.json(
      {
        error: 'Failed to fetch favorites',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/favorites (internal handler)
 *
 * Add a project to user's favorites
 */
async function addFavorite(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = addFavoriteSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validatedData.error.errors,
        },
        { status: 400 }
      );
    }

    const { projectId } = validatedData.data;

    console.log(`[${componentName}] Adding favorite:`, {
      userId: session.user.id,
      projectId,
    });

    // Use FavoriteService to add favorite
    const favorite = await favoriteService.addFavorite(session.user.id, projectId);

    console.log(`[${componentName}] Favorite added:`, favorite.id);

    return NextResponse.json({ favorite }, { status: 201 });
  } catch (error) {
    console.error(`[${componentName}] Error adding favorite:`, error);

    // Map service errors to appropriate HTTP status codes
    if (error instanceof FavoriteValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          field: error.field,
        },
        { status: 400 }
      );
    }

    if (error instanceof FavoritePermissionError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to add favorite',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Export rate-limited handlers
 *
 * GET: API rate limiting (100 requests / minute per user)
 * POST: API rate limiting (100 requests / minute per user)
 */
export const GET = withApiRateLimit(listFavorites, async (request) => {
  const session = await auth();
  return session?.user?.id || 'anonymous';
});

export const POST = withApiRateLimit(addFavorite, async (request) => {
  const session = await auth();
  return session?.user?.id || 'anonymous';
});
