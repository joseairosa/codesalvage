/**
 * AnalyticsRepository
 *
 * Data access layer for seller analytics and metrics.
 * Provides aggregated data for seller dashboards and reporting.
 *
 * Responsibilities:
 * - Fetch seller revenue metrics
 * - Calculate project performance stats
 * - Aggregate transaction data
 * - Generate time-series data for charts
 *
 * Architecture:
 * - Pure data access layer (no business logic)
 * - Returns typed aggregated data
 * - Optimized queries for analytics
 * - Supports date range filtering
 */

import type { PrismaClient } from '@prisma/client';

/**
 * Seller revenue summary
 */
export interface SellerRevenueSummary {
  totalProjects: number;
  totalSold: number;
  totalRevenueCents: number;
  averageProjectPriceCents: number;
  conversionRate: number; // views to sales ratio
}

/**
 * Revenue time series data point
 */
export interface RevenueDataPoint {
  date: string; // ISO date string (YYYY-MM-DD)
  revenueCents: number;
  transactionCount: number;
}

/**
 * Project performance metrics
 */
export interface ProjectPerformanceMetrics {
  projectId: string;
  title: string;
  viewCount: number;
  favoriteCount: number;
  purchaseCount: number;
  revenueCents: number;
  conversionRate: number;
}

/**
 * Seller analytics overview
 */
export interface SellerAnalyticsOverview {
  userId: string;
  summary: SellerRevenueSummary;
  revenueOverTime: RevenueDataPoint[];
  topProjects: ProjectPerformanceMetrics[];
}

/**
 * Date range filter
 */
export interface DateRangeFilter {
  startDate?: Date;
  endDate?: Date;
}

export class AnalyticsRepository {
  constructor(private prisma: PrismaClient) {
    console.log('[AnalyticsRepository] Initialized');
  }

  /**
   * Get seller revenue summary
   *
   * Aggregates total projects, sales, revenue, and conversion metrics
   *
   * @param sellerId - User ID of the seller
   * @param dateRange - Optional date range filter
   * @returns Revenue summary metrics
   */
  async getSellerRevenueSummary(
    sellerId: string,
    dateRange?: DateRangeFilter
  ): Promise<SellerRevenueSummary> {
    // Get total projects count (ALL projects, not filtered by date)
    // Date range only applies to sales/revenue, not to project inventory
    const totalProjects = await this.prisma.project.count({
      where: {
        sellerId,
      },
    });

    // Get sold projects count and revenue (filtered by date range)
    const transactions = await this.prisma.transaction.findMany({
      where: {
        sellerId,
        paymentStatus: 'succeeded',
        ...(dateRange && {
          completedAt: {
            gte: dateRange.startDate,
            lte: dateRange.endDate,
          },
        }),
      },
      select: {
        sellerReceivesCents: true,
        projectId: true,
      },
    });

    const totalSold = new Set(transactions.map((t) => t.projectId)).size;
    const totalRevenueCents = transactions.reduce(
      (sum, t) => sum + t.sellerReceivesCents,
      0
    );

    // Get ALL projects for average price and total views (not filtered by date)
    const projects = await this.prisma.project.findMany({
      where: {
        sellerId,
      },
      select: {
        viewCount: true,
        priceCents: true,
      },
    });

    const totalViews = projects.reduce((sum, p) => sum + p.viewCount, 0);
    const averageProjectPriceCents =
      projects.length > 0
        ? Math.round(projects.reduce((sum, p) => sum + p.priceCents, 0) / projects.length)
        : 0;

    const conversionRate =
      totalViews > 0 ? Number((totalSold / totalViews).toFixed(4)) : 0;

    return {
      totalProjects,
      totalSold,
      totalRevenueCents,
      averageProjectPriceCents,
      conversionRate,
    };
  }

  /**
   * Get revenue over time (time series data)
   *
   * Returns daily revenue aggregated by date for charting
   *
   * @param sellerId - User ID of the seller
   * @param dateRange - Date range filter
   * @param granularity - Time granularity ('day', 'week', 'month')
   * @returns Array of revenue data points
   */
  async getRevenueOverTime(
    sellerId: string,
    dateRange: DateRangeFilter,
    granularity: 'day' | 'week' | 'month' = 'day'
  ): Promise<RevenueDataPoint[]> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        sellerId,
        paymentStatus: 'succeeded',
        completedAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        completedAt: true,
        sellerReceivesCents: true,
      },
      orderBy: {
        completedAt: 'asc',
      },
    });

    // Group by date
    const revenueByDate = new Map<string, { revenue: number; count: number }>();

    for (const transaction of transactions) {
      // Skip transactions without completedAt date
      if (!transaction.completedAt) continue;

      const date = this.formatDateByGranularity(transaction.completedAt, granularity);

      const existing = revenueByDate.get(date) || { revenue: 0, count: 0 };
      revenueByDate.set(date, {
        revenue: existing.revenue + transaction.sellerReceivesCents,
        count: existing.count + 1,
      });
    }

    // Convert to array
    return Array.from(revenueByDate.entries())
      .map(([date, data]) => ({
        date,
        revenueCents: data.revenue,
        transactionCount: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get top performing projects by revenue
   *
   * @param sellerId - User ID of the seller
   * @param limit - Maximum number of projects to return
   * @param dateRange - Optional date range filter
   * @returns Array of project performance metrics
   */
  async getTopProjects(
    sellerId: string,
    limit: number = 10,
    dateRange?: DateRangeFilter
  ): Promise<ProjectPerformanceMetrics[]> {
    const projects = await this.prisma.project.findMany({
      where: {
        sellerId,
      },
      select: {
        id: true,
        title: true,
        viewCount: true,
        favoriteCount: true,
        transactions: {
          where: {
            paymentStatus: 'succeeded',
            ...(dateRange && {
              completedAt: {
                gte: dateRange.startDate,
                lte: dateRange.endDate,
              },
            }),
          },
          select: {
            sellerReceivesCents: true,
          },
        },
      },
    });

    // Calculate metrics for each project
    const projectMetrics: ProjectPerformanceMetrics[] = projects.map((project) => {
      const purchaseCount = project.transactions.length;
      const revenueCents = project.transactions.reduce(
        (sum, t) => sum + t.sellerReceivesCents,
        0
      );
      const conversionRate =
        project.viewCount > 0
          ? Number((purchaseCount / project.viewCount).toFixed(4))
          : 0;

      return {
        projectId: project.id,
        title: project.title,
        viewCount: project.viewCount,
        favoriteCount: project.favoriteCount,
        purchaseCount,
        revenueCents,
        conversionRate,
      };
    });

    // Filter out projects with no revenue, sort by revenue (descending), and take top N
    return projectMetrics
      .filter((project) => project.revenueCents > 0)
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, limit);
  }

  /**
   * Get complete seller analytics overview
   *
   * Aggregates all analytics data for a seller dashboard
   *
   * @param sellerId - User ID of the seller
   * @param dateRange - Date range filter
   * @returns Complete analytics overview
   */
  async getSellerAnalyticsOverview(
    sellerId: string,
    dateRange: DateRangeFilter
  ): Promise<SellerAnalyticsOverview> {
    const [summary, revenueOverTime, topProjects] = await Promise.all([
      this.getSellerRevenueSummary(sellerId, dateRange),
      this.getRevenueOverTime(sellerId, dateRange),
      this.getTopProjects(sellerId, 10, dateRange),
    ]);

    return {
      userId: sellerId,
      summary,
      revenueOverTime,
      topProjects,
    };
  }

  /**
   * Format date by granularity
   *
   * Helper to format dates based on time granularity
   *
   * @param date - Date to format
   * @param granularity - Time granularity
   * @returns Formatted date string
   */
  private formatDateByGranularity(
    date: Date,
    granularity: 'day' | 'week' | 'month'
  ): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    switch (granularity) {
      case 'day':
        return `${year}-${month}-${day}`;
      case 'week': {
        // Get ISO week number
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekMonth = String(weekStart.getMonth() + 1).padStart(2, '0');
        const weekDay = String(weekStart.getDate()).padStart(2, '0');
        return `${year}-${weekMonth}-${weekDay}`;
      }
      case 'month':
        return `${year}-${month}`;
      default:
        return `${year}-${month}-${day}`;
    }
  }
}
