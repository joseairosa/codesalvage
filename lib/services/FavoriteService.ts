/**
 * FavoriteService - Business Logic for Favorites
 *
 * Responsibilities:
 * - Validate favorite operations before database operations
 * - Implement business rules (cannot favorite own project, project must be active)
 * - Verify user and project existence
 * - Handle duplicate favorites gracefully
 * - Update project favorite counts after add/remove
 *
 * Architecture:
 * - Service Pattern: Encapsulates business logic
 * - Single Responsibility: Manages favorite-related operations
 * - Dependency Injection: Receives repositories via constructor
 * - Error handling: Provides business-level error messages
 *
 * @example
 * const favoriteService = new FavoriteService(favoriteRepo, userRepo, projectRepo);
 * const favorite = await favoriteService.addFavorite(userId, projectId);
 */

import {
  FavoriteRepository,
  FavoriteWithProject,
  PaginatedFavorites,
  PaginationOptions,
} from '@/lib/repositories/FavoriteRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import type { Favorite } from '@prisma/client';

/**
 * Favorite validation errors
 */
export class FavoriteValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'FavoriteValidationError';
  }
}

/**
 * Favorite permission error
 */
export class FavoritePermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FavoritePermissionError';
  }
}

/**
 * Toggle favorite result
 */
export interface ToggleFavoriteResult {
  isFavorited: boolean;
  favorite?: Favorite;
}

/**
 * FavoriteService
 *
 * Handles all business logic for favorites.
 */
export class FavoriteService {
  constructor(
    private favoriteRepository: FavoriteRepository,
    private userRepository: UserRepository,
    private projectRepository: ProjectRepository
  ) {
    console.log('[FavoriteService] Initialized');
  }

  /**
   * Add a project to user's favorites
   *
   * @param userId - User ID
   * @param projectId - Project ID
   * @returns Created favorite
   *
   * @throws FavoriteValidationError if validation fails
   * @throws FavoritePermissionError if permission validation fails
   *
   * @example
   * const favorite = await favoriteService.addFavorite('user123', 'project456');
   */
  async addFavorite(userId: string, projectId: string): Promise<Favorite> {
    console.log('[FavoriteService] Adding favorite:', { userId, projectId });

    // Validate inputs
    await this.validateFavoriteOperation(userId, projectId);

    // Check if already favorited
    const alreadyFavorited = await this.favoriteRepository.isFavorited(
      userId,
      projectId
    );

    if (alreadyFavorited) {
      throw new FavoriteValidationError(
        'Project is already in favorites',
        'projectId'
      );
    }

    // Create favorite
    const favorite = await this.favoriteRepository.create(userId, projectId);

    // Update project favorite count (async, don't wait)
    this.favoriteRepository
      .updateProjectFavoriteCount(projectId, true)
      .catch((err) => {
        console.error(
          '[FavoriteService] Failed to update project favorite count:',
          err
        );
      });

    console.log('[FavoriteService] Favorite added successfully:', favorite.id);
    return favorite;
  }

  /**
   * Remove a project from user's favorites
   *
   * @param userId - User ID
   * @param projectId - Project ID
   * @returns true if removed, false if not found
   *
   * @example
   * const removed = await favoriteService.removeFavorite('user123', 'project456');
   */
  async removeFavorite(userId: string, projectId: string): Promise<boolean> {
    console.log('[FavoriteService] Removing favorite:', { userId, projectId });

    // Check if favorited
    const isFavorited = await this.favoriteRepository.isFavorited(
      userId,
      projectId
    );

    if (!isFavorited) {
      console.log('[FavoriteService] Favorite not found, nothing to remove');
      return false;
    }

    // Delete favorite
    await this.favoriteRepository.delete(userId, projectId);

    // Update project favorite count (async, don't wait)
    this.favoriteRepository
      .updateProjectFavoriteCount(projectId, false)
      .catch((err) => {
        console.error(
          '[FavoriteService] Failed to update project favorite count:',
          err
        );
      });

    console.log('[FavoriteService] Favorite removed successfully');
    return true;
  }

  /**
   * Toggle favorite status for a project
   *
   * @param userId - User ID
   * @param projectId - Project ID
   * @returns Toggle result with new status
   *
   * @throws FavoriteValidationError if validation fails
   * @throws FavoritePermissionError if permission validation fails
   *
   * @example
   * const result = await favoriteService.toggleFavorite('user123', 'project456');
   * console.log(result.isFavorited); // true or false
   */
  async toggleFavorite(
    userId: string,
    projectId: string
  ): Promise<ToggleFavoriteResult> {
    console.log('[FavoriteService] Toggling favorite:', { userId, projectId });

    // Check current status
    const isFavorited = await this.favoriteRepository.isFavorited(
      userId,
      projectId
    );

    if (isFavorited) {
      // Remove favorite
      await this.removeFavorite(userId, projectId);
      return { isFavorited: false };
    } else {
      // Add favorite
      const favorite = await this.addFavorite(userId, projectId);
      return { isFavorited: true, favorite };
    }
  }

  /**
   * Get user's favorite projects with pagination
   *
   * @param userId - User ID
   * @param options - Pagination options
   * @returns Paginated favorites
   *
   * @example
   * const favorites = await favoriteService.getUserFavorites('user123', { page: 1, limit: 20 });
   */
  async getUserFavorites(
    userId: string,
    options?: PaginationOptions
  ): Promise<PaginatedFavorites> {
    console.log('[FavoriteService] Getting user favorites:', userId);

    // Verify user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new FavoriteValidationError('User not found', 'userId');
    }

    return await this.favoriteRepository.getUserFavorites(userId, options);
  }

  /**
   * Check if user has favorited a project
   *
   * @param userId - User ID
   * @param projectId - Project ID
   * @returns true if favorited
   *
   * @example
   * const isFavorited = await favoriteService.isFavorited('user123', 'project456');
   */
  async isFavorited(userId: string, projectId: string): Promise<boolean> {
    console.log('[FavoriteService] Checking favorite status:', {
      userId,
      projectId,
    });

    return await this.favoriteRepository.isFavorited(userId, projectId);
  }

  /**
   * Validate favorite operation
   *
   * @param userId - User ID
   * @param projectId - Project ID
   * @throws FavoriteValidationError if validation fails
   * @throws FavoritePermissionError if permission validation fails
   *
   * @private
   */
  private async validateFavoriteOperation(
    userId: string,
    projectId: string
  ): Promise<void> {
    // Validate user ID
    if (!userId || userId.trim().length === 0) {
      throw new FavoriteValidationError('User ID is required', 'userId');
    }

    // Validate project ID
    if (!projectId || projectId.trim().length === 0) {
      throw new FavoriteValidationError('Project ID is required', 'projectId');
    }

    // Check if user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new FavoriteValidationError('User not found', 'userId');
    }

    // Check if project exists
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new FavoriteValidationError('Project not found', 'projectId');
    }

    // Check if project is active
    if (project.status !== 'active') {
      throw new FavoriteValidationError(
        'Cannot favorite inactive projects',
        'projectId'
      );
    }

    // Check if trying to favorite own project
    if (project.sellerId === userId) {
      throw new FavoritePermissionError('Cannot favorite your own project');
    }
  }
}
