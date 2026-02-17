/**
 * Admin Escrow Analytics API Route
 *
 * GET /api/admin/escrow-analytics
 *
 * Returns escrow analytics for the admin dashboard:
 * - Total amount held in escrow
 * - Counts by escrow status (held, released, pending, disputed)
 * - Overdue escrow count and amount
 *
 * Responses:
 * - 200: Escrow analytics data
 * - 401: Unauthorized (not admin)
 * - 500: Server error
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { getAdminService } from '@/lib/utils/admin-services';

/**
 * GET /api/admin/escrow-analytics
 *
 * Return escrow analytics for admin dashboard.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminApiAuth(request);

  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[API] GET /api/admin/escrow-analytics - Admin:', auth.user.id);

  try {
    const adminService = getAdminService();
    const analytics = await adminService.getEscrowAnalytics();

    return NextResponse.json({ analytics }, { status: 200 });
  } catch (error) {
    console.error('[API] GET /api/admin/escrow-analytics - Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch escrow analytics' },
      { status: 500 }
    );
  }
}
