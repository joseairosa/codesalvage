/**
 * Subscription Pricing API Route
 *
 * Returns pricing information for all subscription plans.
 * Public endpoint - no authentication required.
 *
 * GET /api/subscriptions/pricing - Get pricing tiers
 *
 * @example
 * GET /api/subscriptions/pricing
 */

import { type NextRequest, NextResponse } from 'next/server';
import { withPublicRateLimit } from '@/lib/middleware/withRateLimit';
import { prisma } from '@/lib/prisma';
import { SubscriptionService } from '@/lib/services/SubscriptionService';
import { SubscriptionRepository } from '@/lib/repositories/SubscriptionRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { getOrSetCache, CacheKeys, CacheTTL } from '@/lib/utils/cache';

const componentName = 'SubscriptionPricingAPI';

// Initialize repositories and service
const subscriptionRepository = new SubscriptionRepository(prisma);
const userRepository = new UserRepository(prisma);
const subscriptionService = new SubscriptionService(
  subscriptionRepository,
  userRepository
);

/**
 * GET /api/subscriptions/pricing
 *
 * Get pricing information for all subscription plans (public endpoint)
 * Cached for 1 hour (pricing changes rarely)
 */
async function getPricing(_request: NextRequest) {
  try {
    console.log(`[${componentName}] Fetching subscription pricing`);

    // Get cached pricing or fetch fresh data
    const pricing = await getOrSetCache(
      CacheKeys.subscriptionPricing(),
      CacheTTL.LONG,
      async () => {
        return subscriptionService.getPricing();
      }
    );

    console.log(`[${componentName}] Pricing fetched successfully`);

    return NextResponse.json(
      {
        pricing,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error fetching pricing:`, error);

    return NextResponse.json(
      {
        error: 'Failed to fetch pricing',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withPublicRateLimit(getPricing);
