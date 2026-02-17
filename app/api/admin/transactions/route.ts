/**
 * Admin API Route: List Transactions
 *
 * GET /api/admin/transactions
 *
 * Responsibilities:
 * - Validate admin session
 * - Parse and validate query parameters
 * - Fetch transactions with filters via AdminService
 * - Return paginated transaction list
 *
 * Query Parameters:
 * - paymentStatus: string (optional) - Filter by payment status
 * - escrowStatus: string (optional) - Filter by escrow status
 * - sellerId: string (optional) - Filter by seller ID
 * - buyerId: string (optional) - Filter by buyer ID
 * - projectId: string (optional) - Filter by project ID
 * - sortBy: string (optional) - Sort field (default: createdAt)
 * - sortOrder: 'asc' | 'desc' (optional) - Sort order (default: desc)
 * - limit: number (optional) - Results per page (default: 50, max: 100)
 * - offset: number (optional) - Pagination offset (default: 0)
 *
 * Responses:
 * - 200: Transactions fetched successfully
 * - 401: Unauthorized (not admin)
 * - 500: Server error
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { getAdminService, getTransactionRepository } from '@/lib/utils/admin-services';

/**
 * GET /api/admin/transactions
 *
 * Fetch all transactions with optional filters and pagination.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminApiAuth(request);

  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;

    const paymentStatus = searchParams.get('paymentStatus') || undefined;
    const escrowStatus = searchParams.get('escrowStatus') || undefined;
    const sellerId = searchParams.get('sellerId') || undefined;
    const buyerId = searchParams.get('buyerId') || undefined;
    const projectId = searchParams.get('projectId') || undefined;

    const sortByParam = searchParams.get('sortBy') || 'createdAt';
    const sortBy = ['createdAt', 'amountCents', 'escrowReleaseDate'].includes(sortByParam)
      ? (sortByParam as 'createdAt' | 'amountCents' | 'escrowReleaseDate')
      : 'createdAt';
    const sortOrderParam = searchParams.get('sortOrder') || 'desc';
    const sortOrder = (
      ['asc', 'desc'].includes(sortOrderParam) ? sortOrderParam : 'desc'
    ) as 'asc' | 'desc';

    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const adminService = getAdminService();

    const filters = Object.fromEntries(
      Object.entries({
        paymentStatus,
        escrowStatus,
        sellerId,
        buyerId,
        projectId,
      }).filter(([_, value]) => value !== undefined)
    ) as {
      paymentStatus?: string;
      escrowStatus?: string;
      sellerId?: string;
      buyerId?: string;
      projectId?: string;
    };

    const transactions = await adminService.getTransactions({
      ...filters,
      limit,
      offset,
      sortBy,
      sortOrder,
    });

    const transactionRepository = getTransactionRepository();
    const total = await transactionRepository.countAllTransactions(filters);

    const now = Date.now();
    const transactionsWithEscrowFields = transactions.map((tx) => {
      const escrowReleaseDate = tx.escrowReleaseDate
        ? new Date(tx.escrowReleaseDate).getTime()
        : null;
      const isHeld = tx.escrowStatus === 'held';

      const escrowTimeRemainingMs =
        isHeld && escrowReleaseDate !== null
          ? Math.max(0, escrowReleaseDate - now)
          : null;

      const isOverdue = isHeld && escrowReleaseDate !== null && escrowReleaseDate < now;

      return { ...tx, escrowTimeRemainingMs, isOverdue };
    });

    return NextResponse.json(
      {
        transactions: transactionsWithEscrowFields,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + transactions.length < total,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Admin API] Fetch transactions error:', error);

    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
