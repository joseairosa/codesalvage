/**
 * Stripe Connect Status API Route
 *
 * Check seller's Stripe Connect account status.
 * Returns whether account is fully onboarded and can receive payouts.
 *
 * GET /api/stripe/connect/status
 *
 * @example
 * GET /api/stripe/connect/status
 * Response: { isOnboarded: true, accountId: "acct_..." }
 */

import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { stripeService } from '@/lib/services';

/**
 * GET /api/stripe/connect/status
 *
 * Get Connect account status for current user
 */
export async function GET(request: Request) {
  try {
    // Check authentication
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Stripe Status] Checking status for user:', auth.user.id);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: {
        id: true,
        stripeAccountId: true,
        isSeller: true,
        isVerifiedSeller: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // No Stripe account yet
    if (!user.stripeAccountId) {
      return NextResponse.json(
        {
          isOnboarded: false,
          accountId: null,
          needsOnboarding: true,
        },
        { status: 200 }
      );
    }

    // Check account status with Stripe
    const isOnboarded = await stripeService.isAccountOnboarded(user.stripeAccountId);

    console.log('[Stripe Status] Account status:', {
      accountId: user.stripeAccountId,
      isOnboarded,
    });

    // Update isVerifiedSeller if onboarding complete
    if (isOnboarded && !user.isVerifiedSeller) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isVerifiedSeller: true },
      });

      console.log('[Stripe Status] User marked as verified seller');
    }

    return NextResponse.json(
      {
        isOnboarded,
        accountId: user.stripeAccountId,
        needsOnboarding: !isOnboarded,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Stripe Status] Error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'Failed to check account status',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
