/**
 * Admin API Route: Resolve Content Report
 *
 * PUT /api/admin/reports/[reportId]/resolve
 *
 * Responsibilities:
 * - Validate admin session
 * - Validate resolution data (status and resolution text)
 * - Resolve content report via AdminService (with audit logging)
 * - Return success response or error
 *
 * Request Body:
 * - status: 'resolved' | 'dismissed' (required)
 * - resolution: string (required, min 10 characters)
 *
 * Responses:
 * - 200: Report resolved successfully
 * - 400: Validation error
 * - 401: Unauthorized (not admin)
 * - 404: Report not found
 * - 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { getAdminService } from '@/lib/utils/admin-services';
import { AdminValidationError } from '@/lib/services';
import { z } from 'zod';

/**
 * Zod Validation Schema for Resolve Report Request
 */
const resolveReportSchema = z.object({
  status: z.enum(['resolved', 'dismissed'], {
    errorMap: () => ({ message: 'Status must be either "resolved" or "dismissed"' }),
  }),
  resolution: z
    .string()
    .min(10, 'Resolution must be at least 10 characters')
    .max(500, 'Resolution must not exceed 500 characters'),
});

/**
 * PUT /api/admin/reports/[reportId]/resolve
 *
 * Resolve or dismiss a content report.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  // Verify admin session
  const auth = await requireAdminApiAuth(request);

  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Await params
    const { reportId } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = resolveReportSchema.parse(body);

    // Get IP address for audit logging
    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      undefined;

    // Resolve report via AdminService
    const adminService = getAdminService();
    const report = await adminService.resolveContentReport(
      auth.user.id,
      reportId,
      validatedData.resolution,
      validatedData.status,
      ipAddress
    );

    return NextResponse.json(
      {
        success: true,
        report: {
          id: report.id,
          status: report.status,
          reviewedBy: report.reviewedBy,
          reviewedAt: report.reviewedAt,
          resolution: report.resolution,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin API] Resolve report error:', error);

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
      { error: 'Failed to resolve report' },
      { status: 500 }
    );
  }
}
