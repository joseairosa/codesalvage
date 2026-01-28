/**
 * Transaction Detail API Route
 *
 * Get details of a specific transaction.
 * Only accessible by the buyer or seller of the transaction.
 *
 * GET /api/transactions/[id] - Get transaction details
 *
 * @example
 * GET /api/transactions/transaction123
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { withApiRateLimit } from '@/lib/middleware/withRateLimit';
import {
  TransactionService,
  TransactionValidationError,
  TransactionPermissionError,
  TransactionNotFoundError,
} from '@/lib/services/TransactionService';
import { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';

const componentName = 'TransactionDetailAPI';

// Initialize repositories and service
const transactionRepository = new TransactionRepository(prisma);
const userRepository = new UserRepository(prisma);
const projectRepository = new ProjectRepository(prisma);
const transactionService = new TransactionService(
  transactionRepository,
  userRepository,
  projectRepository
);

/**
 * GET /api/transactions/[id] (internal handler)
 *
 * Get transaction details by ID
 * Access control: Only buyer or seller can view
 */
async function getTransactionDetails(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    console.log(`[${componentName}] Fetching transaction:`, {
      transactionId: id,
      userId: session.user.id,
    });

    // Use TransactionService to get transaction with access validation
    const transaction = await transactionService.getTransactionById(id, session.user.id);

    console.log(`[${componentName}] Transaction found:`, transaction.id);

    return NextResponse.json({ transaction }, { status: 200 });
  } catch (error) {
    console.error(`[${componentName}] Error fetching transaction:`, error);

    // Map service errors to appropriate HTTP status codes
    if (error instanceof TransactionValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          field: error.field,
        },
        { status: 400 }
      );
    }

    if (error instanceof TransactionPermissionError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 403 }
      );
    }

    if (error instanceof TransactionNotFoundError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch transaction',
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
export const GET = withApiRateLimit(getTransactionDetails, async (_request) => {
  const session = await auth();
  return session?.user?.id || 'anonymous';
});
