/**
 * GET /api/feedback/rate-limit
 *
 * Returns remaining feedback submissions for the authenticated user today.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-helpers';
import { getFeedbackService } from '@/lib/utils/admin-services';

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const feedbackService = getFeedbackService();
    const rateLimit = await feedbackService.checkRateLimit(session.user.id);

    return NextResponse.json(rateLimit, { status: 200 });
  } catch (error) {
    console.error('[Feedback API] Rate limit check error:', error);
    return NextResponse.json({ error: 'Failed to check rate limit' }, { status: 500 });
  }
}
