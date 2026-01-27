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
    this.field = field;
  }
}

/**
 * Request format for analytics overview
 */
export interface AnalyticsOverviewRequest {
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
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
    totalRevenue: string; // Formatted dollars (e.g., "$1,234.56")
    averageProjectPrice: string;
    conversionRate: string; // Formatted percentage (e.g., "1.5%")
  };
  revenueChart: Array<{
    date: string;
    revenue: string; // Formatted dollars
    transactions: number;
  }>;
  topProjects: Array<{
    projectId: string;
    title: string;
    views: number;
    favorites: number;
    purchases: number;
    revenue: string; // Formatted dollars
    conversionRate: string; // Formatted percentage
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

    // Validate user is a seller
    const user = await this.userRepository.findById(userId);
    if (!user || !user.isSeller) {
      throw new AnalyticsPermissionError(
        'Only sellers can access analytics'
      );
    }

    // Normalize and validate date range
    const dateRange = this.normalizeDateRange(
      request.startDate,
      request.endDate
    );

    // Fetch analytics data from repository
    const analytics =
      await this.analyticsRepository.getSellerAnalyticsOverview(
        userId,
        dateRange
      );

    // Format for frontend presentation
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

    // Validate user is a seller
    const user = await this.userRepository.findById(userId);
    if (!user || !user.isSeller) {
      throw new AnalyticsPermissionError(
        'Only sellers can access analytics'
      );
    }

    // Normalize date range
    const dateRange = this.normalizeDateRange(
      request.startDate,
      request.endDate
    );

    // Fetch summary data
    const summary = await this.analyticsRepository.getSellerRevenueSummary(
      userId,
      dateRange
    );

    // Format for presentation
    return {
      totalProjects: summary.totalProjects,
      totalSold: summary.totalSold,
      totalRevenue: this.formatCurrency(summary.totalRevenueCents),
      averageProjectPrice: this.formatCurrency(
        summary.averageProjectPriceCents
      ),
      conversionRate: this.formatPercentage(summary.conversionRate),
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

    // Validate user is a seller
    const user = await this.userRepository.findById(userId);
    if (!user || !user.isSeller) {
      throw new AnalyticsPermissionError(
        'Only sellers can access analytics'
      );
    }

    // Normalize date range
    const dateRange = this.normalizeDateRange(
      request.startDate,
      request.endDate
    );

    // Fetch top projects
    const projects = await this.analyticsRepository.getTopProjects(
      userId,
      limit,
      dateRange
    );

    // Format for presentation
    return projects.map((project) => ({
      projectId: project.projectId,
      title: project.title,
      views: project.viewCount,
      favorites: project.favoriteCount,
      purchases: project.purchaseCount,
      revenue: this.formatCurrency(project.revenueCents),
      conversionRate: this.formatPercentage(project.conversionRate),
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

    // Default to last 30 days if not provided
    const defaultStartDate = new Date(now);
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);

    let start = startDate ? new Date(startDate) : defaultStartDate;
    const end = endDate ? new Date(endDate) : now;

    // Validate dates
    if (isNaN(start.getTime())) {
      throw new AnalyticsValidationError(
        'Invalid start date format',
        'startDate'
      );
    }

    if (isNaN(end.getTime())) {
      throw new AnalyticsValidationError(
        'Invalid end date format',
        'endDate'
      );
    }

    if (start > end) {
      throw new AnalyticsValidationError(
        'Start date must be before end date',
        'startDate'
      );
    }

    // Limit range to 1 year
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
        totalRevenue: this.formatCurrency(
          analytics.summary.totalRevenueCents
        ),
        averageProjectPrice: this.formatCurrency(
          analytics.summary.averageProjectPriceCents
        ),
        conversionRate: this.formatPercentage(
          analytics.summary.conversionRate
        ),
      },
      revenueChart: analytics.revenueOverTime.map((point) => ({
        date: point.date,
        revenue: this.formatCurrency(point.revenueCents),
        transactions: point.transactionCount,
      })),
      topProjects: analytics.topProjects.map((project) => ({
        projectId: project.projectId,
        title: project.title,
        views: project.viewCount,
        favorites: project.favoriteCount,
        purchases: project.purchaseCount,
        revenue: this.formatCurrency(project.revenueCents),
        conversionRate: this.formatPercentage(project.conversionRate),
      })),
    };
  }

  /**
   * Format cents to currency string
   *
   * @param cents - Amount in cents
   * @returns Formatted currency (e.g., "$1,234.56")
   */
  private formatCurrency(cents: number): string {
    const dollars = cents / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(dollars);
  }

  /**
   * Format decimal to percentage string
   *
   * @param decimal - Decimal value (e.g., 0.015 = 1.5%)
   * @returns Formatted percentage (e.g., "1.5%")
   */
  private formatPercentage(decimal: number): string {
    const percentage = decimal * 100;
    return `${percentage.toFixed(2)}%`;
  }
}
