/**
 * Admin API Route: Release Escrow Manually
 *
 * PUT /api/admin/transactions/[transactionId]/release-escrow
 *
 * Responsibilities:
 * - Validate admin session
 * - Validate release reason (minimum 10 characters)
 * - Release escrow manually via AdminService (with audit logging)
 * - Return success response or error
 *
 * Request Body:
 * - reason: string (required, min 10 characters)
 *
 * Responses:
 * - 200: Escrow released successfully
 * - 400: Validation error
 * - 401: Unauthorized (not admin)
 * - 404: Transaction not found
 * - 500: Server error
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { getAdminService } from '@/lib/utils/admin-services';
import { AdminValidationError } from '@/lib/services';
import { z } from 'zod';

/**
 * Zod Validation Schema for Release Escrow Request
 */
const releaseEscrowSchema = z.object({
  reason: z
    .string()
    .min(10, 'Release reason must be at least 10 characters')
    .max(500, 'Release reason must not exceed 500 characters'),
});

/**
 * PUT /api/admin/transactions/[transactionId]/release-escrow
 *
 * Manually release escrow for a transaction (dispute resolution).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  // Verify admin session
  const auth = await requireAdminApiAuth(request);

  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Await params
    const { transactionId } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = releaseEscrowSchema.parse(body);

    // Get IP address for audit logging
    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      undefined;

    // Release escrow via AdminService
    const adminService = getAdminService();
    const transaction = await adminService.releaseEscrowManually(
      auth.user.id,
      transactionId,
      validatedData.reason,
      ipAddress
    );

    return NextResponse.json(
      {
        success: true,
        transaction: {
          id: transaction.id,
          amountCents: transaction.amountCents,
          paymentStatus: transaction.paymentStatus,
          escrowStatus: transaction.escrowStatus,
          escrowReleaseDate: transaction.escrowReleaseDate,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin API] Release escrow error:', error);

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
    return NextResponse.json({ error: 'Failed to release escrow' }, { status: 500 });
  }
}
