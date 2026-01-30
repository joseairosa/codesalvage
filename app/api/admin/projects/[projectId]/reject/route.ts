/**
 * Admin API Route: Reject Project
 *
 * PUT /api/admin/projects/[projectId]/reject
 *
 * Responsibilities:
 * - Validate admin session
 * - Validate rejection reason (minimum 10 characters)
 * - Reject project via AdminService (with audit logging)
 * - Return success response or error
 *
 * Request Body:
 * - reason: string (required, min 10 characters)
 *
 * Responses:
 * - 200: Project rejected successfully
 * - 400: Validation error
 * - 401: Unauthorized (not admin)
 * - 404: Project not found
 * - 500: Server error
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { getAdminService } from '@/lib/utils/admin-services';
import { AdminValidationError } from '@/lib/services';
import { z } from 'zod';

/**
 * Zod Validation Schema for Reject Project Request
 */
const rejectProjectSchema = z.object({
  reason: z
    .string()
    .min(10, 'Rejection reason must be at least 10 characters')
    .max(500, 'Rejection reason must not exceed 500 characters'),
});

/**
 * PUT /api/admin/projects/[projectId]/reject
 *
 * Reject a project from being listed on the platform.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  // Verify admin session
  const auth = await requireAdminApiAuth(request);

  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Await params
    const { projectId } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = rejectProjectSchema.parse(body);

    // Get IP address for audit logging
    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      undefined;

    // Reject project via AdminService
    const adminService = getAdminService();
    const rejectedProject = await adminService.rejectProject(
      auth.user.id,
      projectId,
      validatedData.reason,
      ipAddress
    );

    return NextResponse.json(
      {
        success: true,
        project: {
          id: rejectedProject.id,
          title: rejectedProject.title,
          status: rejectedProject.status,
          rejectionReason: rejectedProject.rejectionReason,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin API] Reject project error:', error);

    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    // Handle AdminService validation errors
    if (error instanceof AdminValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Handle generic errors
    return NextResponse.json(
      { error: 'Failed to reject project' },
      { status: 500 }
    );
  }
}
