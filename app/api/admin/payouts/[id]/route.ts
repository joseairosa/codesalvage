/**
 * Admin Payout Action API Route
 *
 * PATCH /api/admin/payouts/[id] — Mark completed or retry failed payout
 */

import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { SellerPayoutDetailsRepository } from '@/lib/repositories/SellerPayoutDetailsRepository';
import { PayoutRequestRepository } from '@/lib/repositories/PayoutRequestRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import {
  PayoutService,
  PayoutValidationError,
  PayoutNotFoundError,
} from '@/lib/services/PayoutService';
import { emailService } from '@/lib/services';

const payoutDetailsRepo = new SellerPayoutDetailsRepository(prisma);
const payoutRequestRepo = new PayoutRequestRepository(prisma);
const userRepo = new UserRepository(prisma);
const transactionRepo = new TransactionRepository(prisma);
const payoutService = new PayoutService(
  payoutDetailsRepo,
  payoutRequestRepo,
  userRepo,
  transactionRepo,
  emailService
);

const actionSchema = z.object({
  action: z.enum(['complete', 'retry']),
  externalReference: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth || !auth.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = actionSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validatedData.error.errors },
        { status: 400 }
      );
    }

    const { action, externalReference } = validatedData.data;

    if (action === 'complete') {
      await payoutService.markCompleted(id, auth.user.id, externalReference || 'manual');
    } else if (action === 'retry') {
      await payoutService.retryFailed(id);
    }

    return NextResponse.json({ success: true, action, id }, { status: 200 });
  } catch (error) {
    if (error instanceof PayoutNotFoundError) {
      return NextResponse.json(
        { error: 'Not found', message: error.message },
        { status: 404 }
      );
    }

    if (error instanceof PayoutValidationError) {
      return NextResponse.json(
        { error: 'Validation error', message: error.message },
        { status: 400 }
      );
    }

    console.error('[Admin Payout Action] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process action',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
