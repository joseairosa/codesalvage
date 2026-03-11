/**
 * GET /api/admin/feedback/stats
 *
 * Returns feedback counts by status, type, and priority (admin only).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { getFeedbackService } from '@/lib/utils/admin-services';

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const feedbackService = getFeedbackService();
    const stats = await feedbackService.getStats();

    return NextResponse.json(stats, { status: 200 });
  } catch (error) {
    console.error('[Admin Feedback API] Stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback stats' },
      { status: 500 }
    );
  }
}
