/**
 * Admin API Route: Update User Roles
 *
 * PATCH /api/admin/users/[userId]
 *
 * Responsibilities:
 * - Validate admin session
 * - Validate role flags (at least one must be provided)
 * - Update user role flags via UserRepository
 * - Return success response with updated user
 *
 * Request Body:
 * - isSeller?: boolean
 * - isVerifiedSeller?: boolean
 * - isAdmin?: boolean
 *
 * Responses:
 * - 200: User roles updated successfully
 * - 400: Validation error (empty body or invalid fields)
 * - 401: Unauthorized (not admin)
 * - 404: User not found
 * - 500: Server error
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { getUserRepository } from '@/lib/utils/admin-services';
import { z } from 'zod';

const updateUserRolesSchema = z
  .object({
    isSeller: z.boolean().optional(),
    isVerifiedSeller: z.boolean().optional(),
    isAdmin: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.isSeller !== undefined ||
      data.isVerifiedSeller !== undefined ||
      data.isAdmin !== undefined,
    { message: 'At least one role field must be provided' }
  );

/**
 * PATCH /api/admin/users/[userId]
 *
 * Update role flags for a user. Admin-only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAdminApiAuth(request);

  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { userId } = await params;

    const body = await request.json();
    const validatedData = updateUserRolesSchema.parse(body);

    console.log('[API] PATCH /api/admin/users/:id - updating roles', {
      adminId: auth.user.id,
      userId,
      roles: validatedData,
    });

    const userRepo = getUserRepository();
    // Strip undefined values: exactOptionalPropertyTypes requires absent keys, not undefined ones
    const roles: { isSeller?: boolean; isVerifiedSeller?: boolean; isAdmin?: boolean } =
      Object.fromEntries(
        Object.entries(validatedData).filter(([, v]) => v !== undefined)
      );
    const updatedUser = await userRepo.updateUserRoles(userId, roles);

    return NextResponse.json(
      {
        success: true,
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          email: updatedUser.email,
          isSeller: updatedUser.isSeller,
          isVerifiedSeller: updatedUser.isVerifiedSeller,
          isAdmin: updatedUser.isAdmin,
        },
      },
      { status: 200 }
    );
  } catch (error) {
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

    if (error instanceof Error && error.message.includes('user may not exist')) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.error('[API] PATCH /api/admin/users/:id - error:', error);
    return NextResponse.json({ error: 'Failed to update user roles' }, { status: 500 });
  }
}
