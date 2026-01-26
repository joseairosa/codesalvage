/**
 * Seller Analytics Overview API Route
 *
 * Get comprehensive analytics data for sellers (revenue, projects, charts).
 *
 * GET /api/analytics/overview - Get seller analytics overview
 *
 * Query params:
 * - startDate (optional): ISO date string (default: 30 days ago)
 * - endDate (optional): ISO date string (default: now)
 * - granularity (optional): 'day' | 'week' | 'month' (default: 'day')
 *
 * @example
 * GET /api/analytics/overview?startDate=2026-01-01&endDate=2026-01-31&granularity=day
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  AnalyticsService,
  AnalyticsPermissionError,
  AnalyticsValidationError,
} from '@/lib/services/AnalyticsService';
import { AnalyticsRepository } from '@/lib/repositories/AnalyticsRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';

const componentName = 'AnalyticsOverviewAPI';

// Initialize repositories and service
const analyticsRepository = new AnalyticsRepository(prisma);
const userRepository = new UserRepository(prisma);
const analyticsService = new AnalyticsService(
  analyticsRepository,
  userRepository
);

/**
 * GET /api/analytics/overview
 *
 * Get seller analytics overview with revenue charts and top projects
 *
 * Access control: Only sellers can access analytics
 * Business rules:
 * - Date range defaults to last 30 days
 * - Maximum date range is 1 year
 * - Start date must be before end date
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const granularity = (searchParams.get('granularity') as
      | 'day'
      | 'week'
      | 'month') || 'day';

    console.log(`[${componentName}] Fetching analytics overview:`, {
      userId: session.user.id,
      startDate,
      endDate,
      granularity,
    });

    // Get analytics overview via service
    const analytics = await analyticsService.getSellerAnalyticsOverview(
      session.user.id,
      {
        startDate,
        endDate,
        granularity,
      }
    );

    console.log(`[${componentName}] Analytics overview retrieved:`, {
      totalProjects: analytics.summary.totalProjects,
      totalSold: analytics.summary.totalSold,
      totalRevenue: analytics.summary.totalRevenue,
    });

    return NextResponse.json(analytics, { status: 200 });
  } catch (error) {
    console.error(`[${componentName}] Error fetching analytics:`, error);

    // Map service errors to appropriate HTTP status codes
    if (error instanceof AnalyticsValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          field: error.field,
        },
        { status: 400 }
      );
    }

    if (error instanceof AnalyticsPermissionError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
