/**
 * Repository Transfer API Route
 *
 * Initiate a GitHub repository transfer for a transaction.
 * Only accessible by the seller of the transaction.
 *
 * POST /api/transactions/[id]/repository-transfer - Initiate transfer
 *
 * @example
 * POST /api/transactions/transaction123/repository-transfer
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

const componentName = 'RepositoryTransferAPI';

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
 * POST /api/transactions/[id]/repository-transfer (internal handler)
 *
 * Initiate repository transfer (seller only)
 * Access control: Only seller can initiate
 */
async function initiateRepositoryTransfer(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    console.log(`[${componentName}] Initiating repository transfer:`, {
      transactionId: id,
      userId: auth.user.id,
    });

    const transfer = await repositoryTransferService.initiateTransfer(auth.user.id, id);

    console.log(`[${componentName}] Repository transfer initiated:`, {
      transferId: transfer.id,
      transactionId: id,
    });

    return NextResponse.json({ transfer }, { status: 201 });
  } catch (error) {
    console.error(`[${componentName}] Error initiating repository transfer:`, error);

    if (error instanceof RepositoryTransferValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof RepositoryTransferPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof RepositoryTransferNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      {
        error: 'Failed to initiate repository transfer',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Export rate-limited handler
 *
 * POST: API rate limiting (100 requests / minute per user)
 */
export const POST = withApiRateLimit(initiateRepositoryTransfer, async (request) => {
  const auth = await authenticateApiRequest(request);
  return auth?.user.id || 'anonymous';
});
