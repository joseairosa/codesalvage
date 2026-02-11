/**
 * Confirm Transfer API Route
 *
 * Confirm that the buyer has received repository access.
 * Only accessible by the buyer of the transaction.
 *
 * POST /api/transactions/[id]/confirm-transfer - Confirm transfer
 *
 * @example
 * POST /api/transactions/transaction123/confirm-transfer
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

const componentName = 'ConfirmTransferAPI';

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
 * POST /api/transactions/[id]/confirm-transfer (internal handler)
 *
 * Confirm repository transfer (buyer only)
 * Access control: Only buyer can confirm
 */
async function confirmTransfer(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    console.log(`[${componentName}] Confirming transfer:`, {
      transactionId: id,
      userId: auth.user.id,
    });

    const transfer = await repositoryTransferService.confirmTransfer(auth.user.id, id);

    console.log(`[${componentName}] Transfer confirmed:`, {
      transferId: transfer.id,
      transactionId: id,
    });

    return NextResponse.json({ transfer }, { status: 200 });
  } catch (error) {
    console.error(`[${componentName}] Error confirming transfer:`, error);

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
        error: 'Failed to confirm transfer',
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
export const POST = withApiRateLimit(confirmTransfer, async (request) => {
  const auth = await authenticateApiRequest(request);
  return auth?.user.id || 'anonymous';
});
