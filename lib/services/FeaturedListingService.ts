/**
 * FeaturedListingService
 *
 * Business logic for featured project listings.
 * Handles purchasing featured placement, validation, and permissions.
 *
 * Responsibilities:
 * - Validate seller ownership and permissions
 * - Enforce business rules (pricing, duration limits)
 * - Purchase featured placement
 * - Manage featured status
 * - Check expiration
 *
 * Architecture:
 * - Business logic layer (orchestrates repositories)
 * - Depends on FeaturedListingRepository, ProjectRepository, UserRepository
 * - Returns formatted data for API consumption
 */

import { FeaturedListingRepository } from '../repositories/FeaturedListingRepository';
import type {
  FeaturedProjectWithSeller,
  PaginatedFeaturedProjects,
} from '../repositories/FeaturedListingRepository';
import { ProjectRepository } from '../repositories/ProjectRepository';
import { UserRepository } from '../repositories/UserRepository';
import { SubscriptionService } from './SubscriptionService';

/**
 * Custom error for featured listing validation issues
 */
export class FeaturedListingValidationError extends Error {
  public field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'FeaturedListingValidationError';
    this.field = field;
  }
}

/**
 * Custom error for featured listing permission issues
 */
export class FeaturedListingPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeaturedListingPermissionError';
  }
}

/**
 * Custom error for featured listing not found
 */
export class FeaturedListingNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeaturedListingNotFoundError';
  }
}

/**
 * Request format for purchasing featured placement
 */
export interface PurchaseFeaturedRequest {
  projectId: string;
  durationDays: number; // Number of days to feature (7, 14, 30)
}

/**
 * Response format for purchase confirmation
 */
export interface PurchaseFeaturedResponse {
  projectId: string;
  featuredUntil: string; // ISO date string
  durationDays: number;
  costCents: number; // Cost paid for featured placement
  message: string;
}

/**
 * Featured listing pricing tiers
 */
const FEATURED_PRICING = {
  7: 2999, // 7 days = $29.99
  14: 4999, // 14 days = $49.99
  30: 7999, // 30 days = $79.99
} as const;

/**
 * Valid featured durations (in days)
 */
const VALID_DURATIONS = [7, 14, 30] as const;
type ValidDuration = (typeof VALID_DURATIONS)[number];

export class FeaturedListingService {
  constructor(
    private featuredListingRepository: FeaturedListingRepository,
    private projectRepository: ProjectRepository,
    private userRepository: UserRepository,
    private subscriptionService: SubscriptionService
  ) {
    console.log('[FeaturedListingService] Initialized');
  }

  /**
   * Purchase featured placement for a project
   *
   * Validates seller ownership, project status, and duration
   * Sets project as featured for specified duration
   *
   * @param userId - User ID making the purchase
   * @param request - Purchase details (projectId, durationDays)
   * @returns Purchase confirmation with expiration date
   * @throws FeaturedListingValidationError if validation fails
   * @throws FeaturedListingPermissionError if user doesn't own project
   * @throws FeaturedListingNotFoundError if project not found
   */
  async purchaseFeaturedPlacement(
    userId: string,
    request: PurchaseFeaturedRequest
  ): Promise<PurchaseFeaturedResponse> {
    console.log('[FeaturedListingService] Purchasing featured placement:', {
      userId,
      projectId: request.projectId,
      durationDays: request.durationDays,
    });

    // Validate user is a seller
    const user = await this.userRepository.findById(userId);
    if (!user || !user.isSeller) {
      throw new FeaturedListingPermissionError(
        'Only sellers can purchase featured placement'
      );
    }

    // Validate duration
    if (!this.isValidDuration(request.durationDays)) {
      throw new FeaturedListingValidationError(
        `Invalid duration. Must be one of: ${VALID_DURATIONS.join(', ')} days`,
        'durationDays'
      );
    }

    // Validate project exists
    const project = await this.projectRepository.findById(request.projectId);
    if (!project) {
      throw new FeaturedListingNotFoundError(
        `Project ${request.projectId} not found`
      );
    }

    // Validate seller owns the project
    if (project.sellerId !== userId) {
      throw new FeaturedListingPermissionError(
        'You can only feature your own projects'
      );
    }

    // Validate project is active
    if (project.status !== 'active') {
      throw new FeaturedListingValidationError(
        'Only active projects can be featured',
        'status'
      );
    }

    // Check subscription status for discount
    const subscriptionStatus = await this.subscriptionService.getSubscriptionStatus(userId);
    const discountPercent = subscriptionStatus.benefits.featuredListingDiscount; // 0 for free, 20 for pro

    // Calculate cost with discount
    const baseCostCents = FEATURED_PRICING[request.durationDays as ValidDuration];
    const costCents = Math.round(baseCostCents * (1 - discountPercent / 100));

    console.log('[FeaturedListingService] Cost calculation:', {
      baseCostCents,
      discountPercent,
      finalCostCents: costCents,
      plan: subscriptionStatus.plan,
    });

    // Calculate expiration date
    const now = new Date();
    const featuredUntil = new Date(now);
    featuredUntil.setDate(featuredUntil.getDate() + request.durationDays);

    // Set project as featured
    const updatedProject = await this.featuredListingRepository.setFeatured(
      request.projectId,
      featuredUntil
    );

    console.log('[FeaturedListingService] Featured placement purchased:', {
      projectId: updatedProject.id,
      featuredUntil: updatedProject.featuredUntil,
      costCents,
    });

    return {
      projectId: updatedProject.id,
      featuredUntil: updatedProject.featuredUntil!.toISOString(),
      durationDays: request.durationDays,
      costCents,
      message: `Project featured successfully for ${request.durationDays} days`,
    };
  }

  /**
   * Get all active featured projects
   *
   * Returns paginated list of featured projects that haven't expired
   *
   * @param page - Page number (default: 1)
   * @param limit - Results per page (default: 10)
   * @returns Paginated featured projects
   */
  async getFeaturedProjects(
    page?: number,
    limit?: number
  ): Promise<PaginatedFeaturedProjects> {
    console.log('[FeaturedListingService] Getting featured projects:', {
      page,
      limit,
    });

    return await this.featuredListingRepository.getFeaturedProjects({
      page,
      limit,
    });
  }

  /**
   * Check if a project is currently featured
   *
   * @param projectId - Project ID to check
   * @returns True if project is featured and not expired
   */
  async isFeatured(projectId: string): Promise<boolean> {
    return await this.featuredListingRepository.isFeatured(projectId);
  }

  /**
   * Remove featured status from a project
   *
   * Can be called by seller to manually remove featured status
   * (e.g., if they want to stop featuring early)
   *
   * @param userId - User ID making the request
   * @param projectId - Project ID to unfeature
   * @throws FeaturedListingPermissionError if user doesn't own project
   * @throws FeaturedListingNotFoundError if project not found
   */
  async removeFeaturedStatus(
    userId: string,
    projectId: string
  ): Promise<void> {
    console.log('[FeaturedListingService] Removing featured status:', {
      userId,
      projectId,
    });

    // Validate project exists
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new FeaturedListingNotFoundError(
        `Project ${projectId} not found`
      );
    }

    // Validate seller owns the project
    if (project.sellerId !== userId) {
      throw new FeaturedListingPermissionError(
        'You can only unfeature your own projects'
      );
    }

    await this.featuredListingRepository.unsetFeatured(projectId);

    console.log('[FeaturedListingService] Featured status removed:', {
      projectId,
    });
  }

  /**
   * Get featured projects count for a seller
   *
   * Returns number of currently active featured projects for a seller
   *
   * @param sellerId - Seller user ID
   * @returns Count of featured projects
   */
  async getSellerFeaturedCount(sellerId: string): Promise<number> {
    return await this.featuredListingRepository.countFeaturedBySeller(
      sellerId
    );
  }

  /**
   * Extend featured period for a project
   *
   * Adds additional days to existing featured period
   * Can be used to "renew" featured placement
   *
   * @param userId - User ID making the request
   * @param projectId - Project ID to extend
   * @param additionalDays - Number of days to add
   * @returns Updated featured expiration date
   * @throws FeaturedListingValidationError if validation fails
   * @throws FeaturedListingPermissionError if user doesn't own project
   * @throws FeaturedListingNotFoundError if project not found
   */
  async extendFeaturedPeriod(
    userId: string,
    projectId: string,
    additionalDays: number
  ): Promise<{ featuredUntil: string }> {
    console.log('[FeaturedListingService] Extending featured period:', {
      userId,
      projectId,
      additionalDays,
    });

    // Validate duration is valid
    if (!this.isValidDuration(additionalDays)) {
      throw new FeaturedListingValidationError(
        `Invalid duration. Must be one of: ${VALID_DURATIONS.join(', ')} days`,
        'additionalDays'
      );
    }

    // Validate project exists
    const project = await this.projectRepository.findById(projectId);
    if (!project) {
      throw new FeaturedListingNotFoundError(
        `Project ${projectId} not found`
      );
    }

    // Validate seller owns the project
    if (project.sellerId !== userId) {
      throw new FeaturedListingPermissionError(
        'You can only extend featured period for your own projects'
      );
    }

    const updatedProject =
      await this.featuredListingRepository.extendFeaturedPeriod(
        projectId,
        additionalDays
      );

    console.log('[FeaturedListingService] Featured period extended:', {
      projectId,
      newFeaturedUntil: updatedProject.featuredUntil,
    });

    return {
      featuredUntil: updatedProject.featuredUntil!.toISOString(),
    };
  }

  /**
   * Get featured pricing tiers
   *
   * Returns available pricing options for featured placement
   *
   * @returns Array of pricing tiers with duration and cost
   */
  getFeaturedPricing(): Array<{
    durationDays: number;
    costCents: number;
    costFormatted: string;
  }> {
    return Object.entries(FEATURED_PRICING).map(([days, cents]) => ({
      durationDays: parseInt(days),
      costCents: cents,
      costFormatted: this.formatCurrency(cents),
    }));
  }

  /**
   * Cleanup expired featured projects
   *
   * Unfeatures all projects where featuredUntil <= now
   * Should be called by a cron job periodically
   *
   * @returns Number of projects unfeatured
   */
  async cleanupExpiredFeatured(): Promise<number> {
    console.log('[FeaturedListingService] Cleaning up expired featured projects');

    const count =
      await this.featuredListingRepository.cleanupExpiredFeatured();

    console.log('[FeaturedListingService] Expired featured cleanup complete:', {
      unfeaturedCount: count,
    });

    return count;
  }

  /**
   * Validate duration is in allowed list
   *
   * @param duration - Duration in days
   * @returns True if duration is valid
   */
  private isValidDuration(duration: number): duration is ValidDuration {
    return VALID_DURATIONS.includes(duration as ValidDuration);
  }

  /**
   * Format cents to currency string
   *
   * @param cents - Amount in cents
   * @returns Formatted currency (e.g., "$29.99")
   */
  private formatCurrency(cents: number): string {
    const dollars = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(dollars);
  }
}
