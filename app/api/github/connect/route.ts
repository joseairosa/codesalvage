/**
 * GET /api/github/connect
 *
 * Initiates GitHub OAuth flow to get a token with `repo` scope
 * for accessing private repositories during project analysis.
 *
 * Redirects user to GitHub authorization page.
 */

import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import crypto from 'crypto';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  // Must be authenticated
  const auth = await authenticateApiRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = process.env['GITHUB_OAUTH_CLIENT_ID'];
  if (!clientId) {
    return NextResponse.json(
      { error: 'GitHub OAuth is not configured' },
      { status: 500 }
    );
  }

  // Generate CSRF state token
  const state = crypto.randomBytes(32).toString('hex');

  // Store state in cookie for verification in callback
  const cookieStore = await cookies();
  cookieStore.set('github_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] || 'http://localhost:3011';

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/github/callback`,
    scope: 'repo',
    state,
  });

  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`
  );
}
