/**
 * GET /api/github/callback
 *
 * GitHub OAuth callback handler.
 * Exchanges authorization code for access token, encrypts it,
 * and stores it in the user's profile.
 *
 * Redirects back to /projects/new on success.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authenticateApiRequest } from '@/lib/api-auth';
import { encrypt } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] || 'http://localhost:3011';

  // Handle OAuth errors
  if (error) {
    console.error('[GitHub OAuth] Error:', error);
    return NextResponse.redirect(
      `${appUrl}/projects/new?github_error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/projects/new?github_error=missing_params`);
  }

  // Verify CSRF state
  const cookieStore = await cookies();
  const storedState = cookieStore.get('github_oauth_state')?.value;
  cookieStore.delete('github_oauth_state');

  if (!storedState || storedState !== state) {
    console.error('[GitHub OAuth] State mismatch');
    return NextResponse.redirect(`${appUrl}/projects/new?github_error=state_mismatch`);
  }

  // Must be authenticated
  const auth = await authenticateApiRequest(request);
  if (!auth) {
    return NextResponse.redirect(`${appUrl}/auth/signin`);
  }

  // Exchange code for access token
  const clientId = process.env['GITHUB_OAUTH_CLIENT_ID'];
  const clientSecret = process.env['GITHUB_OAUTH_CLIENT_SECRET'];

  if (!clientId || !clientSecret) {
    console.error('[GitHub OAuth] Missing client credentials');
    return NextResponse.redirect(`${appUrl}/projects/new?github_error=server_config`);
  }

  let accessToken: string;
  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('[GitHub OAuth] Token exchange error:', tokenData.error);
      return NextResponse.redirect(
        `${appUrl}/projects/new?github_error=${encodeURIComponent(tokenData.error)}`
      );
    }

    accessToken = tokenData.access_token;
    if (!accessToken) {
      throw new Error('No access_token in response');
    }
  } catch (err) {
    console.error('[GitHub OAuth] Token exchange failed:', err);
    return NextResponse.redirect(
      `${appUrl}/projects/new?github_error=token_exchange_failed`
    );
  }

  // Encrypt and store the token
  try {
    const encryptedToken = encrypt(accessToken);

    await prisma.user.update({
      where: { id: auth.user.id },
      data: {
        githubAccessToken: encryptedToken,
        githubConnectedAt: new Date(),
      },
    });

    console.log('[GitHub OAuth] Token stored for user:', auth.user.id);
  } catch (err) {
    console.error('[GitHub OAuth] Failed to store token:', err);
    return NextResponse.redirect(`${appUrl}/projects/new?github_error=storage_failed`);
  }

  // Redirect back to project form with success
  return NextResponse.redirect(`${appUrl}/projects/new?github_connected=true`);
}
