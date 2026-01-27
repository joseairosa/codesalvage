/**
 * FavoriteRepository - Data Access Layer for Favorites
 *
 * Responsibilities:
 * - CRUD operations for favorites (user project watchlist)
 * - Query user favorites with pagination
 * - Check if project is favorited by user
 * - Count project favorites
 * - Update project favorite count
 *
 * Architecture:
 * - Repository Pattern: Abstracts database operations
 * - Single Responsibility: Only handles data access
 * - Type-safe: Returns properly typed Prisma models
 * - Error handling: Catches and wraps database errors
 *
 * @example
 * const favoriteRepo = new FavoriteRepository(prisma);
 * const favorite = await favoriteRepo.create('user123', 'project456');
 */

import type { PrismaClient, Favorite } from '@prisma/client';

/**
 * Favorite with project details
 */
export interface FavoriteWithProject extends Favorite {
  project: {
    id: string;
    title: string;
    description: string;
    thumbnailImageUrl: string | null;
    priceCents: number;
    completionPercentage: number;
    status: string;
    seller: {
      id: string;
      username: string;
      fullName: string | null;
      avatarUrl: string | null;
    };
  };
}

/**
 * Paginated favorites response
 */
export interface PaginatedFavorites {
  favorites: FavoriteWithProject[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export class FavoriteRepository {
  constructor(private prisma: PrismaClient) {
    console.log('[FavoriteRepository] Initialized');
  }

  /**
   * Create a favorite (add project to user's watchlist)
   *
   * @param userId - User ID
   * @param projectId - Project ID
   * @returns Created favorite
   * @throws Error if database operation fails
   *
   * @example
   * const favorite = await favoriteRepo.create('user123', 'project456');
   */
  async create(userId: string, projectId: string): Promise<Favorite> {
    console.log('[FavoriteRepository] Creating favorite:', { userId, projectId });

    try {
      const favorite = await this.prisma.favorite.create({
        data: {
          userId,
          projectId,
        },
      });

      console.log('[FavoriteRepository] Favorite created:', favorite.id);
      return favorite;
    } catch (error) {
      console.error('[FavoriteRepository] create failed:', error);
      throw new Error('[FavoriteRepository] Failed to create favorite');
    }
  }

  /**
   * Delete a favorite (remove project from user's watchlist)
   *
   * @param userId - User ID
   * @param projectId - Project ID
   * @returns Deleted favorite
   * @throws Error if favorite not found or database operation fails
   *
   * @example
   * const deleted = await favoriteRepo.delete('user123', 'project456');
   */
  async delete(userId: string, projectId: string): Promise<Favorite> {
    console.log('[FavoriteRepository] Deleting favorite:', { userId, projectId });

    try {
      // Find the favorite first
      const favorite = await this.prisma.favorite.findFirst({
        where: {
          userId,
          projectId,
        },
      });

      if (!favorite) {
        throw new Error('Favorite not found');
      }

      // Delete by ID
      const deleted = await this.prisma.favorite.delete({
        where: { id: favorite.id },
      });

      console.log('[FavoriteRepository] Favorite deleted:', deleted.id);
      return deleted;
    } catch (error) {
      console.error('[FavoriteRepository] delete failed:', error);
      throw new Error('[FavoriteRepository] Failed to delete favorite');
    }
  }

  /**
   * Check if user has favorited a project
   *
   * @param userId - User ID
   * @param projectId - Project ID
   * @returns true if favorited
   *
   * @example
   * const isFavorited = await favoriteRepo.isFavorited('user123', 'project456');
   */
  async isFavorited(userId: string, projectId: string): Promise<boolean> {
    console.log('[FavoriteRepository] Checking if favorited:', { userId, projectId });

    try {
      const favorite = await this.prisma.favorite.findFirst({
        where: {
          userId,
          projectId,
        },
      });

      console.log('[FavoriteRepository] Is favorited:', !!favorite);
      return favorite !== null;
    } catch (error) {
      console.error('[FavoriteRepository] isFavorited failed:', error);
      throw new Error('[FavoriteRepository] Failed to check favorite status');
    }
  }

  /**
   * Get user favorites with pagination
   *
   * @param userId - User ID
   * @param options - Pagination options
   * @returns Paginated favorites with project details
   *
   * @example
   * const favorites = await favoriteRepo.getUserFavorites('user123', { page: 1, limit: 20 });
   */
  async getUserFavorites(
    userId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedFavorites> {
    console.log('[FavoriteRepository] Getting favorites for user:', userId);

    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    try {
      const [favorites, total] = await Promise.all([
        this.prisma.favorite.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            project: {
              include: {
                seller: {
                  select: {
                    id: true,
                    username: true,
                    fullName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.favorite.count({
          where: { userId },
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      console.log('[FavoriteRepository] Found', favorites.length, 'favorites');

      return {
        favorites: favorites as FavoriteWithProject[],
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    } catch (error) {
      console.error('[FavoriteRepository] getUserFavorites failed:', error);
      throw new Error('[FavoriteRepository] Failed to get user favorites');
    }
  }

  /**
   * Get list of user IDs who favorited a project
   *
   * @param projectId - Project ID
   * @returns Array of user IDs
   *
   * @example
   * const userIds = await favoriteRepo.getProjectFavoriters('project456');
   */
  async getProjectFavoriters(projectId: string): Promise<string[]> {
    console.log('[FavoriteRepository] Getting favoriters for project:', projectId);

    try {
      const favorites = await this.prisma.favorite.findMany({
        where: { projectId },
        select: { userId: true },
      });

      const userIds = favorites.map((f) => f.userId);
      console.log('[FavoriteRepository] Found', userIds.length, 'favoriters');
      return userIds;
    } catch (error) {
      console.error('[FavoriteRepository] getProjectFavoriters failed:', error);
      throw new Error('[FavoriteRepository] Failed to get project favoriters');
    }
  }

  /**
   * Get favorite count for a project
   *
   * @param projectId - Project ID
   * @returns Favorite count
   *
   * @example
   * const count = await favoriteRepo.getProjectFavoriteCount('project456');
   */
  async getProjectFavoriteCount(projectId: string): Promise<number> {
    console.log('[FavoriteRepository] Getting favorite count for project:', projectId);

    try {
      const count = await this.prisma.favorite.count({
        where: { projectId },
      });

      console.log('[FavoriteRepository] Favorite count:', count);
      return count;
    } catch (error) {
      console.error('[FavoriteRepository] getProjectFavoriteCount failed:', error);
      throw new Error('[FavoriteRepository] Failed to get project favorite count');
    }
  }

  /**
   * Update project favorite count in projects table
   *
   * @param projectId - Project ID
   * @param increment - true to increment, false to decrement
   * @returns void
   *
   * @example
   * await favoriteRepo.updateProjectFavoriteCount('project456', true);
   */
  async updateProjectFavoriteCount(
    projectId: string,
    increment: boolean
  ): Promise<void> {
    console.log('[FavoriteRepository] Updating project favorite count:', {
      projectId,
      increment,
    });

    try {
      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          favoriteCount: {
            [increment ? 'increment' : 'decrement']: 1,
          },
        },
      });

      console.log('[FavoriteRepository] Project favorite count updated');
    } catch (error) {
      console.error('[FavoriteRepository] updateProjectFavoriteCount failed:', error);
      throw new Error('[FavoriteRepository] Failed to update project favorite count');
    }
  }
}
