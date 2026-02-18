/**
 * Process Transfers Cron Job
 *
 * Automated job that processes pending GitHub ownership transfers.
 * Finds transactions past their 7-day review period and initiates
 * GitHub ownership transfer + escrow release.
 *
 * GET /api/cron/process-transfers
 *
 * Schedule: Every hour (configured in Railway)
 *
 * @example
 * GET /api/cron/process-transfers
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { RepositoryTransferService } from '@/lib/services/RepositoryTransferService';
import { RepositoryTransferRepository } from '@/lib/repositories/RepositoryTransferRepository';
import { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import { githubService } from '@/lib/services/GitHubService';
import { NotificationService } from '@/lib/services/NotificationService';
import { NotificationRepository } from '@/lib/repositories/NotificationRepository';

const componentName = 'ProcessTransfersCron';

const repositoryTransferRepository = new RepositoryTransferRepository(prisma);
const transactionRepository = new TransactionRepository(prisma);
const notificationRepository = new NotificationRepository(prisma);
const notificationService = new NotificationService(notificationRepository);
const repositoryTransferService = new RepositoryTransferService(
  repositoryTransferRepository,
  transactionRepository,
  githubService,
  notificationService
);

/**
 * GET /api/cron/process-transfers
 *
 * Process pending ownership transfers for GitHub-linked transactions.
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

    console.log(`[${componentName}] Starting process-transfers job`);

    const result = await repositoryTransferService.processAutoTransfers();

    console.log(`[${componentName}] Job completed:`, result);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(`[${componentName}] Job failed:`, error);

    return NextResponse.json(
      {
        error: 'Process transfers job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
