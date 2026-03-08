/**
 * Review Reminder Cron Job
 *
 * Sends a review reminder email to buyers who completed a purchase but
 * haven't left a review yet. Targets transactions where the 7-day review
 * period ended 3–7 days ago — giving buyers time to use the code before
 * being prompted, while keeping a 4-day window to survive missed cron runs.
 *
 * GET /api/cron/review-reminders
 *
 * Schedule: Once per day (`0 10 * * *`)
 *
 * @example
 * GET /api/cron/review-reminders
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services';
import { env } from '@/config/env';

const componentName = 'ReviewReminderCron';

/** Days after escrow release before sending the reminder */
const REMINDER_DELAY_DAYS = 3;
/** Upper bound — don't remind if release was more than this many days ago */
const REMINDER_WINDOW_DAYS = 7;

/**
 * GET /api/cron/review-reminders
 *
 * Send review reminder emails to eligible buyers
 */
export async function GET() {
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const expectedAuth = `Bearer ${env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.error(`[${componentName}] Unauthorized request`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[${componentName}] Starting review reminder job`);

    const now = new Date();
    const windowStart = new Date(now.getTime() - REMINDER_WINDOW_DAYS * 86400000);
    const windowEnd = new Date(now.getTime() - REMINDER_DELAY_DAYS * 86400000);

    // Transactions where the 7-day review period ended 3–7 days ago
    // and no review has been submitted yet
    const transactions = await prisma.transaction.findMany({
      where: {
        paymentStatus: 'succeeded',
        escrowStatus: 'released',
        escrowReleaseDate: {
          gte: windowStart,
          lte: windowEnd,
        },
        review: null,
      },
      include: {
        buyer: {
          select: { email: true, fullName: true, username: true },
        },
        seller: {
          select: { fullName: true, username: true },
        },
        project: {
          select: { id: true, title: true },
        },
      },
      take: 100,
    });

    console.log(
      `[${componentName}] Found ${transactions.length} transactions eligible for review reminder`
    );

    let successCount = 0;
    let errorCount = 0;

    for (const transaction of transactions) {
      if (!transaction.buyer.email) {
        continue;
      }

      const buyerName =
        transaction.buyer.fullName ?? transaction.buyer.username ?? 'Buyer';
      const sellerName =
        transaction.seller.fullName ?? transaction.seller.username ?? 'Seller';

      try {
        await emailService.sendReviewReminder(
          { email: transaction.buyer.email, name: buyerName },
          {
            buyerName,
            sellerName,
            projectTitle: transaction.project.title,
            rating: 0,
            reviewUrl: `/transactions/${transaction.id}/review`,
          }
        );

        console.log(`[${componentName}] Reminder sent for transaction:`, transaction.id);
        successCount++;
      } catch (err) {
        console.error(
          `[${componentName}] Failed to send reminder for transaction:`,
          transaction.id,
          err
        );
        errorCount++;
      }
    }

    const result = {
      processed: transactions.length,
      successful: successCount,
      failed: errorCount,
      timestamp: now.toISOString(),
    };

    console.log(`[${componentName}] Job completed:`, result);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(`[${componentName}] Job failed:`, error);

    return NextResponse.json(
      {
        error: 'Review reminder job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
