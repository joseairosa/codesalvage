/**
 * Admin API Route: List Disputes
 *
 * GET /api/admin/disputes
 *
 * Query Parameters:
 * - status: string (optional) — filter by dispute status
 *
 * Responses:
 * - 200: Disputes fetched successfully
 * - 401: Unauthorized (not admin)
 * - 500: Server error
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { getDisputeRepository } from '@/lib/utils/admin-services';

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiAuth(request);

  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const status = request.nextUrl.searchParams.get('status') || undefined;
    const disputeRepository = getDisputeRepository();
    const disputes = await disputeRepository.findAll(status);

    return NextResponse.json({ disputes }, { status: 200 });
  } catch (error) {
    console.error('[Admin API] Fetch disputes error:', error);
    return NextResponse.json({ error: 'Failed to fetch disputes' }, { status: 500 });
  }
}
