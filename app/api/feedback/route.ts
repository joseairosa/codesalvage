/**
 * POST /api/feedback
 *
 * Submit feedback. Auth is optional — anonymous submissions allowed.
 * Authenticated users are rate-limited to 5 per day.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-helpers';
import { getFeedbackService } from '@/lib/utils/admin-services';
import { FeedbackValidationError } from '@/lib/services/FeedbackService';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json();
    const { type, title, content, email } = body;

    const userAgent = request.headers.get('user-agent') ?? undefined;
    const feedbackService = getFeedbackService();

    const entry = await feedbackService.submit(
      {
        type: type ?? 'general',
        title,
        content,
        email,
        ...(userAgent !== undefined && { userAgent }),
      },
      session?.user.id
    );

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof FeedbackValidationError) {
      return NextResponse.json(
        { error: 'Validation error', message: error.message, field: error.field },
        { status: 400 }
      );
    }
    console.error('[Feedback API] Submit error:', error);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}
