/**
 * Admin Payouts API Route
 *
 * GET /api/admin/payouts — List payout requests with filters
 */

import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { PayoutRequestRepository } from '@/lib/repositories/PayoutRequestRepository';

const payoutRequestRepo = new PayoutRequestRepository(prisma);

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth || !auth.user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await payoutRequestRepo.listWithFilters({
      status,
      page,
      limit,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[Admin Payouts] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payouts', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
