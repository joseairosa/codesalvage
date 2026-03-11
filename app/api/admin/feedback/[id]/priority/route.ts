/**
 * PATCH /api/admin/feedback/[id]/priority
 *
 * Update feedback priority (admin only).
 * Body: { priority: 'low' | 'medium' | 'high' | 'critical' }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { getFeedbackService } from '@/lib/utils/admin-services';
import { FeedbackNotFoundError } from '@/lib/services/FeedbackService';
import type { FeedbackPriority } from '@/lib/repositories/FeedbackRepository';

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
    const { priority } = (await request.json()) as { priority: FeedbackPriority };

    const validPriorities: FeedbackPriority[] = ['low', 'medium', 'high', 'critical'];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json({ error: 'Invalid priority value' }, { status: 400 });
    }

    const feedbackService = getFeedbackService();
    const updated = await feedbackService.updatePriority(id, priority);

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    if (error instanceof FeedbackNotFoundError) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }
    console.error('[Admin Feedback API] Update priority error:', error);
    return NextResponse.json({ error: 'Failed to update priority' }, { status: 500 });
  }
}
