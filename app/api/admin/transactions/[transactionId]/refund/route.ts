/**
 * Admin API Route: Refund Transaction
 *
 * PUT /api/admin/transactions/[transactionId]/refund
 *
 * Responsibilities:
 * - Validate admin session
 * - Validate refund reason (minimum 10 characters)
 * - Refund transaction via AdminService (Stripe refund, audit logging, buyer email)
 * - Return success response or error
 *
 * Request Body:
 * - reason: string (required, min 10 characters)
 *
 * Responses:
 * - 200: Transaction refunded successfully
 * - 400: Validation error (bad reason, wrong transaction state)
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
 * Zod Validation Schema for Refund Request
 */
const refundSchema = z.object({
  reason: z
    .string()
    .min(10, 'Refund reason must be at least 10 characters')
    .max(500, 'Refund reason must not exceed 500 characters'),
});

/**
 * PUT /api/admin/transactions/[transactionId]/refund
 *
 * Refund a transaction via Stripe and update escrow status.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  const auth = await requireAdminApiAuth(request);

  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { transactionId } = await params;

    const body = await request.json();
    const validatedData = refundSchema.parse(body);

    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      undefined;

    const adminService = getAdminService();
    const result = await adminService.refundTransaction(
      auth.user.id,
      transactionId,
      validatedData.reason,
      ipAddress
    );

    return NextResponse.json(
      {
        success: true,
        transaction: {
          id: result.transaction.id,
          amountCents: result.transaction.amountCents,
          paymentStatus: result.transaction.paymentStatus,
          escrowStatus: result.transaction.escrowStatus,
        },
        ...(result.warning ? { warning: result.warning } : {}),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin API] Refund transaction error:', error);

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

    if (error instanceof AdminValidationError) {
      if (error.message.toLowerCase().includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to refund transaction' }, { status: 500 });
  }
}
