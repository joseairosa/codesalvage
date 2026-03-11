/**
 * DELETE /api/admin/feedback/[id]
 *
 * Delete a feedback entry (admin only).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { getFeedbackService } from '@/lib/utils/admin-services';
import { FeedbackNotFoundError } from '@/lib/services/FeedbackService';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const feedbackService = getFeedbackService();
    await feedbackService.delete(id);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof FeedbackNotFoundError) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }
    console.error('[Admin Feedback API] Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete feedback' }, { status: 500 });
  }
}
