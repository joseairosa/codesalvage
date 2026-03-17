/**
 * Seller Onboarding Status API Route
 *
 * GET /api/seller/onboard/status
 *
 * Returns the current seller onboarding status based on SellerPayoutDetails.
 */

import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payoutDetails = await prisma.sellerPayoutDetails.findUnique({
      where: { userId: auth.user.id },
    });

    if (!payoutDetails || !payoutDetails.isActive) {
      return NextResponse.json(
        {
          isOnboarded: false,
          payoutMethod: null,
          payoutEmail: null,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        isOnboarded: true,
        payoutMethod: payoutDetails.payoutMethod,
        payoutEmail: payoutDetails.payoutEmail,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Seller Onboard Status] Error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Failed to check onboarding status', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
