/**
 * Admin API Route: List Projects
 *
 * GET /api/admin/projects
 *
 * Responsibilities:
 * - Validate admin session
 * - Parse and validate query parameters
 * - Fetch projects with filters via AdminService
 * - Return paginated project list
 *
 * Query Parameters:
 * - status: string | string[] (optional) - Filter by project status
 * - isFeatured: boolean (optional) - Filter by featured flag
 * - sellerId: string (optional) - Filter by seller ID
 * - sortBy: string (optional) - Sort field (default: createdAt)
 * - sortOrder: 'asc' | 'desc' (optional) - Sort order (default: desc)
 * - limit: number (optional) - Results per page (default: 50, max: 100)
 * - offset: number (optional) - Pagination offset (default: 0)
 *
 * Responses:
 * - 200: Projects fetched successfully
 * - 401: Unauthorized (not admin)
 * - 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth-helpers';
import { getAdminService, getProjectRepository } from '@/lib/utils/admin-services';

/**
 * GET /api/admin/projects
 *
 * Fetch all projects with optional filters and pagination.
 */
export async function GET(request: NextRequest) {
  // Verify admin session
  const session = await requireAdminApi();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;

    // Status filter (can be single value or comma-separated list)
    const statusParam = searchParams.get('status');
    const status = statusParam
      ? statusParam.includes(',')
        ? statusParam.split(',')
        : statusParam
      : undefined;

    // Boolean filters
    const isFeatured =
      searchParams.get('isFeatured') === 'true'
        ? true
        : searchParams.get('isFeatured') === 'false'
        ? false
        : undefined;

    // String filters
    const sellerId = searchParams.get('sellerId') || undefined;

    // Sorting
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as
      | 'asc'
      | 'desc';

    // Pagination
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '50', 10),
      100
    );
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Fetch projects via AdminService
    const adminService = getAdminService();
    const projects = await adminService.getProjects({
      status,
      isFeatured,
      sellerId,
      limit,
      offset,
      sortBy,
      sortOrder,
    });

    // Get total count for pagination metadata
    const projectRepository = getProjectRepository();
    const total = await projectRepository.countAllProjects(
      typeof status === 'string' ? status : undefined
    );

    return NextResponse.json(
      {
        projects,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + projects.length < total,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin API] Fetch projects error:', error);

    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
