/**
 * Transaction API Route
 *
 * Get transaction details by ID.
 *
 * GET /api/transactions/[id]
 *
 * @example
 * GET /api/transactions/trans_123
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/transactions/[id]
 *
 * Get transaction details
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const transactionId = params.id;

    console.log('[Transaction API] Fetching transaction:', transactionId);

    // Get transaction with related data
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        project: {
          include: {
            seller: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
          },
        },
        buyer: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
        seller: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Check if user is buyer or seller
    const isBuyer = transaction.buyerId === session.user.id;
    const isSeller = transaction.sellerId === session.user.id;

    if (!isBuyer && !isSeller) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('[Transaction API] Transaction found');

    return NextResponse.json(transaction, { status: 200 });
  } catch (error) {
    console.error('[Transaction API] Error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch transaction',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
