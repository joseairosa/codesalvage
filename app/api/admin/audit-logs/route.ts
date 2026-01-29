/**
 * Admin API Route: List Audit Logs
 *
 * GET /api/admin/audit-logs
 *
 * Responsibilities:
 * - Validate admin session
 * - Parse and validate query parameters
 * - Fetch audit logs with filters via AdminService
 * - Return paginated audit log list
 *
 * Query Parameters:
 * - adminId: string (optional) - Filter by admin user ID
 * - targetType: string (optional) - Filter by target type
 * - targetId: string (optional) - Filter by target ID
 * - action: string (optional) - Filter by action type
 * - limit: number (optional) - Results per page (default: 50, max: 100)
 * - offset: number (optional) - Pagination offset (default: 0)
 *
 * Responses:
 * - 200: Audit logs fetched successfully
 * - 401: Unauthorized (not admin)
 * - 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth-helpers';
import { getAdminService, getAdminRepository } from '@/lib/utils/admin-services';

/**
 * GET /api/admin/audit-logs
 *
 * Fetch all audit logs with optional filters and pagination.
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

    // String filters
    const adminId = searchParams.get('adminId') || undefined;
    const targetType = searchParams.get('targetType') || undefined;
    const targetId = searchParams.get('targetId') || undefined;
    const action = searchParams.get('action') || undefined;

    // Pagination
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '50', 10),
      100
    );
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Fetch audit logs via AdminService
    const adminService = getAdminService();
    const auditLogs = await adminService.getAuditLogs({
      adminId,
      targetType,
      targetId,
      action,
      limit,
      offset,
    });

    // Get total count for pagination metadata
    const adminRepository = getAdminRepository();
    const total = await adminRepository.countAuditLogs(adminId);

    return NextResponse.json(
      {
        auditLogs,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + auditLogs.length < total,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin API] Fetch audit logs error:', error);

    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
