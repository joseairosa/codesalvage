/**
 * Create Payment Intent API Route
 *
 * Creates a Stripe Payment Intent and Transaction record for project purchase.
 *
 * POST /api/checkout/create-intent
 * Body: { projectId: string }
 *
 * @example
 * POST /api/checkout/create-intent
 * { "projectId": "project123" }
 * Response: { clientSecret: "pi_...", transactionId: "..." }
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { stripeService } from '@/lib/services';
import { calculatePaymentBreakdown, calculateEscrowReleaseDate } from '@/lib/stripe';
import { z } from 'zod';

const createIntentSchema = z.object({
  projectId: z.string(),
});

/**
 * POST /api/checkout/create-intent
 *
 * Create Payment Intent for project purchase
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createIntentSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validatedData.error.errors,
        },
        { status: 400 }
      );
    }

    const { projectId } = validatedData.data;

    console.log('[Create Intent] Creating payment intent:', {
      projectId,
      buyerId: session.user.id,
    });

    // Get project with seller info
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        seller: {
          select: {
            id: true,
            email: true,
            fullName: true,
            stripeAccountId: true,
            isVerifiedSeller: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if project is available for purchase
    if (project.status !== 'active') {
      return NextResponse.json(
        { error: 'Project is not available for purchase' },
        { status: 400 }
      );
    }

    // Check if buyer is not the seller
    if (project.sellerId === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot purchase your own project' },
        { status: 400 }
      );
    }

    // Check if seller has completed Stripe onboarding
    if (!project.seller.stripeAccountId || !project.seller.isVerifiedSeller) {
      return NextResponse.json(
        { error: 'Seller has not completed payment setup' },
        { status: 400 }
      );
    }

    // Calculate payment breakdown
    const breakdown = calculatePaymentBreakdown(project.priceCents);
    const escrowReleaseDate = calculateEscrowReleaseDate();

    console.log('[Create Intent] Payment breakdown:', breakdown);

    // Create transaction record
    const transaction = await prisma.transaction.create({
      data: {
        projectId: project.id,
        sellerId: project.sellerId,
        buyerId: session.user.id,
        amountCents: breakdown.total,
        commissionCents: breakdown.platformFee,
        sellerReceivesCents: breakdown.sellerReceives,
        paymentStatus: 'pending',
        escrowStatus: 'pending',
        escrowReleaseDate,
        codeDeliveryStatus: 'pending',
      },
    });

    console.log('[Create Intent] Transaction created:', transaction.id);

    // Create Stripe Payment Intent
    const paymentIntent = await stripeService.createPaymentIntent(project.priceCents, {
      projectId: project.id,
      sellerId: project.sellerId,
      buyerId: session.user.id,
      transactionId: transaction.id,
    });

    // Update transaction with payment intent ID
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        stripePaymentIntentId: paymentIntent.id,
      },
    });

    console.log('[Create Intent] Payment intent created:', paymentIntent.id);

    return NextResponse.json(
      {
        clientSecret: paymentIntent.client_secret,
        transactionId: transaction.id,
        amount: breakdown.total,
        breakdown,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Create Intent] Error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'Failed to create payment intent',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
