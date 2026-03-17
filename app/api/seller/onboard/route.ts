/**
 * Seller Onboarding API Route
 *
 * POST /api/seller/onboard
 *
 * Submits payout details and sets user as a verified seller.
 * Replaces the old Stripe Connect onboarding flow.
 */

import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { SellerPayoutDetailsRepository } from '@/lib/repositories/SellerPayoutDetailsRepository';
import { PayoutRequestRepository } from '@/lib/repositories/PayoutRequestRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import { PayoutService, PayoutValidationError } from '@/lib/services/PayoutService';
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

const onboardSchema = z.object({
  payoutMethod: z.string().min(1, 'Payout method is required'),
  payoutEmail: z.string().email('Invalid email format'),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the seller terms' }),
  }),
});

export async function POST(request: Request) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = onboardSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validatedData.error.errors },
        { status: 400 }
      );
    }

    const { payoutMethod, payoutEmail } = validatedData.data;

    console.log('[Seller Onboard] Submitting payout details for user:', auth.user.id);

    const result = await payoutService.submitPayoutDetails(auth.user.id, {
      payoutMethod,
      payoutEmail,
    });

    console.log('[Seller Onboard] Payout details saved, user verified');

    return NextResponse.json(
      {
        payoutMethod: result.payoutMethod,
        payoutEmail: result.payoutEmail,
        isVerifiedSeller: true,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof PayoutValidationError) {
      return NextResponse.json(
        { error: 'Validation error', message: error.message, field: error.field },
        { status: 400 }
      );
    }

    console.error('[Seller Onboard] Error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Failed to complete onboarding', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
