/**
 * Admin API Route: Toggle Project Featured Status
 *
 * PUT /api/admin/projects/[projectId]/feature
 *
 * Responsibilities:
 * - Validate admin session
 * - Validate featured status and days (optional)
 * - Toggle project featured status via AdminService (with audit logging)
 * - Return success response or error
 *
 * Request Body:
 * - featured: boolean (required)
 * - featuredDays: number (optional, default: 30, max: 365)
 *
 * Responses:
 * - 200: Featured status toggled successfully
 * - 400: Validation error
 * - 401: Unauthorized (not admin)
 * - 404: Project not found
 * - 500: Server error
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { getAdminService } from '@/lib/utils/admin-services';
import { AdminValidationError } from '@/lib/services';
import { z } from 'zod';

/**
 * Zod Validation Schema for Toggle Featured Request
 */
const toggleFeaturedSchema = z.object({
  featured: z.boolean(),
  featuredDays: z
    .number()
    .min(1, 'Featured days must be at least 1')
    .max(365, 'Featured days must not exceed 365')
    .optional()
    .default(30),
});

/**
 * PUT /api/admin/projects/[projectId]/feature
 *
 * Toggle featured status for a project.
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
    const validatedData = toggleFeaturedSchema.parse(body);

    // Get IP address for audit logging
    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      undefined;

    // Toggle featured status via AdminService
    const adminService = getAdminService();
    const project = await adminService.toggleProjectFeatured(
      auth.user.id,
      projectId,
      validatedData.featured,
      validatedData.featuredDays,
      ipAddress
    );

    return NextResponse.json(
      {
        success: true,
        project: {
          id: project.id,
          title: project.title,
          isFeatured: project.isFeatured,
          featuredBy: project.featuredBy,
          featuredAt: project.featuredAt,
          featuredUntil: project.featuredUntil,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin API] Toggle featured error:', error);

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
      { error: 'Failed to toggle featured status' },
      { status: 500 }
    );
  }
}
