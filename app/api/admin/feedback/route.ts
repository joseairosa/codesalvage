/**
 * GET /api/admin/feedback
 *
 * List feedback with filters and pagination (admin only).
 *
 * Query parameters:
 * - type: general | feature | bug | support
 * - status: new | in_progress | resolved | closed
 * - priority: low | medium | high | critical
 * - search: string
 * - limit: number (default 20)
 * - offset: number (default 0)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { getFeedbackService } from '@/lib/utils/admin-services';
import type {
  FeedbackType,
  FeedbackStatus,
  FeedbackPriority,
} from '@/lib/repositories/FeedbackRepository';

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;
    const feedbackService = getFeedbackService();

    const type = searchParams.get('type') as FeedbackType | null;
    const status = searchParams.get('status') as FeedbackStatus | null;
    const priority = searchParams.get('priority') as FeedbackPriority | null;
    const search = searchParams.get('search');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    const result = await feedbackService.list({
      ...(type && { type }),
      ...(status && { status }),
      ...(priority && { priority }),
      ...(search && { search }),
      limit: limitParam ? parseInt(limitParam, 10) : 20,
      offset: offsetParam ? parseInt(offsetParam, 10) : 0,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[Admin Feedback API] List error:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}
