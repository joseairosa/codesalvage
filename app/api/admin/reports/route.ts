/**
 * Admin API Route: List Content Reports
 *
 * GET /api/admin/reports
 *
 * Responsibilities:
 * - Validate admin session
 * - Parse and validate query parameters
 * - Fetch content reports with filters via AdminService
 * - Return paginated content report list
 *
 * Query Parameters:
 * - status: string (optional) - Filter by report status (pending, reviewed, resolved, dismissed)
 * - contentType: string (optional) - Filter by content type (project, user, review, message)
 * - limit: number (optional) - Results per page (default: 50, max: 100)
 * - offset: number (optional) - Pagination offset (default: 0)
 *
 * Responses:
 * - 200: Content reports fetched successfully
 * - 401: Unauthorized (not admin)
 * - 500: Server error
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { getAdminService, getAdminRepository } from '@/lib/utils/admin-services';

/**
 * GET /api/admin/reports
 *
 * Fetch all content reports with optional filters and pagination.
 */
export async function GET(request: NextRequest) {
  // Verify admin session
  const auth = await requireAdminApiAuth(request);

  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;

    // String filters
    const status = searchParams.get('status') || undefined;
    const contentType = searchParams.get('contentType') || undefined;

    // Pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Fetch content reports via AdminService
    const adminService = getAdminService();

    // Filter out undefined values to satisfy exactOptionalPropertyTypes
    const filters = Object.fromEntries(
      Object.entries({
        status,
        contentType,
      }).filter(([_, value]) => value !== undefined)
    ) as {
      status?: string;
      contentType?: string;
    };

    const reports = await adminService.getContentReports({
      ...filters,
      limit,
      offset,
    });

    // Get total count for pagination metadata
    const adminRepository = getAdminRepository();
    const total = await adminRepository.countContentReports(status);

    return NextResponse.json(
      {
        reports,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + reports.length < total,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin API] Fetch content reports error:', error);

    return NextResponse.json(
      { error: 'Failed to fetch content reports' },
      { status: 500 }
    );
  }
}
