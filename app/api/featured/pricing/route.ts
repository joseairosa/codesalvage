/**
 * Featured Listing Pricing API Route
 *
 * GET /api/featured/pricing - Get featured placement pricing tiers
 *
 * @example
 * GET /api/featured/pricing
 * Response: [
 *   { durationDays: 7, costCents: 2999, costFormatted: "$29.99" },
 *   { durationDays: 14, costCents: 4999, costFormatted: "$49.99" },
 *   { durationDays: 30, costCents: 7999, costFormatted: "$79.99" }
 * ]
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FeaturedListingService } from '@/lib/services/FeaturedListingService';
import { FeaturedListingRepository } from '@/lib/repositories/FeaturedListingRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { SubscriptionRepository } from '@/lib/repositories/SubscriptionRepository';
import { SubscriptionService } from '@/lib/services/SubscriptionService';

const componentName = 'FeaturedPricingAPI';

// Initialize repositories and service
const featuredListingRepository = new FeaturedListingRepository(prisma);
const projectRepository = new ProjectRepository(prisma);
const userRepository = new UserRepository(prisma);
const subscriptionRepository = new SubscriptionRepository(prisma);
const subscriptionService = new SubscriptionService(subscriptionRepository, userRepository);
const featuredListingService = new FeaturedListingService(
  featuredListingRepository,
  projectRepository,
  userRepository,
  subscriptionService
);

/**
 * GET /api/featured/pricing
 *
 * Get featured placement pricing tiers (public endpoint)
 */
export async function GET() {
  try {
    console.log(`[${componentName}] Fetching featured pricing tiers`);

    const pricing = featuredListingService.getFeaturedPricing();

    console.log(`[${componentName}] Returned ${pricing.length} pricing tiers`);

    return NextResponse.json({ pricing }, { status: 200 });
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
