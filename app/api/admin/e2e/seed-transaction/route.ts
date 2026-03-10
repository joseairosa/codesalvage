/**
 * Admin E2E Route: Seed Transaction
 *
 * POST /api/admin/e2e/seed-transaction
 *
 * Creates a completed transaction for E2E testing (specifically the Reviews suite).
 * Only available when E2E_SEED_ENABLED=true is set in the environment.
 *
 * Request Body:
 * - projectId: string
 * - sellerId: string
 * - buyerId: string
 * - amountCents: number
 *
 * Responses:
 * - 201: Transaction created
 * - 400: Validation error
 * - 401: Unauthorized (not admin)
 * - 404: Not available (E2E_SEED_ENABLED not set)
 * - 500: Server error
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const seedTransactionSchema = z.object({
  projectId: z.string().min(1),
  sellerId: z.string().min(1),
  buyerId: z.string().min(1),
  amountCents: z.number().int().positive(),
});

/**
 * POST /api/admin/e2e/seed-transaction
 *
 * Creates a fake completed transaction for E2E testing.
 * Guarded by E2E_SEED_ENABLED env var.
 */
export async function POST(request: NextRequest) {
  if (process.env['E2E_SEED_ENABLED'] !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const auth = await requireAdminApiAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = seedTransactionSchema.parse(body);

    const commissionCents = Math.round(data.amountCents * 0.18);
    const sellerReceivesCents = data.amountCents - commissionCents;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const ts = Date.now();

    console.warn('[API] E2E seed-transaction called by admin:', auth.user.id);

    const transaction = await prisma.transaction.create({
      data: {
        projectId: data.projectId,
        sellerId: data.sellerId,
        buyerId: data.buyerId,
        amountCents: data.amountCents,
        commissionCents,
        sellerReceivesCents,
        paymentStatus: 'succeeded',
        escrowStatus: 'released',
        stripePaymentIntentId: `e2e_pi_${ts}`,
        stripeChargeId: `e2e_ch_${ts}`,
        codeDeliveryStatus: 'delivered',
        escrowReleaseDate: yesterday,
        releasedToSellerAt: yesterday,
      },
    });

    return NextResponse.json({ transaction }, { status: 201 });
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

    console.error('[API] POST /api/admin/e2e/seed-transaction - error:', error);
    return NextResponse.json({ error: 'Failed to seed transaction' }, { status: 500 });
  }
}
