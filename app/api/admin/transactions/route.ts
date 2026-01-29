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

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth-helpers';
import { getAdminService, getTransactionRepository } from '@/lib/utils/admin-services';

/**
 * GET /api/admin/transactions
 *
 * Fetch all transactions with optional filters and pagination.
 */
export async function GET(request: NextRequest) {
  // Verify admin session
  const session = await requireAdminApi();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;

    // String filters
    const paymentStatus = searchParams.get('paymentStatus') || undefined;
    const escrowStatus = searchParams.get('escrowStatus') || undefined;
    const sellerId = searchParams.get('sellerId') || undefined;
    const buyerId = searchParams.get('buyerId') || undefined;
    const projectId = searchParams.get('projectId') || undefined;

    // Sorting
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as
      | 'asc'
      | 'desc';

    // Pagination
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '50', 10),
      100
    );
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Fetch transactions via AdminService
    const adminService = getAdminService();
    const transactions = await adminService.getTransactions({
      paymentStatus,
      escrowStatus,
      sellerId,
      buyerId,
      projectId,
      limit,
      offset,
      sortBy,
      sortOrder,
    });

    // Get total count for pagination metadata
    const transactionRepository = getTransactionRepository();
    const total = await transactionRepository.countAllTransactions({
      paymentStatus,
      escrowStatus,
      sellerId,
      buyerId,
      projectId,
    });

    return NextResponse.json(
      {
        transactions,
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

    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
