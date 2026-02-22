/**
 * Early Release API Route
 *
 * Allows the seller to end the review period early, transferring repository
 * ownership and releasing escrow immediately.
 *
 * POST /api/transactions/[id]/early-release
 *
 * @example
 * POST /api/transactions/txn123/early-release
 * Headers: { "Authorization": "Bearer <firebase-token>" }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { withApiRateLimit } from '@/lib/middleware/withRateLimit';
import {
  RepositoryTransferService,
  RepositoryTransferValidationError,
  RepositoryTransferPermissionError,
  RepositoryTransferNotFoundError,
} from '@/lib/services/RepositoryTransferService';
import { RepositoryTransferRepository } from '@/lib/repositories/RepositoryTransferRepository';
import { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import { githubService } from '@/lib/services/GitHubService';
import { NotificationService } from '@/lib/services/NotificationService';
import { NotificationRepository } from '@/lib/repositories/NotificationRepository';

const componentName = 'EarlyReleaseAPI';

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

async function earlyRelease(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    console.log(`[${componentName}] Early release request:`, {
      transactionId: id,
      userId: auth.user.id,
    });

    const result = await repositoryTransferService.sellerEarlyRelease(id, auth.user.id);

    console.log(`[${componentName}] Early release result:`, {
      transactionId: id,
      ...result,
    });

    return NextResponse.json({ ...result, transactionId: id }, { status: 200 });
  } catch (error) {
    console.error(`[${componentName}] Error:`, error);

    if (error instanceof RepositoryTransferPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof RepositoryTransferNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof RepositoryTransferValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: 'Failed to process early release',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const POST = withApiRateLimit(earlyRelease, async (request) => {
  const auth = await authenticateApiRequest(request);
  return auth?.user.id || 'anonymous';
});
