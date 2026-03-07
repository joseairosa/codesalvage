/**
 * Onboarding Dismiss API Route
 *
 * PATCH /api/user/onboarding-dismiss — Mark onboarding checklist as dismissed
 *
 * Sets onboardingDismissedAt to now so the checklist is permanently hidden
 * for this user.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: auth.user.id },
      data: { onboardingDismissedAt: new Date() },
    });

    return NextResponse.json({ dismissed: true }, { status: 200 });
  } catch (error) {
    console.error('[OnboardingDismiss] Error:', error);
    return NextResponse.json({ error: 'Failed to dismiss onboarding' }, { status: 500 });
  }
}
