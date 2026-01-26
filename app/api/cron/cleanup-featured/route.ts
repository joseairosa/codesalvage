/**
 * Featured Listings Cleanup Cron Job
 *
 * Automated job that runs periodically to unfeature expired projects.
 * Sets isFeatured=false for projects where featuredUntil <= now.
 *
 * GET /api/cron/cleanup-featured
 *
 * Should be called via cron (Railway Cron, Vercel Cron, or external service):
 * Schedule: Every 1 hour (0 * * * *)
 *
 * @example
 * GET /api/cron/cleanup-featured
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { FeaturedListingRepository } from '@/lib/repositories/FeaturedListingRepository';
import { FeaturedListingService } from '@/lib/services/FeaturedListingService';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { SubscriptionRepository } from '@/lib/repositories/SubscriptionRepository';
import { SubscriptionService } from '@/lib/services/SubscriptionService';
import { emailService } from '@/lib/services';

const componentName = 'FeaturedCleanupCron';

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
 * GET /api/cron/cleanup-featured
 *
 * Cleanup expired featured projects
 */
export async function GET() {
  try {
    // Verify cron secret (security)
    const authHeader = headers().get('authorization');
    const expectedAuth = `Bearer ${env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.error(`[${componentName}] Unauthorized request`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[${componentName}] Starting featured listings cleanup job`);

    const now = new Date();

    // Get expired featured projects before cleanup (for logging)
    const expiredProjects = await featuredListingRepository.getExpiredFeaturedProjects();

    console.log(`[${componentName}] Found ${expiredProjects.length} expired featured projects`);

    // Cleanup expired featured projects
    const unfeaturedCount = await featuredListingService.cleanupExpiredFeatured();

    console.log(`[${componentName}] Unfeatured ${unfeaturedCount} projects`);

    // Send expired notification emails
    let emailsSent = 0;
    let emailsFailed = 0;

    if (expiredProjects.length > 0) {
      const appUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3011';

      for (const project of expiredProjects) {
        try {
          // Fetch seller details
          const seller = await userRepository.findById(project.sellerId);

          if (!seller || !seller.email) {
            console.warn(`[${componentName}] Seller not found or no email:`, project.sellerId);
            emailsFailed++;
            continue;
          }

          // Send expired notification email
          await emailService.sendFeaturedListingExpired(
            {
              email: seller.email,
              name: seller.fullName || seller.username,
            },
            {
              sellerName: seller.fullName || seller.username,
              projectTitle: project.title,
              projectId: project.id,
              durationDays: 0, // Don't have original duration, use 0
              costCents: 0, // Don't have original cost, use 0
              featuredUntil: project.featuredUntil?.toISOString() || '',
              projectUrl: `${appUrl}/projects/${project.id}`,
            }
          );

          emailsSent++;
          console.log(`[${componentName}] Expired notification sent:`, {
            projectId: project.id,
            sellerId: seller.id,
          });
        } catch (emailError) {
          console.error(`[${componentName}] Failed to send expired email:`, {
            projectId: project.id,
            error: emailError instanceof Error ? emailError.message : 'Unknown error',
          });
          emailsFailed++;
        }
      }

      console.log(`[${componentName}] Expired notifications: ${emailsSent} sent, ${emailsFailed} failed`);

      // Log project details
      const projectDetails = expiredProjects.map((p) => ({
        id: p.id,
        title: p.title,
        featuredUntil: p.featuredUntil,
      }));

      console.log(
        `[${componentName}] Unfeatured projects:`,
        JSON.stringify(projectDetails, null, 2)
      );
    }

    const result = {
      unfeaturedCount,
      emailsSent,
      emailsFailed,
      expiredProjects: expiredProjects.map((p) => ({
        id: p.id,
        title: p.title,
        sellerId: p.sellerId,
        featuredUntil: p.featuredUntil,
      })),
      timestamp: now.toISOString(),
    };

    console.log(`[${componentName}] Job completed:`, {
      unfeaturedCount: result.unfeaturedCount,
      emailsSent: result.emailsSent,
      emailsFailed: result.emailsFailed,
      timestamp: result.timestamp,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(`[${componentName}] Job failed:`, error);

    return NextResponse.json(
      {
        error: 'Featured listings cleanup job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
