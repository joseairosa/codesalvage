/**
 * AnalyticsService
 *
 * Business logic for seller analytics and metrics.
 * Provides high-level analytics operations with validation and formatting.
 *
 * Responsibilities:
 * - Validate seller access permissions
 * - Format analytics data for presentation
 * - Aggregate multi-source metrics
 * - Handle date range normalization
 *
 * Architecture:
 * - Business logic layer (orchestrates repositories)
 * - Depends on AnalyticsRepository and UserRepository
 * - Returns formatted analytics data
 */

import type { AnalyticsRepository } from '../repositories/AnalyticsRepository';
import type { SellerAnalyticsOverview } from '../repositories/AnalyticsRepository';
import type { UserRepository } from '../repositories/UserRepository';

/**
 * Custom error for analytics permission issues
 */
export class AnalyticsPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalyticsPermissionError';
  }
}

/**
 * Custom error for analytics validation issues
 */
export class AnalyticsValidationError extends Error {
  public field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'AnalyticsValidationError';
    if (field !== undefined) {
      this.field = field;
    }
  }
}

/**
 * Request format for analytics overview
 */
export interface AnalyticsOverviewRequest {
  startDate?: string;
  endDate?: string;
  granularity?: 'day' | 'week' | 'month';
}

/**
 * Response format for analytics overview (formatted for frontend)
 */
export interface AnalyticsOverviewResponse {
  userId: string;
  summary: {
    totalProjects: number;
    totalSold: number;
    totalRevenue: number;
    averageRevenue: number;
    totalViews: number;
    totalFavorites: number;
    conversionRate: number;
  };
  revenueOverTime: Array<{
    date: string;
    revenue: number;
    transactionCount: number;
  }>;
  topProjects: Array<{
    projectId: string;
    projectTitle: string;
    views: number;
    favorites: number;
    revenue: number;
    transactionCount: number;
  }>;
}

export class AnalyticsService {
  constructor(
    private analyticsRepository: AnalyticsRepository,
    private userRepository: UserRepository
  ) {
    console.log('[AnalyticsService] Initialized');
  }

  /**
   * Get seller analytics overview
   *
   * Validates user is a seller and returns formatted analytics data
   *
   * @param userId - User ID requesting analytics
   * @param request - Date range and granularity options
   * @returns Formatted analytics overview
   * @throws AnalyticsPermissionError if user is not a seller
   * @throws AnalyticsValidationError if date range is invalid
   */
  async getSellerAnalyticsOverview(
    userId: string,
    request: AnalyticsOverviewRequest = {}
  ): Promise<AnalyticsOverviewResponse> {
    console.log('[AnalyticsService] Getting seller analytics:', userId);

    const user = await this.userRepository.findById(userId);
    if (!user || !user.isSeller) {
      throw new AnalyticsPermissionError('Only sellers can access analytics');
    }

    const dateRange = this.normalizeDateRange(request.startDate, request.endDate);

    const analytics = await this.analyticsRepository.getSellerAnalyticsOverview(
      userId,
      dateRange
    );

    return this.formatAnalyticsOverview(analytics, request.granularity);
  }

  /**
   * Get seller revenue summary only
   *
   * Lighter weight endpoint for dashboard widgets
   *
   * @param userId - User ID requesting analytics
   * @param request - Date range options
   * @returns Formatted revenue summary
   */
  async getSellerRevenueSummary(
    userId: string,
    request: AnalyticsOverviewRequest = {}
  ): Promise<AnalyticsOverviewResponse['summary']> {
    console.log('[AnalyticsService] Getting revenue summary:', userId);

    const user = await this.userRepository.findById(userId);
    if (!user || !user.isSeller) {
      throw new AnalyticsPermissionError('Only sellers can access analytics');
    }

    const dateRange = this.normalizeDateRange(request.startDate, request.endDate);

    const summary = await this.analyticsRepository.getSellerRevenueSummary(
      userId,
      dateRange
    );

    return {
      totalProjects: summary.totalProjects,
      totalSold: summary.totalSold,
      totalRevenue: summary.totalRevenueCents,
      averageRevenue: summary.averageProjectPriceCents,
      totalViews: summary.totalViews,
      totalFavorites: summary.totalFavorites,
      conversionRate: summary.conversionRate,
    };
  }

  /**
   * Get top performing projects
   *
   * @param userId - User ID requesting analytics
   * @param limit - Maximum number of projects to return
   * @param request - Date range options
   * @returns Formatted top projects
   */
  async getTopProjects(
    userId: string,
    limit: number = 10,
    request: AnalyticsOverviewRequest = {}
  ): Promise<AnalyticsOverviewResponse['topProjects']> {
    console.log('[AnalyticsService] Getting top projects:', userId);

    const user = await this.userRepository.findById(userId);
    if (!user || !user.isSeller) {
      throw new AnalyticsPermissionError('Only sellers can access analytics');
    }

    const dateRange = this.normalizeDateRange(request.startDate, request.endDate);

    const projects = await this.analyticsRepository.getTopProjects(
      userId,
      limit,
      dateRange
    );

    return projects.map((project) => ({
      projectId: project.projectId,
      projectTitle: project.title,
      views: project.viewCount,
      favorites: project.favoriteCount,
      revenue: project.revenueCents,
      transactionCount: project.purchaseCount,
    }));
  }

  /**
   * Normalize date range from strings to Date objects
   *
   * Validates and applies defaults if not provided
   *
   * @param startDate - ISO date string
   * @param endDate - ISO date string
   * @returns Normalized date range
   * @throws AnalyticsValidationError if dates are invalid
   */
  private normalizeDateRange(
    startDate?: string,
    endDate?: string
  ): { startDate: Date; endDate: Date } {
    const now = new Date();

    const defaultStartDate = new Date(now);
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);

    let start = startDate ? new Date(startDate) : defaultStartDate;
    const end = endDate ? new Date(endDate) : now;

    if (isNaN(start.getTime())) {
      throw new AnalyticsValidationError('Invalid start date format', 'startDate');
    }

    if (isNaN(end.getTime())) {
      throw new AnalyticsValidationError('Invalid end date format', 'endDate');
    }

    if (start > end) {
      throw new AnalyticsValidationError(
        'Start date must be before end date',
        'startDate'
      );
    }

    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    if (start < oneYearAgo) {
      start = oneYearAgo;
    }

    return { startDate: start, endDate: end };
  }

  /**
   * Format analytics overview for presentation
   *
   * Converts raw analytics data to frontend-friendly format
   *
   * @param analytics - Raw analytics data
   * @param granularity - Time granularity for chart
   * @returns Formatted analytics
   */
  private formatAnalyticsOverview(
    analytics: SellerAnalyticsOverview,
    _granularity?: 'day' | 'week' | 'month'
  ): AnalyticsOverviewResponse {
    return {
      userId: analytics.userId,
      summary: {
        totalProjects: analytics.summary.totalProjects,
        totalSold: analytics.summary.totalSold,
        totalRevenue: analytics.summary.totalRevenueCents,
        averageRevenue: analytics.summary.averageProjectPriceCents,
        totalViews: analytics.summary.totalViews,
        totalFavorites: analytics.summary.totalFavorites,
        conversionRate: analytics.summary.conversionRate,
      },
      revenueOverTime: analytics.revenueOverTime.map((point) => ({
        date: point.date,
        revenue: point.revenueCents,
        transactionCount: point.transactionCount,
      })),
      topProjects: analytics.topProjects.map((project) => ({
        projectId: project.projectId,
        projectTitle: project.title,
        views: project.viewCount,
        favorites: project.favoriteCount,
        revenue: project.revenueCents,
        transactionCount: project.purchaseCount,
      })),
    };
  }
}
