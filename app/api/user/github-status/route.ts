/**
 * GET /api/user/github-status
 *
 * Returns whether the authenticated user has connected their GitHub account.
 * Used by the project listing form to show connection status.
 */

import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { githubAccessToken: true, githubConnectedAt: true },
  });

  return NextResponse.json({
    connected: !!user?.githubAccessToken,
    connectedAt: user?.githubConnectedAt?.toISOString() ?? null,
  });
}
