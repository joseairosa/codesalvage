/**
 * ProjectService - Business Logic for Projects
 *
 * Responsibilities:
 * - Validate project data before database operations
 * - Implement business rules for project creation/updates
 * - Handle file upload coordination with R2Service
 * - Coordinate project search and filtering logic
 * - Enforce seller permissions
 *
 * Architecture:
 * - Service Pattern: Encapsulates business logic
 * - Single Responsibility: Manages project-related operations
 * - Dependency Injection: Receives repository via constructor
 * - Error handling: Provides business-level error messages
 *
 * @example
 * const projectService = new ProjectService(projectRepo, r2Service);
 * const project = await projectService.createProject(userId, data);
 */

import { Project } from '@prisma/client';
import {
  ProjectRepository,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectSearchFilters,
  PaginationOptions,
  PaginatedProjects,
} from '@/lib/repositories/ProjectRepository';
import { R2Service, FileType } from './R2Service';

/**
 * Project creation request (from user input)
 */
export interface CreateProjectRequest {
  title: string;
  description: string;
  category: string;
  completionPercentage: number;
  estimatedCompletionHours?: number;
  knownIssues?: string;
  priceCents: number;
  licenseType: string;
  accessLevel: string;
  techStack: string[];
  primaryLanguage?: string;
  frameworks?: string[];
  githubUrl?: string;
  githubRepoName?: string;
  demoUrl?: string;
  documentationUrl?: string;
}

/**
 * Project validation errors
 */
export class ProjectValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'ProjectValidationError';
  }
}

/**
 * Project permission error
 */
export class ProjectPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectPermissionError';
  }
}

/**
 * Project not found error
 */
export class ProjectNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectNotFoundError';
  }
}

/**
 * Valid project categories
 */
export const PROJECT_CATEGORIES = [
  'web_app',
  'mobile_app',
  'desktop_app',
  'backend_api',
  'cli_tool',
  'library',
  'dashboard',
  'game',
  'other',
] as const;

/**
 * Valid license types
 */
export const LICENSE_TYPES = ['full_code', 'limited', 'custom'] as const;

/**
 * Valid access levels
 */
export const ACCESS_LEVELS = ['full', 'read_only', 'zip_download'] as const;

/**
 * Valid project statuses
 */
export const PROJECT_STATUSES = ['draft', 'active', 'sold', 'delisted'] as const;

/**
 * ProjectService
 *
 * Handles all business logic for projects.
 */
export class ProjectService {
  constructor(
    private projectRepository: ProjectRepository,
    private userRepository: any, // UserRepository type (avoiding circular dependency)
    private r2Service?: R2Service
  ) {
    console.log('[ProjectService] Initialized');
  }

  /**
   * Create a new project
   *
   * @param sellerId - Seller user ID
   * @param data - Project creation data
   * @returns Created project
   *
   * @throws ProjectValidationError if validation fails
   * @throws Error if creation fails
   *
   * @example
   * const project = await projectService.createProject('user123', {
   *   title: 'Awesome App',
   *   description: 'A cool app',
   *   category: 'web_app',
   *   completionPercentage: 75,
   *   priceCents: 500000,
   *   techStack: ['React', 'Node.js'],
   *   licenseType: 'full_code',
   *   accessLevel: 'full',
   * });
   */
  async createProject(sellerId: string, data: CreateProjectRequest): Promise<Project> {
    console.log('[ProjectService] Creating project for seller:', sellerId);

    // Validate that user is a seller
    const user = await this.userRepository.findById(sellerId);
    if (!user) {
      throw new ProjectPermissionError('User not found');
    }
    if (!user.isSeller) {
      throw new ProjectPermissionError('User must be a seller to create projects');
    }

    // Validate input
    this.validateProjectData(data);

    // Convert request to repository input
    const createInput: CreateProjectInput = {
      ...data,
      sellerId,
      status: 'draft', // New projects start as drafts
      viewCount: 0,
      favoriteCount: 0,
      messageCount: 0,
      isFeatured: false,
      isApproved: true, // Auto-approve for now (could add moderation later)
    };

    // Create project
    const project = await this.projectRepository.create(createInput);

    console.log('[ProjectService] Project created successfully:', project.id);
    return project;
  }

  /**
   * Update a project
   *
   * @param projectId - Project ID
   * @param userId - User ID making the update
   * @param data - Update data
   * @returns Updated project
   *
   * @throws ProjectPermissionError if user is not the seller
   * @throws ProjectValidationError if validation fails
   *
   * @example
   * const updated = await projectService.updateProject('proj123', 'user123', {
   *   completionPercentage: 85,
   * });
   */
  async updateProject(
    projectId: string,
    userId: string,
    data: Partial<CreateProjectRequest>
  ): Promise<Project> {
    console.log('[ProjectService] Updating project:', projectId);

    // Verify ownership
    await this.verifyProjectOwnership(projectId, userId);

    // Validate update data
    if (Object.keys(data).length > 0) {
      this.validateProjectData(data as CreateProjectRequest, true);
    }

    // Update project
    const project = await this.projectRepository.update(
      projectId,
      data as UpdateProjectInput
    );

    console.log('[ProjectService] Project updated successfully');
    return project;
  }

  /**
   * Publish a project (change status from draft to active)
   *
   * @param projectId - Project ID
   * @param userId - User ID
   * @returns Updated project
   *
   * @throws ProjectPermissionError if user is not the seller
   * @throws ProjectValidationError if project is not valid for publishing
   *
   * @example
   * const published = await projectService.publishProject('proj123', 'user123');
   */
  async publishProject(projectId: string, userId: string): Promise<Project> {
    console.log('[ProjectService] Publishing project:', projectId);

    // Verify ownership
    const project = await this.verifyProjectOwnership(projectId, userId);

    // Verify project can be published
    if (project.status !== 'draft') {
      throw new ProjectValidationError('Only draft projects can be published');
    }

    // Validate project is complete enough to publish
    this.validateProjectForPublishing(project);

    // Update status to active
    const published = await this.projectRepository.update(projectId, {
      status: 'active',
    });

    console.log('[ProjectService] Project published successfully');
    return published;
  }

  /**
   * Delete a project
   *
   * @param projectId - Project ID
   * @param userId - User ID
   * @returns Deleted project
   *
   * @throws ProjectPermissionError if user is not the seller
   * @throws ProjectValidationError if project cannot be deleted
   *
   * @example
   * await projectService.deleteProject('proj123', 'user123');
   */
  async deleteProject(projectId: string, userId: string): Promise<Project> {
    console.log('[ProjectService] Deleting project:', projectId);

    // Verify ownership
    const project = await this.verifyProjectOwnership(projectId, userId);

    // Check if project can be deleted
    if (project.status === 'sold') {
      throw new ProjectValidationError('Cannot delete sold projects');
    }

    // Delete project
    const deleted = await this.projectRepository.delete(projectId);

    console.log('[ProjectService] Project deleted successfully');
    return deleted;
  }

  /**
   * Get project by ID
   *
   * @param projectId - Project ID
   * @param options - Optional configuration
   * @returns Project
   * @throws ProjectNotFoundError if project doesn't exist
   *
   * @example
   * const project = await projectService.getProject('proj123', { incrementView: true });
   */
  async getProject(
    projectId: string,
    options: { incrementView?: boolean; includeSeller?: boolean } = {}
  ): Promise<Project> {
    console.log('[ProjectService] Getting project:', projectId);

    const { incrementView = false, includeSeller = true } = options;
    const project = await this.projectRepository.findById(projectId, includeSeller);

    if (!project) {
      throw new ProjectNotFoundError(`Project with ID ${projectId} not found`);
    }

    if (incrementView && project.status === 'active') {
      // Increment view count asynchronously (don't wait)
      this.projectRepository.incrementViewCount(projectId).catch((err) => {
        console.error('[ProjectService] Failed to increment view count:', err);
      });
    }

    return project;
  }

  /**
   * Search projects
   *
   * @param filters - Search filters
   * @param pagination - Pagination options
   * @returns Paginated projects
   *
   * @example
   * const results = await projectService.searchProjects(
   *   { category: 'web_app', minCompletion: 80 },
   *   { page: 1, limit: 20 }
   * );
   */
  async searchProjects(
    filters: ProjectSearchFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<PaginatedProjects> {
    console.log('[ProjectService] Searching projects');

    return await this.projectRepository.search(filters, pagination);
  }

  /**
   * Get seller's projects
   *
   * @param sellerId - Seller user ID
   * @returns Projects array
   *
   * @example
   * const projects = await projectService.getSellerProjects('user123');
   */
  async getSellerProjects(sellerId: string): Promise<Project[]> {
    console.log('[ProjectService] Getting seller projects:', sellerId);

    return await this.projectRepository.findBySellerId(sellerId, true);
  }

  /**
   * Get featured projects
   *
   * @param limit - Maximum number of projects
   * @returns Featured projects
   *
   * @example
   * const featured = await projectService.getFeaturedProjects(5);
   */
  async getFeaturedProjects(limit = 10): Promise<Project[]> {
    console.log('[ProjectService] Getting featured projects');

    return await this.projectRepository.getFeatured(limit);
  }

  /**
   * Generate upload URL for project images
   *
   * @param userId - User ID
   * @param filename - Original filename
   * @param mimeType - File MIME type
   * @param fileType - File type (image, video, etc.)
   * @returns Upload URL response
   *
   * @example
   * const uploadUrl = await projectService.generateUploadUrl(
   *   'user123',
   *   'screenshot.png',
   *   'image/png',
   *   FileType.IMAGE
   * );
   */
  async generateUploadUrl(
    userId: string,
    filename: string,
    mimeType: string,
    fileType: FileType
  ) {
    console.log('[ProjectService] Generating upload URL:', {
      userId,
      filename,
      fileType,
    });

    return await this.r2Service.getUploadUrl(filename, mimeType, userId, fileType);
  }

  /**
   * Validate project data
   *
   * @param data - Project data
   * @param isUpdate - Whether this is an update (allows partial data)
   * @throws ProjectValidationError if validation fails
   *
   * @private
   */
  private validateProjectData(
    data: Partial<CreateProjectRequest>,
    isUpdate = false
  ): void {
    // Title validation
    if (data.title !== undefined) {
      if (!data.title || data.title.trim().length === 0) {
        throw new ProjectValidationError('Title is required', 'title');
      }
      if (data.title.length < 5) {
        throw new ProjectValidationError('Title must be at least 5 characters', 'title');
      }
      if (data.title.length > 100) {
        throw new ProjectValidationError(
          'Title must be less than 100 characters',
          'title'
        );
      }
    }

    // Description validation
    if (data.description !== undefined) {
      if (!data.description || data.description.trim().length === 0) {
        throw new ProjectValidationError('Description is required', 'description');
      }
      if (data.description.length < 50) {
        throw new ProjectValidationError(
          'Description must be at least 50 characters',
          'description'
        );
      }
      if (data.description.length > 5000) {
        throw new ProjectValidationError(
          'Description must be less than 5000 characters',
          'description'
        );
      }
    }

    // Category validation
    if (data.category !== undefined) {
      if (!PROJECT_CATEGORIES.includes(data.category as any)) {
        throw new ProjectValidationError(
          `Invalid category. Must be one of: ${PROJECT_CATEGORIES.join(', ')}`,
          'category'
        );
      }
    }

    // Completion percentage validation
    if (data.completionPercentage !== undefined) {
      if (data.completionPercentage < 50 || data.completionPercentage > 95) {
        throw new ProjectValidationError(
          'Completion percentage must be between 50% and 95%',
          'completionPercentage'
        );
      }
    }

    // Price validation
    if (data.priceCents !== undefined) {
      if (data.priceCents < 10000) {
        // Minimum $100
        throw new ProjectValidationError('Price must be at least $100', 'priceCents');
      }
      if (data.priceCents > 10000000) {
        // Maximum $100,000
        throw new ProjectValidationError(
          'Price must be less than $100,000',
          'priceCents'
        );
      }
    }

    // License type validation
    if (data.licenseType !== undefined) {
      if (!LICENSE_TYPES.includes(data.licenseType as any)) {
        throw new ProjectValidationError(
          `Invalid license type. Must be one of: ${LICENSE_TYPES.join(', ')}`,
          'licenseType'
        );
      }
    }

    // Access level validation
    if (data.accessLevel !== undefined) {
      if (!ACCESS_LEVELS.includes(data.accessLevel as any)) {
        throw new ProjectValidationError(
          `Invalid access level. Must be one of: ${ACCESS_LEVELS.join(', ')}`,
          'accessLevel'
        );
      }
    }

    // Tech stack validation
    if (data.techStack !== undefined) {
      if (!Array.isArray(data.techStack) || data.techStack.length === 0) {
        throw new ProjectValidationError(
          'At least one technology is required',
          'techStack'
        );
      }
      if (data.techStack.length > 20) {
        throw new ProjectValidationError('Maximum 20 technologies allowed', 'techStack');
      }
    }

    // GitHub URL validation
    if (data.githubUrl !== undefined && data.githubUrl) {
      if (!this.isValidGitHubUrl(data.githubUrl)) {
        throw new ProjectValidationError('Invalid GitHub URL', 'githubUrl');
      }
    }

    // Demo URL validation
    if (data.demoUrl !== undefined && data.demoUrl) {
      if (!this.isValidUrl(data.demoUrl)) {
        throw new ProjectValidationError('Invalid demo URL', 'demoUrl');
      }
    }
  }

  /**
   * Validate project is ready for publishing
   *
   * @param project - Project to validate
   * @throws ProjectValidationError if validation fails
   *
   * @private
   */
  private validateProjectForPublishing(project: Project): void {
    if (!project.title || project.title.length < 5) {
      throw new ProjectValidationError('Title is required for publishing');
    }

    if (!project.description || project.description.length < 50) {
      throw new ProjectValidationError('Description is required for publishing');
    }

    if (project.techStack.length === 0) {
      throw new ProjectValidationError(
        'At least one technology is required for publishing'
      );
    }

    if (project.priceCents < 10000) {
      throw new ProjectValidationError('Price is required for publishing');
    }

    // Recommend having at least one screenshot
    if (!project.thumbnailImageUrl && project.screenshotUrls.length === 0) {
      console.warn(
        '[ProjectService] Publishing without images - recommended to add screenshots'
      );
    }
  }

  /**
   * Verify project ownership
   *
   * @param projectId - Project ID
   * @param userId - User ID
   * @returns Project if user is the owner
   * @throws ProjectPermissionError if user is not the owner
   *
   * @private
   */
  private async verifyProjectOwnership(
    projectId: string,
    userId: string
  ): Promise<Project> {
    const project = await this.projectRepository.findById(projectId);

    if (!project) {
      throw new Error('Project not found');
    }

    if (project.sellerId !== userId) {
      throw new ProjectPermissionError(
        'You do not have permission to modify this project'
      );
    }

    return project;
  }

  /**
   * Validate GitHub URL format
   *
   * @param url - URL to validate
   * @returns true if valid GitHub URL
   *
   * @private
   */
  private isValidGitHubUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return (
        parsed.hostname === 'github.com' &&
        parsed.pathname.split('/').filter(Boolean).length >= 2
      );
    } catch {
      return false;
    }
  }

  /**
   * Validate URL format
   *
   * @param url - URL to validate
   * @returns true if valid URL
   *
   * @private
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
