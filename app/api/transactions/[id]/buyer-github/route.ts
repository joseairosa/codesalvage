/**
 * Buyer GitHub Username API Route
 *
 * Set the buyer's GitHub username for a repository transfer.
 * Only accessible by the buyer of the transaction.
 *
 * PUT /api/transactions/[id]/buyer-github - Set buyer GitHub username
 *
 * @example
 * PUT /api/transactions/transaction123/buyer-github
 * Body: { "username": "octocat" }
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

const componentName = 'BuyerGithubAPI';

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
 * PUT /api/transactions/[id]/buyer-github (internal handler)
 *
 * Set buyer GitHub username (buyer only)
 * Access control: Only buyer can set their username
 */
async function setBuyerGithubUsername(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Parse and validate request body
    let body: { username?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { username } = body;

    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return NextResponse.json(
        { error: 'A non-empty GitHub username is required', field: 'username' },
        { status: 400 }
      );
    }

    console.log(`[${componentName}] Setting buyer GitHub username:`, {
      transactionId: id,
      userId: auth.user.id,
      username: username.trim(),
    });

    const transfer = await repositoryTransferService.setBuyerGithubUsername(
      auth.user.id,
      id,
      username.trim()
    );

    console.log(`[${componentName}] Buyer GitHub username set:`, {
      transferId: transfer.id,
      transactionId: id,
    });

    return NextResponse.json({ transfer }, { status: 200 });
  } catch (error) {
    console.error(`[${componentName}] Error setting buyer GitHub username:`, error);

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
        error: 'Failed to set buyer GitHub username',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Export rate-limited handler
 *
 * PUT: API rate limiting (100 requests / minute per user)
 */
export const PUT = withApiRateLimit(setBuyerGithubUsername, async (request) => {
  const auth = await authenticateApiRequest(request);
  return auth?.user.id || 'anonymous';
});
