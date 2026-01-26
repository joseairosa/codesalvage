/**
 * Transactions API Route
 *
 * Handles transaction operations for buyers and sellers.
 *
 * GET /api/transactions - List user's transactions (buyer or seller view)
 *
 * @example
 * GET /api/transactions?view=buyer&page=1&limit=20
 * GET /api/transactions?view=seller&page=1&limit=20
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import {
  TransactionService,
  TransactionValidationError,
  TransactionPermissionError,
  TransactionNotFoundError,
} from '@/lib/services/TransactionService';
import { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';

const componentName = 'TransactionsAPI';

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
 * GET /api/transactions
 *
 * List user's transactions with pagination
 * Query params:
 * - view: 'buyer' | 'seller' (default: 'buyer')
 * - page: number (default: 1)
 * - limit: number (default: 20)
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'buyer'; // 'buyer' or 'seller'
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    console.log(`[${componentName}] Fetching transactions:`, {
      userId: session.user.id,
      view,
      page,
      limit,
    });

    // Get transactions based on view
    const result =
      view === 'seller'
        ? await transactionService.getSellerTransactions(session.user.id, {
            page,
            limit,
          })
        : await transactionService.getBuyerTransactions(session.user.id, {
            page,
            limit,
          });

    console.log(`[${componentName}] Found ${result.transactions.length} transactions`);

    return NextResponse.json(
      {
        transactions: result.transactions,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasNext: result.hasNext,
        hasPrev: result.hasPrev,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error fetching transactions:`, error);

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
        error: 'Failed to fetch transactions',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
