/**
 * Admin API Route: Unban User
 *
 * PUT /api/admin/users/[userId]/unban
 *
 * Responsibilities:
 * - Validate admin session
 * - Unban user via AdminService (with audit logging and email notification)
 * - Return success response or error
 *
 * Request Body: (none required)
 *
 * Responses:
 * - 200: User unbanned successfully
 * - 400: Validation error
 * - 401: Unauthorized (not admin)
 * - 404: User not found
 * - 500: Server error
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { getAdminService } from '@/lib/utils/admin-services';
import { AdminValidationError } from '@/lib/services';

/**
 * PUT /api/admin/users/[userId]/unban
 *
 * Unban a user from the platform.
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

    // Get IP address for audit logging
    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      undefined;

    // Unban user via AdminService
    const adminService = getAdminService();
    const unbannedUser = await adminService.unbanUser(auth.user.id, userId, ipAddress);

    return NextResponse.json(
      {
        success: true,
        user: {
          id: unbannedUser.id,
          username: unbannedUser.username,
          email: unbannedUser.email,
          isBanned: unbannedUser.isBanned,
          bannedAt: unbannedUser.bannedAt,
          bannedReason: unbannedUser.bannedReason,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin API] Unban user error:', error);

    // Handle AdminService validation errors
    if (error instanceof AdminValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Handle generic errors
    return NextResponse.json({ error: 'Failed to unban user' }, { status: 500 });
  }
}
