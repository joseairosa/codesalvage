/**
 * Create Featured Listing Payment Intent API Route
 *
 * Creates a Stripe Payment Intent for purchasing featured placement.
 * Does NOT immediately set featured status - waits for webhook confirmation.
 *
 * POST /api/featured/create-payment-intent
 *
 * @example
 * POST /api/featured/create-payment-intent
 * Body: { projectId: "project123", durationDays: 7 }
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { stripe } from '@/lib/stripe';
import { z } from 'zod';
import {
  FeaturedListingService,
  FeaturedListingValidationError,
  FeaturedListingPermissionError,
  FeaturedListingNotFoundError,
} from '@/lib/services/FeaturedListingService';
import { FeaturedListingRepository } from '@/lib/repositories/FeaturedListingRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { SubscriptionRepository } from '@/lib/repositories/SubscriptionRepository';
import { SubscriptionService } from '@/lib/services/SubscriptionService';
import { prisma } from '@/lib/prisma';

const componentName = 'FeaturedPaymentIntentAPI';

// Initialize repositories and service
const featuredListingRepository = new FeaturedListingRepository(prisma);
const projectRepository = new ProjectRepository(prisma);
const userRepository = new UserRepository(prisma);
const subscriptionRepository = new SubscriptionRepository(prisma);
const subscriptionService = new SubscriptionService(
  subscriptionRepository,
  userRepository
);
const featuredListingService = new FeaturedListingService(
  featuredListingRepository,
  projectRepository,
  userRepository,
  subscriptionService
);

// Validation schema
const createPaymentIntentSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  durationDays: z
    .number()
    .int()
    .refine((val) => [7, 14, 30].includes(val), {
      message: 'Duration must be 7, 14, or 30 days',
    }),
});

/**
 * POST /api/featured/create-payment-intent
 *
 * Create a Stripe Payment Intent for featured listing purchase
 *
 * Business rules:
 * - User must be authenticated and a seller
 * - User must own the project
 * - Project must be active
 * - Duration must be 7, 14, or 30 days
 * - Payment Intent metadata tracks featured listing purchase details
 *
 * Flow:
 * 1. Validate seller and project ownership
 * 2. Calculate cost based on duration
 * 3. Create Stripe Payment Intent with metadata
 * 4. Return client secret for Stripe Elements
 * 5. Webhook handles payment confirmation and sets featured status
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate request body
    const validatedData = createPaymentIntentSchema.safeParse(body);
    if (!validatedData.success) {
      const firstError = validatedData.error.errors[0];
      return NextResponse.json(
        {
          error: 'Validation failed',
          message: firstError?.message || 'Invalid request data',
          field: firstError?.path[0],
        },
        { status: 400 }
      );
    }

    const { projectId, durationDays } = validatedData.data;

    console.log(`[${componentName}] Creating payment intent for featured listing:`, {
      sellerId: session.user.id,
      projectId,
      durationDays,
    });

    // Validate seller, project ownership, and business rules
    // This throws appropriate errors if validation fails
    const user = await userRepository.findById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.isSeller) {
      return NextResponse.json(
        { error: 'Only sellers can purchase featured placements' },
        { status: 403 }
      );
    }

    const project = await projectRepository.findById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.sellerId !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only feature your own projects' },
        { status: 403 }
      );
    }

    if (project.status !== 'active') {
      return NextResponse.json(
        { error: 'Only active projects can be featured' },
        { status: 400 }
      );
    }

    // Get pricing for duration
    const pricing = featuredListingService.getFeaturedPricing();
    const pricingTier = pricing.find((p) => p.durationDays === durationDays);

    if (!pricingTier) {
      return NextResponse.json({ error: 'Invalid duration selected' }, { status: 400 });
    }

    console.log(`[${componentName}] Pricing tier selected:`, {
      durationDays: pricingTier.durationDays,
      costCents: pricingTier.costCents,
    });

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: pricingTier.costCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        // Mark this as a featured listing purchase (not a transaction)
        featuredListingPurchase: 'true',
        projectId,
        sellerId: session.user.id,
        durationDays: durationDays.toString(),
        costCents: pricingTier.costCents.toString(),
      },
    });

    console.log(`[${componentName}] Payment Intent created:`, {
      paymentIntentId: paymentIntent.id,
      amount: pricingTier.costCents,
    });

    return NextResponse.json(
      {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: pricingTier.costCents,
        durationDays,
        projectId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error creating payment intent:`, error);

    // Map service errors to appropriate HTTP status codes
    if (error instanceof FeaturedListingValidationError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 400 }
      );
    }

    if (error instanceof FeaturedListingPermissionError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 403 }
      );
    }

    if (error instanceof FeaturedListingNotFoundError) {
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
