/**
 * Stripe Customer Portal API Route
 *
 * Creates a Stripe Customer Portal session for subscription management.
 * Users can manage their subscription, payment methods, and view invoices.
 *
 * POST /api/subscriptions/portal - Create portal session
 *
 * @example
 * POST /api/subscriptions/portal { returnUrl: 'https://app.com/settings' }
 */

import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import {
  SubscriptionService,
  SubscriptionValidationError,
  SubscriptionNotFoundError,
} from '@/lib/services/SubscriptionService';
import { SubscriptionRepository } from '@/lib/repositories/SubscriptionRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { z } from 'zod';
import { env } from '@/config/env';

const componentName = 'SubscriptionPortalAPI';

// Initialize repositories and service
const subscriptionRepository = new SubscriptionRepository(prisma);
const userRepository = new UserRepository(prisma);
const subscriptionService = new SubscriptionService(
  subscriptionRepository,
  userRepository
);

const createPortalSessionSchema = z.object({
  returnUrl: z.string().url().optional(),
});

/**
 * POST /api/subscriptions/portal
 *
 * Create Stripe Customer Portal session for subscription management
 */
export async function POST(request: Request) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createPortalSessionSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validatedData.error.errors,
        },
        { status: 400 }
      );
    }

    // Use provided returnUrl or default to settings page
    const returnUrl =
      validatedData.data.returnUrl ||
      `${env.NEXT_PUBLIC_APP_URL || 'http://localhost:3011'}/settings/subscription`;

    console.log(`[${componentName}] Creating portal session:`, {
      userId: auth.user.id,
      returnUrl,
    });

    const portalUrl = await subscriptionService.createPortalSession(
      auth.user.id,
      returnUrl
    );

    console.log(`[${componentName}] Portal session created`);

    return NextResponse.json(
      {
        url: portalUrl,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error creating portal session:`, error);

    // Map service errors to appropriate HTTP status codes
    if (error instanceof SubscriptionNotFoundError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 404 }
      );
    }

    if (error instanceof SubscriptionValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          field: error.field,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to create portal session',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
