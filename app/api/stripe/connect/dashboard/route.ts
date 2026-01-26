/**
 * Stripe Connect Dashboard API Route
 *
 * Generate login link for seller to access Stripe Express Dashboard.
 * Allows sellers to view payouts, update banking info, etc.
 *
 * POST /api/stripe/connect/dashboard
 *
 * @example
 * POST /api/stripe/connect/dashboard
 * Response: { url: "https://connect.stripe.com/express/..." }
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { stripeService } from '@/lib/services';

/**
 * POST /api/stripe/connect/dashboard
 *
 * Generate Stripe Express Dashboard login link for seller
 */
export async function POST() {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Stripe Dashboard] Creating login link for user:', session.user.id);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        stripeAccountId: true,
        isSeller: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.isSeller) {
      return NextResponse.json({ error: 'User is not a seller' }, { status: 403 });
    }

    if (!user.stripeAccountId) {
      return NextResponse.json(
        { error: 'No Stripe account found. Please complete onboarding first.' },
        { status: 400 }
      );
    }

    // Generate login link
    const loginUrl = await stripeService.createLoginLink(user.stripeAccountId);

    console.log('[Stripe Dashboard] Login link created');

    return NextResponse.json(
      {
        url: loginUrl,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Stripe Dashboard] Error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'Failed to create dashboard link',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
