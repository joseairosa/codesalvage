/**
 * Create Payment Intent API Route
 *
 * Creates a Stripe Payment Intent and transaction record for purchasing a project.
 *
 * POST /api/transactions/create-payment-intent - Create payment intent
 *
 * @example
 * POST /api/transactions/create-payment-intent
 * Body: { projectId: "project123" }
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import {
  TransactionService,
  TransactionValidationError,
  TransactionPermissionError,
  TransactionNotFoundError,
} from '@/lib/services/TransactionService';
import { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';

const componentName = 'CreatePaymentIntentAPI';

// Initialize repositories and service
const transactionRepository = new TransactionRepository(prisma);
const userRepository = new UserRepository(prisma);
const projectRepository = new ProjectRepository(prisma);
const transactionService = new TransactionService(
  transactionRepository,
  userRepository,
  projectRepository
);

/**
 * POST /api/transactions/create-payment-intent
 *
 * Create a Stripe Payment Intent for purchasing a project
 * Creates transaction record first, then Payment Intent
 *
 * Business rules:
 * - User must be authenticated
 * - Project must exist and be active
 * - Buyer cannot purchase own project
 * - No duplicate purchases allowed
 * - 18% platform commission applied
 * - 7-day escrow period set
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required', field: 'projectId' },
        { status: 400 }
      );
    }

    console.log(`[${componentName}] Creating payment intent:`, {
      buyerId: session.user.id,
      projectId,
    });

    // Create transaction via TransactionService (validates business rules)
    const transaction = await transactionService.createTransaction(session.user.id, {
      projectId,
    });

    console.log(`[${componentName}] Transaction created:`, transaction.id);

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: transaction.amountCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        transactionId: transaction.id,
        projectId: transaction.projectId,
        sellerId: transaction.sellerId,
        buyerId: transaction.buyerId,
        commissionCents: transaction.commissionCents.toString(),
        sellerReceivesCents: transaction.sellerReceivesCents.toString(),
      },
    });

    console.log(`[${componentName}] Payment Intent created:`, paymentIntent.id);

    // Update transaction with Stripe Payment Intent ID and status
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        paymentStatus: 'pending',
        stripePaymentIntentId: paymentIntent.id,
      },
    });

    console.log(
      `[${componentName}] Transaction updated with Payment Intent ID:`,
      transaction.id
    );

    return NextResponse.json(
      {
        clientSecret: paymentIntent.client_secret,
        transactionId: transaction.id,
        amount: transaction.amountCents,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error creating payment intent:`, error);

    // Map service errors to appropriate HTTP status codes
    if (error instanceof TransactionValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          field: error.field,
        },
        { status: 400 }
      );
    }

    if (error instanceof TransactionPermissionError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 403 }
      );
    }

    if (error instanceof TransactionNotFoundError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 404 }
      );
    }

    // Stripe errors
    if (error && typeof error === 'object' && 'type' in error) {
      const stripeError = error as any;
      if (stripeError.type === 'StripeCardError') {
        return NextResponse.json(
          {
            error: 'Card was declined',
            message: stripeError.message,
          },
          { status: 400 }
        );
      }
      if (stripeError.type === 'StripeInvalidRequestError') {
        return NextResponse.json(
          {
            error: 'Invalid payment request',
            message: stripeError.message,
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to create payment intent',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
