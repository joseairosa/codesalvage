/**
 * Stripe Connect Onboarding API Route
 *
 * Handles seller onboarding to Stripe Connect.
 * Creates Connect account and generates onboarding link.
 *
 * POST /api/stripe/connect/onboard
 *
 * @example
 * POST /api/stripe/connect/onboard
 * Response: { url: "https://connect.stripe.com/..." }
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { stripeService } from '@/lib/services';
import { env } from '@/config/env';

/**
 * POST /api/stripe/connect/onboard
 *
 * Create or retrieve Stripe Connect account and generate onboarding link
 */
export async function POST() {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Stripe Onboard] Creating onboarding link for user:', session.user.id);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        stripeAccountId: true,
        isSeller: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.email) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 });
    }

    let accountId = user.stripeAccountId;

    // Create Connect account if doesn't exist
    if (!accountId) {
      console.log('[Stripe Onboard] Creating new Connect account');

      accountId = await stripeService.createConnectAccount({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      });

      // Save account ID to database
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeAccountId: accountId,
          isSeller: true, // Enable seller mode when they start onboarding
        },
      });

      console.log('[Stripe Onboard] Stripe account ID saved to database');
    } else {
      console.log('[Stripe Onboard] Using existing Connect account:', accountId);
    }

    // Generate account link for onboarding
    const baseUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3011';
    const returnUrl = `${baseUrl}/seller/dashboard`;
    const refreshUrl = `${baseUrl}/seller/onboard`;

    const onboardingUrl = await stripeService.createAccountLink(
      accountId,
      returnUrl,
      refreshUrl
    );

    console.log('[Stripe Onboard] Onboarding link created');

    return NextResponse.json(
      {
        url: onboardingUrl,
        accountId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Stripe Onboard] Error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'Failed to create onboarding link',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
