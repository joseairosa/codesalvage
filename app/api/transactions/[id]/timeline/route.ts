/**
 * Transaction Timeline API Route
 *
 * Get timeline data for a transaction's progress stages.
 * Only accessible by the buyer or seller of the transaction.
 *
 * GET /api/transactions/[id]/timeline - Get timeline stages
 *
 * @example
 * GET /api/transactions/transaction123/timeline
 */

import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { withApiRateLimit } from '@/lib/middleware/withRateLimit';
import {
  RepositoryTransferService,
  RepositoryTransferPermissionError,
  RepositoryTransferNotFoundError,
} from '@/lib/services/RepositoryTransferService';
import { RepositoryTransferRepository } from '@/lib/repositories/RepositoryTransferRepository';
import { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import { githubService } from '@/lib/services/GitHubService';
import { NotificationService } from '@/lib/services/NotificationService';
import { NotificationRepository } from '@/lib/repositories/NotificationRepository';

const componentName = 'TransactionTimelineAPI';

// Initialize repositories and service
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
 * GET /api/transactions/[id]/timeline (internal handler)
 *
 * Get timeline data for a transaction
 * Access control: Only buyer or seller can view
 */
async function getTimeline(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    console.log(`[${componentName}] Fetching timeline:`, {
      transactionId: id,
      userId: auth.user.id,
    });

    const timeline = await repositoryTransferService.getTimelineData(id, auth.user.id);

    console.log(`[${componentName}] Timeline fetched:`, {
      transactionId: id,
      stages: timeline.length,
    });

    return NextResponse.json(timeline, { status: 200 });
  } catch (error) {
    console.error(`[${componentName}] Error fetching timeline:`, error);

    if (error instanceof RepositoryTransferNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof RepositoryTransferPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch timeline',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Export rate-limited handler
 *
 * GET: API rate limiting (100 requests / minute per user)
 */
export const GET = withApiRateLimit(getTimeline, async (request) => {
  const auth = await authenticateApiRequest(request);
  return auth?.user.id || 'anonymous';
});
