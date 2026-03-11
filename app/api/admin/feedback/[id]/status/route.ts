/**
 * PATCH /api/admin/feedback/[id]/status
 *
 * Update feedback status (admin only).
 * Body: { status: 'new' | 'in_progress' | 'resolved' | 'closed' }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { getFeedbackService } from '@/lib/utils/admin-services';
import { FeedbackNotFoundError } from '@/lib/services/FeedbackService';
import type { FeedbackStatus } from '@/lib/repositories/FeedbackRepository';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { status } = (await request.json()) as { status: FeedbackStatus };

    const validStatuses: FeedbackStatus[] = ['new', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const feedbackService = getFeedbackService();
    const updated = await feedbackService.updateStatus(id, status, auth.user.id);

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    if (error instanceof FeedbackNotFoundError) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }
    console.error('[Admin Feedback API] Update status error:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
