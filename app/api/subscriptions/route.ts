/**
 * Subscriptions API Route
 *
 * Handles Premium Seller subscription operations.
 *
 * GET /api/subscriptions - Get current subscription status
 * POST /api/subscriptions - Create new subscription
 *
 * @example
 * GET /api/subscriptions
 * POST /api/subscriptions { plan: 'pro', paymentMethodId: 'pm_xxx' }
 */

import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import {
  SubscriptionService,
  SubscriptionValidationError,
  SubscriptionPermissionError,
  SubscriptionNotFoundError,
} from '@/lib/services/SubscriptionService';
import { SubscriptionRepository } from '@/lib/repositories/SubscriptionRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { getOrSetCache, CacheKeys, CacheTTL, invalidateCache } from '@/lib/utils/cache';
import { z } from 'zod';

const componentName = 'SubscriptionsAPI';

const subscriptionRepository = new SubscriptionRepository(prisma);
const userRepository = new UserRepository(prisma);
const subscriptionService = new SubscriptionService(
  subscriptionRepository,
  userRepository
);

const createSubscriptionSchema = z.object({
  plan: z.enum(['pro']),
  paymentMethodId: z.string().optional(),
});

/**
 * GET /api/subscriptions
 *
 * Get current subscription status for authenticated user
 */
export async function GET(request: Request) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[${componentName}] Fetching subscription status:`, auth.user.id);

    const status = await getOrSetCache(
      CacheKeys.userSubscription(auth.user.id),
      CacheTTL.SUBSCRIPTION,
      () => subscriptionService.getSubscriptionStatus(auth.user.id)
    );

    console.log(`[${componentName}] Subscription status:`, {
      plan: status.plan,
      subscriptionStatus: status.status,
    });

    return NextResponse.json(
      {
        subscription: status,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error fetching subscription status:`, error);

    return NextResponse.json(
      {
        error: 'Failed to fetch subscription status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/subscriptions
 *
 * Create a new subscription for authenticated user
 */
export async function POST(request: Request) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createSubscriptionSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validatedData.error.errors,
        },
        { status: 400 }
      );
    }

    const { plan, paymentMethodId } = validatedData.data;

    console.log(`[${componentName}] Creating subscription:`, {
      userId: auth.user.id,
      plan,
    });

    const subscriptionRequest: any = { plan };
    if (paymentMethodId !== undefined) {
      subscriptionRequest.paymentMethodId = paymentMethodId;
    }

    const result = await subscriptionService.createSubscription(
      auth.user.id,
      subscriptionRequest
    );

    await invalidateCache.user(auth.user.id);

    console.log(`[${componentName}] Subscription created:`, result.subscriptionId);

    return NextResponse.json(
      {
        subscription: result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error creating subscription:`, error);

    if (error instanceof SubscriptionValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          field: error.field,
        },
        { status: 400 }
      );
    }

    if (error instanceof SubscriptionPermissionError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 403 }
      );
    }

    if (error instanceof SubscriptionNotFoundError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to create subscription',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/subscriptions
 *
 * Cancel subscription at end of billing period
 */
export async function DELETE(request: Request) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[${componentName}] Canceling subscription:`, auth.user.id);

    const result = await subscriptionService.cancelSubscription(auth.user.id);

    await invalidateCache.user(auth.user.id);

    console.log(`[${componentName}] Subscription canceled:`, result.subscriptionId);

    return NextResponse.json(
      {
        subscription: result,
        message: 'Subscription will be canceled at the end of the billing period',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error canceling subscription:`, error);

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
        error: 'Failed to cancel subscription',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
