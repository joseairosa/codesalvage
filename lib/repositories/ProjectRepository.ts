/**
 * ProjectRepository - Data Access Layer for Projects
 *
 * Responsibilities:
 * - CRUD operations for projects
 * - Query projects with filters and pagination
 * - Handle project relationships (seller, transactions, favorites)
 * - Database transaction management
 *
 * Architecture:
 * - Repository Pattern: Abstracts database operations
 * - Single Responsibility: Only handles data access
 * - Type-safe: Returns properly typed Prisma models
 * - Error handling: Catches and wraps database errors
 *
 * @example
 * const projectRepo = new ProjectRepository(prisma);
 * const project = await projectRepo.create({...});
 */

import type { PrismaClient, Project, Prisma } from '@prisma/client';

/**
 * Project creation input (without auto-generated fields)
 */
export type CreateProjectInput = Omit<
  Prisma.ProjectCreateInput,
  'id' | 'createdAt' | 'updatedAt' | 'seller'
> & {
  sellerId: string;
};

/**
 * Project update input
 */
export type UpdateProjectInput = Partial<Omit<CreateProjectInput, 'sellerId'>>;

/**
 * Project search filters
 */
export interface ProjectSearchFilters {
  /**
   * Search query for title, description
   */
  query?: string;

  /**
   * Filter by category
   */
  category?: string;

  /**
   * Filter by tech stack (contains any)
   */
  techStack?: string[];

  /**
   * Filter by primary language
   */
  primaryLanguage?: string;

  /**
   * Minimum completion percentage
   */
  minCompletion?: number;

  /**
   * Maximum completion percentage
   */
  maxCompletion?: number;

  /**
   * Minimum price (in cents)
   */
  minPrice?: number;

  /**
   * Maximum price (in cents)
   */
  maxPrice?: number;

  /**
   * Filter by status
   */
  status?: string | string[];

  /**
   * Filter by seller ID
   */
  sellerId?: string;

  /**
   * Only featured projects
   */
  featured?: boolean;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  /**
   * Page number (1-indexed)
   */
  page?: number;

  /**
   * Items per page
   */
  limit?: number;

  /**
   * Sort field
   */
  sortBy?:
    | 'createdAt'
    | 'updatedAt'
    | 'priceCents'
    | 'completionPercentage'
    | 'viewCount'
    | 'favoriteCount';

  /**
   * Sort direction
   */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated results
 */
export interface PaginatedProjects {
  projects: Project[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * ProjectRepository
 *
 * Handles all database operations for projects.
 */
export class ProjectRepository {
  constructor(private prisma: PrismaClient) {
    console.log('[ProjectRepository] Initialized');
  }

  /**
   * Create a new project
   *
   * @param data - Project creation data
   * @returns Created project
   *
   * @throws Error if creation fails
   *
   * @example
   * const project = await projectRepo.create({
   *   sellerId: 'user123',
   *   title: 'Awesome App',
   *   description: 'A cool app',
   *   category: 'web_app',
   *   completionPercentage: 75,
   *   priceCents: 500000,
   *   techStack: ['React', 'Node.js'],
   *   licenseType: 'full_code',
   *   accessLevel: 'full',
   *   status: 'draft',
   * });
   */
  async create(data: CreateProjectInput): Promise<Project> {
    console.log('[ProjectRepository] Creating project:', {
      title: data.title,
      sellerId: data.sellerId,
    });

    try {
      const { sellerId, ...projectData } = data;
      const project = await this.prisma.project.create({
        data: {
          ...projectData,
          seller: {
            connect: { id: sellerId },
          },
        },
      });

      console.log('[ProjectRepository] Project created:', project.id);
      return project;
    } catch (error) {
      console.error('[ProjectRepository] Failed to create project:', error);
      throw new Error(
        `Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find project by ID
   *
   * @param id - Project ID
   * @param includeSeller - Include seller relation
   * @returns Project or null
   *
   * @example
   * const project = await projectRepo.findById('proj123', true);
   */
  async findById(id: string, includeSeller = false): Promise<Project | null> {
    console.log('[ProjectRepository] Finding project by ID:', id);

    try {
      const project = await this.prisma.project.findUnique({
        where: { id },
        include: {
          seller: includeSeller,
        },
      });

      return project;
    } catch (error) {
      console.error('[ProjectRepository] Failed to find project:', error);
      throw new Error(
        `Failed to find project: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update project
   *
   * @param id - Project ID
   * @param data - Update data
   * @returns Updated project
   *
   * @throws Error if project not found or update fails
   *
   * @example
   * const updated = await projectRepo.update('proj123', {
   *   status: 'active',
   *   completionPercentage: 85,
   * });
   */
  async update(id: string, data: UpdateProjectInput): Promise<Project> {
    console.log('[ProjectRepository] Updating project:', id);

    try {
      const project = await this.prisma.project.update({
        where: { id },
        data,
      });

      console.log('[ProjectRepository] Project updated successfully');
      return project;
    } catch (error) {
      console.error('[ProjectRepository] Failed to update project:', error);
      throw new Error(
        `Failed to update project: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete project
   *
   * @param id - Project ID
   * @returns Deleted project
   *
   * @throws Error if project not found or delete fails
   *
   * @example
   * await projectRepo.delete('proj123');
   */
  async delete(id: string): Promise<Project> {
    console.log('[ProjectRepository] Deleting project:', id);

    try {
      const project = await this.prisma.project.delete({
        where: { id },
      });

      console.log('[ProjectRepository] Project deleted successfully');
      return project;
    } catch (error) {
      console.error('[ProjectRepository] Failed to delete project:', error);
      throw new Error(
        `Failed to delete project: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Search projects with filters and pagination
   *
   * @param filters - Search filters
   * @param pagination - Pagination options
   * @returns Paginated projects
   *
   * @example
   * const results = await projectRepo.search(
   *   { category: 'web_app', minCompletion: 80 },
   *   { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' }
   * );
   */
  async search(
    filters: ProjectSearchFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<PaginatedProjects> {
    console.log('[ProjectRepository] Searching projects:', { filters, pagination });

    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ProjectWhereInput = {};

    // Text search (title, description)
    if (filters.query) {
      where.OR = [
        { title: { contains: filters.query, mode: 'insensitive' } },
        { description: { contains: filters.query, mode: 'insensitive' } },
      ];
    }

    // Category filter
    if (filters.category) {
      where.category = filters.category;
    }

    // Tech stack filter (contains any)
    if (filters.techStack && filters.techStack.length > 0) {
      where.techStack = {
        hasSome: filters.techStack,
      };
    }

    // Primary language filter
    if (filters.primaryLanguage) {
      where.primaryLanguage = filters.primaryLanguage;
    }

    // Completion percentage range
    if (filters.minCompletion !== undefined || filters.maxCompletion !== undefined) {
      where.completionPercentage = {};
      if (filters.minCompletion !== undefined) {
        where.completionPercentage.gte = filters.minCompletion;
      }
      if (filters.maxCompletion !== undefined) {
        where.completionPercentage.lte = filters.maxCompletion;
      }
    }

    // Price range
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.priceCents = {};
      if (filters.minPrice !== undefined) {
        where.priceCents.gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        where.priceCents.lte = filters.maxPrice;
      }
    }

    // Status filter (defaults to 'active' if not specified)
    if (filters.status) {
      if (Array.isArray(filters.status)) {
        where.status = { in: filters.status };
      } else {
        where.status = filters.status;
      }
    } else {
      // Default to only showing active projects
      where.status = 'active';
    }

    // Seller filter
    if (filters.sellerId) {
      where.sellerId = filters.sellerId;
    }

    // Featured filter
    if (filters.featured !== undefined) {
      if (filters.featured) {
        // Show featured projects that haven't expired (or have no expiration)
        where.AND = where.AND || [];
        where.AND.push({
          isFeatured: true,
          OR: [
            { featuredUntil: null }, // No expiration
            { featuredUntil: { gte: new Date() } }, // Not yet expired
          ],
        });
      } else {
        where.isFeatured = false;
      }
    }

    try {
      // Execute query with count
      const [projects, total] = await this.prisma.$transaction([
        this.prisma.project.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            seller: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
                isVerifiedSeller: true,
              },
            },
          },
        }),
        this.prisma.project.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      console.log('[ProjectRepository] Search completed:', {
        count: projects.length,
        total,
        page,
        totalPages,
      });

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
      console.error('[ProjectRepository] Failed to search projects:', error);
      throw new Error(
        `Failed to search projects: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get projects by seller ID
   *
   * @param sellerId - Seller user ID
   * @param includeRelations - Include related data
   * @returns Projects array
   *
   * @example
   * const projects = await projectRepo.findBySellerId('user123');
   */
  async findBySellerId(sellerId: string, includeRelations = false): Promise<Project[]> {
    console.log('[ProjectRepository] Finding projects by seller:', sellerId);

    try {
      const projects = await this.prisma.project.findMany({
        where: { sellerId },
        orderBy: { createdAt: 'desc' },
        include: includeRelations
          ? {
              transactions: true,
              favorites: true,
              messages: true,
            }
          : undefined,
      });

      console.log('[ProjectRepository] Found projects:', projects.length);
      return projects;
    } catch (error) {
      console.error('[ProjectRepository] Failed to find projects by seller:', error);
      throw new Error(
        `Failed to find projects: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Count projects by seller with optional status filter
   *
   * @param sellerId - Seller user ID
   * @param options - Optional filters (status)
   * @returns Count of projects
   *
   * @example
   * const activeCount = await projectRepo.countByUser('user123', { status: 'active' });
   */
  async countByUser(sellerId: string, options?: { status?: string }): Promise<number> {
    console.log('[ProjectRepository] Counting projects for seller:', sellerId);

    try {
      const count = await this.prisma.project.count({
        where: {
          sellerId,
          ...(options?.status && { status: options.status }),
        },
      });

      console.log('[ProjectRepository] Project count:', count);
      return count;
    } catch (error) {
      console.error('[ProjectRepository] Failed to count projects:', error);
      throw new Error(
        `Failed to count projects: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Increment view count for a project
   *
   * @param id - Project ID
   * @returns Updated project
   *
   * @example
   * await projectRepo.incrementViewCount('proj123');
   */
  async incrementViewCount(id: string): Promise<Project> {
    console.log('[ProjectRepository] Incrementing view count:', id);

    try {
      const project = await this.prisma.project.update({
        where: { id },
        data: {
          viewCount: {
            increment: 1,
          },
        },
      });

      return project;
    } catch (error) {
      console.error('[ProjectRepository] Failed to increment view count:', error);
      throw new Error(
        `Failed to increment view count: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get featured projects
   *
   * @param limit - Maximum number of projects to return
   * @returns Featured projects
   *
   * @example
   * const featured = await projectRepo.getFeatured(5);
   */
  async getFeatured(limit = 10): Promise<Project[]> {
    console.log('[ProjectRepository] Getting featured projects');

    try {
      const projects = await this.prisma.project.findMany({
        where: {
          isFeatured: true,
          status: 'active',
          OR: [
            { featuredUntil: null }, // No expiration
            { featuredUntil: { gte: new Date() } }, // Not yet expired
          ],
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          seller: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
              isVerifiedSeller: true,
            },
          },
        },
      });

      console.log('[ProjectRepository] Found featured projects:', projects.length);
      return projects;
    } catch (error) {
      console.error('[ProjectRepository] Failed to get featured projects:', error);
      throw new Error(
        `Failed to get featured projects: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get project statistics
   *
   * @returns Project statistics
   *
   * @example
   * const stats = await projectRepo.getStatistics();
   */
  async getStatistics(): Promise<{
    total: number;
    active: number;
    sold: number;
    draft: number;
    averageCompletion: number;
    averagePrice: number;
  }> {
    console.log('[ProjectRepository] Getting project statistics');

    try {
      const [total, active, sold, draft, aggregations] = await this.prisma.$transaction([
        this.prisma.project.count(),
        this.prisma.project.count({ where: { status: 'active' } }),
        this.prisma.project.count({ where: { status: 'sold' } }),
        this.prisma.project.count({ where: { status: 'draft' } }),
        this.prisma.project.aggregate({
          _avg: {
            completionPercentage: true,
            priceCents: true,
          },
        }),
      ]);

      return {
        total,
        active,
        sold,
        draft,
        averageCompletion: aggregations._avg.completionPercentage ?? 0,
        averagePrice: aggregations._avg.priceCents ?? 0,
      };
    } catch (error) {
      console.error('[ProjectRepository] Failed to get statistics:', error);
      throw new Error(
        `Failed to get statistics: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
