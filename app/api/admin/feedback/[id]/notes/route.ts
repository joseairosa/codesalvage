/**
 * PATCH /api/admin/feedback/[id]/notes
 *
 * Save admin notes on a feedback entry (admin only).
 * Body: { adminNotes: string }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { getFeedbackService } from '@/lib/utils/admin-services';
import { FeedbackNotFoundError } from '@/lib/services/FeedbackService';

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
    const { adminNotes } = (await request.json()) as { adminNotes: string };

    const feedbackService = getFeedbackService();
    const updated = await feedbackService.updateNotes(id, adminNotes ?? '');

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    if (error instanceof FeedbackNotFoundError) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }
    console.error('[Admin Feedback API] Update notes error:', error);
    return NextResponse.json({ error: 'Failed to update notes' }, { status: 500 });
  }
}
