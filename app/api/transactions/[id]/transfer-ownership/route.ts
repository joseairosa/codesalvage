/**
 * Transfer Ownership API Route
 *
 * Allows the seller to initiate GitHub repository ownership transfer.
 * Caller must be the seller of the transaction.
 *
 * Early transfer (before review period ends): transfers ownership but holds escrow.
 * Post-review transfer (after review period): transfers ownership and releases escrow.
 *
 * POST /api/transactions/[id]/transfer-ownership
 *
 * @example
 * POST /api/transactions/txn123/transfer-ownership
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

const componentName = 'TransferOwnershipAPI';

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
 * POST /api/transactions/[id]/transfer-ownership (internal handler)
 *
 * Initiate ownership transfer (seller only).
 * Seller identity is verified inside the service via callerSellerId.
 */
async function transferOwnership(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    console.log(`[${componentName}] Transfer ownership request:`, {
      transactionId: id,
      userId: auth.user.id,
    });

    const result = await repositoryTransferService.transferOwnership(id, auth.user.id);

    console.log(`[${componentName}] Transfer ownership result:`, {
      transactionId: id,
      ...result,
    });

    return NextResponse.json({ ...result, transactionId: id }, { status: 200 });
  } catch (error) {
    console.error(`[${componentName}] Error transferring ownership:`, error);

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
        error: 'Failed to transfer ownership',
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
export const POST = withApiRateLimit(transferOwnership, async (request) => {
  const auth = await authenticateApiRequest(request);
  return auth?.user.id || 'anonymous';
});
