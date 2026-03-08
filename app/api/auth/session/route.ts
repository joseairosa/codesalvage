/**
 * Session API Route
 *
 * Responsibilities:
 * - Store Firebase ID token in httpOnly cookie (POST)
 * - Clear session cookie (DELETE)
 *
 * Architecture:
 * - Verifies token is valid before storing
 * - Uses httpOnly cookies for security
 * - 7-day session expiration
 * - Follows ataglance pattern for consistency
 */

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyFirebaseToken } from '@/lib/firebase-auth';
import { getAuth } from '@/lib/firebase-admin';

/**
 * POST /api/auth/session
 * Store Firebase ID token in httpOnly cookie
 *
 * No rate limiting needed here: Firebase Admin SDK cryptographically
 * validates every token (invalid tokens return 401 immediately).
 * Rate limiting by IP was causing 429s for normal users since AuthProvider
 * calls this endpoint on every page load (5 req/15min was too tight).
 */
export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      console.error('[Session API] Missing idToken in request');
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    console.log('[Session API] Verifying Firebase token');

    // Verify ID token (also auto-creates/links user in DB on first sign-in)
    await verifyFirebaseToken(idToken);

    console.log('[Session API] Token verified, creating Firebase session cookie');

    // Exchange short-lived ID token (1hr) for a proper 7-day session cookie
    const SESSION_DURATION_MS = 60 * 60 * 24 * 7 * 1000; // 7 days in ms
    const sessionCookie = await getAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    console.log('[Session API] Session cookie created, storing in cookie');

    const cookieStore = await cookies();
    cookieStore.set('session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    console.log('[Session API] Session cookie created successfully');

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Session API] Error creating session:', errorMessage);

    const isConfigError =
      errorMessage.includes('not configured') ||
      errorMessage.includes('not set') ||
      errorMessage.includes('No credentials');
    const statusCode = isConfigError ? 500 : 401;

    console.error('[Session API] Auth error:', errorMessage);
    return NextResponse.json(
      { error: isConfigError ? 'Server configuration error' : 'Invalid token' },
      { status: statusCode }
    );
  }
}

/**
 * DELETE /api/auth/session
 * Clear session cookie
 */
export async function DELETE() {
  console.log('[Session API] Clearing session cookie');

  const cookieStore = await cookies();
  cookieStore.delete('session');

  console.log('[Session API] Session cookie cleared successfully');

  return NextResponse.json({ success: true });
}
