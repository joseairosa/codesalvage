/**
 * Weekly Payout Processing Cron Job
 *
 * Processes all pending PayoutRequests via PayPal Payouts API.
 *
 * GET /api/cron/process-payouts
 *
 * Schedule: Every Friday at 12:00 UTC (20:00 HKT)
 * Cron expression: 0 12 * * 5
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services';
import { env } from '@/config/env';
import { SellerPayoutDetailsRepository } from '@/lib/repositories/SellerPayoutDetailsRepository';
import { PayoutRequestRepository } from '@/lib/repositories/PayoutRequestRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import { PayoutService } from '@/lib/services/PayoutService';

const componentName = 'ProcessPayoutsCron';

const payoutDetailsRepo = new SellerPayoutDetailsRepository(prisma);
const payoutRequestRepo = new PayoutRequestRepository(prisma);
const userRepository = new UserRepository(prisma);
const transactionRepository = new TransactionRepository(prisma);
const payoutService = new PayoutService(
  payoutDetailsRepo,
  payoutRequestRepo,
  userRepository,
  transactionRepository,
  emailService
);

/**
 * GET /api/cron/process-payouts
 *
 * Process pending payout requests via PayPal Payouts API
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

    console.log(`[${componentName}] Starting weekly payout processing`);

    const result = await payoutService.processBatch();

    console.log(`[${componentName}] Payout processing complete:`, result);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(`[${componentName}] Payout processing failed:`, error);

    return NextResponse.json(
      {
        error: 'Payout processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
