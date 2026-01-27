/**
 * FeaturedListingRepository
 *
 * Data access layer for featured project listings.
 * Manages featured status, expiration dates, and queries.
 *
 * Responsibilities:
 * - Set/unset featured status on projects
 * - Query featured projects
 * - Check for expired featured periods
 * - Count featured projects per seller
 *
 * Architecture:
 * - Pure data access layer (no business logic)
 * - Works with Project model's isFeatured/featuredUntil fields
 * - Returns typed project data
 */

import type { PrismaClient, Project } from '@prisma/client';

/**
 * Featured project with seller info
 */
export interface FeaturedProjectWithSeller extends Project {
  seller: {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
}

/**
 * Pagination options for featured listings
 */
export interface FeaturedPaginationOptions {
  page?: number;
  limit?: number;
}

/**
 * Paginated featured projects response
 */
export interface PaginatedFeaturedProjects {
  projects: FeaturedProjectWithSeller[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export class FeaturedListingRepository {
  constructor(private prisma: PrismaClient) {
    console.log('[FeaturedListingRepository] Initialized');
  }

  /**
   * Set a project as featured
   *
   * Marks project as featured and sets expiration date
   *
   * @param projectId - Project ID to feature
   * @param featuredUntil - Date when featured period ends
   * @returns Updated project
   */
  async setFeatured(projectId: string, featuredUntil: Date): Promise<Project> {
    try {
      return await this.prisma.project.update({
        where: { id: projectId },
        data: {
          isFeatured: true,
          featuredUntil,
        },
      });
    } catch (error) {
      console.error('[FeaturedListingRepository] setFeatured failed:', error);
      throw new Error('[FeaturedListingRepository] Failed to set featured status');
    }
  }

  /**
   * Remove featured status from a project
   *
   * @param projectId - Project ID to unfeature
   * @returns Updated project
   */
  async unsetFeatured(projectId: string): Promise<Project> {
    try {
      return await this.prisma.project.update({
        where: { id: projectId },
        data: {
          isFeatured: false,
          featuredUntil: null,
        },
      });
    } catch (error) {
      console.error('[FeaturedListingRepository] unsetFeatured failed:', error);
      throw new Error('[FeaturedListingRepository] Failed to unset featured status');
    }
  }

  /**
   * Get all active featured projects
   *
   * Returns projects where isFeatured=true and featuredUntil > now
   * Ordered by featuredUntil descending (most recently featured first)
   *
   * @param options - Pagination options
   * @returns Paginated featured projects
   */
  async getFeaturedProjects(
    options: FeaturedPaginationOptions = {}
  ): Promise<PaginatedFeaturedProjects> {
    try {
      const page = options.page ?? 1;
      const limit = options.limit ?? 10;
      const skip = (page - 1) * limit;
      const now = new Date();

      const where = {
        isFeatured: true,
        featuredUntil: {
          gt: now,
        },
        status: 'active', // Only show active projects
      };

      const [projects, total] = await Promise.all([
        this.prisma.project.findMany({
          where,
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
          orderBy: {
            featuredUntil: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.project.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        projects,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    } catch (error) {
      console.error('[FeaturedListingRepository] getFeaturedProjects failed:', error);
      throw new Error('[FeaturedListingRepository] Failed to get featured projects');
    }
  }

  /**
   * Check if a project is currently featured
   *
   * @param projectId - Project ID to check
   * @returns True if project is featured and not expired
   */
  async isFeatured(projectId: string): Promise<boolean> {
    try {
      const now = new Date();

      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          isFeatured: true,
          featuredUntil: true,
        },
      });

      if (!project) {
        return false;
      }

      return (
        project.isFeatured === true &&
        project.featuredUntil !== null &&
        project.featuredUntil > now
      );
    } catch (error) {
      console.error('[FeaturedListingRepository] isFeatured failed:', error);
      throw new Error('[FeaturedListingRepository] Failed to check featured status');
    }
  }

  /**
   * Get project by ID with featured status
   *
   * @param projectId - Project ID
   * @returns Project or null if not found
   */
  async findById(projectId: string): Promise<Project | null> {
    return await this.prisma.project.findUnique({
      where: { id: projectId },
    });
  }

  /**
   * Count active featured projects for a seller
   *
   * @param sellerId - Seller user ID
   * @returns Count of featured projects
   */
  async countFeaturedBySeller(sellerId: string): Promise<number> {
    try {
      const now = new Date();

      return await this.prisma.project.count({
        where: {
          sellerId,
          isFeatured: true,
          featuredUntil: {
            gt: now,
          },
          status: 'active',
        },
      });
    } catch (error) {
      console.error('[FeaturedListingRepository] countFeaturedBySeller failed:', error);
      throw new Error('[FeaturedListingRepository] Failed to count featured projects');
    }
  }

  /**
   * Get expired featured projects
   *
   * Returns projects where isFeatured=true but featuredUntil <= now
   * Used for cleanup operations
   *
   * @returns Array of expired featured projects
   */
  async getExpiredFeaturedProjects(): Promise<Project[]> {
    const now = new Date();

    return await this.prisma.project.findMany({
      where: {
        isFeatured: true,
        featuredUntil: {
          lte: now,
        },
      },
    });
  }

  /**
   * Cleanup expired featured projects
   *
   * Sets isFeatured=false for all projects where featuredUntil <= now
   * Returns count of projects updated
   *
   * @returns Number of projects unfeatured
   */
  async cleanupExpiredFeatured(): Promise<number> {
    try {
      const now = new Date();

      const result = await this.prisma.project.updateMany({
        where: {
          isFeatured: true,
          featuredUntil: {
            lte: now,
          },
        },
        data: {
          isFeatured: false,
        },
      });

      return result.count;
    } catch (error) {
      console.error('[FeaturedListingRepository] cleanupExpiredFeatured failed:', error);
      throw new Error(
        '[FeaturedListingRepository] Failed to cleanup expired featured projects'
      );
    }
  }

  /**
   * Extend featured period for a project
   *
   * Adds additional days to the featuredUntil date
   *
   * @param projectId - Project ID
   * @param additionalDays - Number of days to add
   * @returns Updated project
   */
  async extendFeaturedPeriod(
    projectId: string,
    additionalDays: number
  ): Promise<Project> {
    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { featuredUntil: true },
      });

      if (!project) {
        throw new Error('Project not found');
      }

      // Calculate new expiration date
      const baseDate = project.featuredUntil || new Date();
      const newFeaturedUntil = new Date(baseDate);
      newFeaturedUntil.setDate(newFeaturedUntil.getDate() + additionalDays);

      return await this.prisma.project.update({
        where: { id: projectId },
        data: {
          isFeatured: true,
          featuredUntil: newFeaturedUntil,
        },
      });
    } catch (error) {
      console.error('[FeaturedListingRepository] extendFeaturedPeriod failed:', error);
      throw new Error('[FeaturedListingRepository] Failed to extend featured period');
    }
  }
}
