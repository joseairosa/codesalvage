/**
 * Admin API Route: Ban User
 *
 * PUT /api/admin/users/[userId]/ban
 *
 * Responsibilities:
 * - Validate admin session
 * - Validate ban reason (minimum 10 characters)
 * - Ban user via AdminService (with audit logging and email notification)
 * - Return success response or error
 *
 * Request Body:
 * - reason: string (required, min 10 characters)
 *
 * Responses:
 * - 200: User banned successfully
 * - 400: Validation error
 * - 401: Unauthorized (not admin)
 * - 404: User not found
 * - 500: Server error
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { getAdminService } from '@/lib/utils/admin-services';
import { AdminValidationError, AdminAuthorizationError } from '@/lib/services';
import { z } from 'zod';

/**
 * Zod Validation Schema for Ban User Request
 */
const banUserSchema = z.object({
  reason: z
    .string()
    .min(10, 'Ban reason must be at least 10 characters')
    .max(500, 'Ban reason must not exceed 500 characters'),
});

/**
 * PUT /api/admin/users/[userId]/ban
 *
 * Ban a user from the platform.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  // Verify admin session
  const auth = await requireAdminApiAuth(request);

  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Await params
    const { userId } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = banUserSchema.parse(body);

    // Get IP address for audit logging
    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      undefined;

    // Ban user via AdminService
    const adminService = getAdminService();
    const bannedUser = await adminService.banUser(
      auth.user.id,
      userId,
      validatedData.reason,
      ipAddress
    );

    return NextResponse.json(
      {
        success: true,
        user: {
          id: bannedUser.id,
          username: bannedUser.username,
          email: bannedUser.email,
          isBanned: bannedUser.isBanned,
          bannedAt: bannedUser.bannedAt,
          bannedReason: bannedUser.bannedReason,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin API] Ban user error:', error);

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

    // Handle AdminService authorization errors
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    // Handle generic errors
    return NextResponse.json({ error: 'Failed to ban user' }, { status: 500 });
  }
}
