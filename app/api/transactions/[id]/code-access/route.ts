/**
 * Transaction Code Access API Route
 *
 * Mark when a buyer accesses/downloads the purchased code.
 * Only accessible by the buyer of the transaction.
 *
 * POST /api/transactions/[id]/code-access - Mark code as accessed
 *
 * @example
 * POST /api/transactions/transaction123/code-access
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

const componentName = 'TransactionCodeAccessAPI';

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
 * POST /api/transactions/[id]/code-access
 *
 * Mark code as accessed by buyer
 * Access control: Only buyer can mark code as accessed
 * Business rules:
 * - Payment must be successful
 * - Only buyer can access code
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    console.log(`[${componentName}] Marking code as accessed:`, {
      transactionId: id,
      userId: session.user.id,
    });

    // Use TransactionService to mark code as accessed
    await transactionService.markCodeAccessed(id, session.user.id);

    console.log(`[${componentName}] Code access marked successfully`);

    return NextResponse.json(
      {
        success: true,
        message: 'Code access marked',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error marking code access:`, error);

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
        error: 'Failed to mark code access',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
