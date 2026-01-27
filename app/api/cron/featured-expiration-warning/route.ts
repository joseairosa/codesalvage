/**
 * Featured Listings Expiration Warning Cron Job
 *
 * Automated job that sends warning emails to sellers 3 days before
 * their featured listings expire.
 *
 * GET /api/cron/featured-expiration-warning
 *
 * Should be called via cron (Railway Cron, Vercel Cron, or external service):
 * Schedule: Every 12 hours (cron: 0 *\/12 * * *)
 *
 * @example
 * GET /api/cron/featured-expiration-warning
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { emailService } from '@/lib/services';
import { UserRepository } from '@/lib/repositories/UserRepository';

const componentName = 'FeaturedExpirationWarningCron';

// Initialize repository
const userRepository = new UserRepository(prisma);

/**
 * GET /api/cron/featured-expiration-warning
 *
 * Send expiration warning emails for featured projects expiring in 3 days
 */
export async function GET() {
  try {
    // Verify cron secret (security)
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const expectedAuth = `Bearer ${env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.error(`[${componentName}] Unauthorized request`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[${componentName}] Starting expiration warning job`);

    const now = new Date();

    // Calculate 3 days from now (with 12-hour window for cron job flexibility)
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    threeDaysFromNow.setHours(23, 59, 59, 999); // End of day

    const twoDaysAndHalfFromNow = new Date(now);
    twoDaysAndHalfFromNow.setDate(twoDaysAndHalfFromNow.getDate() + 2);
    twoDaysAndHalfFromNow.setHours(12, 0, 0, 0); // Start of window

    // Find projects expiring in approximately 3 days
    const expiringProjects = await prisma.project.findMany({
      where: {
        isFeatured: true,
        featuredUntil: {
          gte: twoDaysAndHalfFromNow,
          lte: threeDaysFromNow,
        },
        status: 'active',
      },
      select: {
        id: true,
        title: true,
        sellerId: true,
        featuredUntil: true,
      },
    });

    console.log(
      `[${componentName}] Found ${expiringProjects.length} projects expiring soon`
    );

    let emailsSent = 0;
    let emailsFailed = 0;

    if (expiringProjects.length > 0) {
      const appUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3011';

      for (const project of expiringProjects) {
        try {
          // Fetch seller details
          const seller = await userRepository.findById(project.sellerId);

          if (!seller || !seller.email) {
            console.warn(
              `[${componentName}] Seller not found or no email:`,
              project.sellerId
            );
            emailsFailed++;
            continue;
          }

          // Send expiration warning email
          await emailService.sendFeaturedListingExpirationWarning(
            {
              email: seller.email,
              name: seller.fullName || seller.username,
            },
            {
              sellerName: seller.fullName || seller.username,
              projectTitle: project.title,
              projectId: project.id,
              durationDays: 0, // Don't have original duration
              costCents: 0, // Don't have original cost
              featuredUntil: project.featuredUntil?.toISOString() || '',
              projectUrl: `${appUrl}/projects/${project.id}`,
            }
          );

          emailsSent++;
          console.log(`[${componentName}] Expiration warning sent:`, {
            projectId: project.id,
            sellerId: seller.id,
            featuredUntil: project.featuredUntil,
          });
        } catch (emailError) {
          console.error(`[${componentName}] Failed to send warning email:`, {
            projectId: project.id,
            error: emailError instanceof Error ? emailError.message : 'Unknown error',
          });
          emailsFailed++;
        }
      }

      console.log(
        `[${componentName}] Expiration warnings: ${emailsSent} sent, ${emailsFailed} failed`
      );
    }

    const result = {
      projectsExpiringSoon: expiringProjects.length,
      emailsSent,
      emailsFailed,
      expiringProjects: expiringProjects.map((p) => ({
        id: p.id,
        title: p.title,
        sellerId: p.sellerId,
        featuredUntil: p.featuredUntil,
      })),
      timestamp: now.toISOString(),
    };

    console.log(`[${componentName}] Job completed:`, {
      projectsExpiringSoon: result.projectsExpiringSoon,
      emailsSent: result.emailsSent,
      emailsFailed: result.emailsFailed,
      timestamp: result.timestamp,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(`[${componentName}] Job failed:`, error);

    return NextResponse.json(
      {
        error: 'Featured expiration warning job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
