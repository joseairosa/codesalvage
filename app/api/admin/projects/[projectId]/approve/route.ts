/**
 * Admin API Route: Approve Project
 *
 * PUT /api/admin/projects/[projectId]/approve
 *
 * Responsibilities:
 * - Validate admin session
 * - Approve project via AdminService (with audit logging)
 * - Return success response or error
 *
 * Request Body: (none required)
 *
 * Responses:
 * - 200: Project approved successfully
 * - 400: Validation error
 * - 401: Unauthorized (not admin)
 * - 404: Project not found
 * - 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth-helpers';
import { getAdminService } from '@/lib/utils/admin-services';
import { AdminValidationError } from '@/lib/services';

/**
 * PUT /api/admin/projects/[projectId]/approve
 *
 * Approve a project for listing on the platform.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  // Verify admin session
  const session = await requireAdminApi();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get IP address for audit logging
    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      undefined;

    // Approve project via AdminService
    const adminService = getAdminService();
    const approvedProject = await adminService.approveProject(
      session.user.id,
      params.projectId,
      ipAddress
    );

    return NextResponse.json(
      {
        success: true,
        project: {
          id: approvedProject.id,
          title: approvedProject.title,
          status: approvedProject.status,
          approvedBy: approvedProject.approvedBy,
          approvedAt: approvedProject.approvedAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin API] Approve project error:', error);

    // Handle AdminService validation errors
    if (error instanceof AdminValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Handle generic errors
    return NextResponse.json(
      { error: 'Failed to approve project' },
      { status: 500 }
    );
  }
}
