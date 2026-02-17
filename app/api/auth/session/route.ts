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
import { withAuthRateLimit } from '@/lib/middleware/withRateLimit';

/**
 * POST /api/auth/session
 * Store Firebase ID token in httpOnly cookie
 */
export const POST = withAuthRateLimit(async (request: NextRequest) => {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      console.error('[Session API] Missing idToken in request');
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 });
    }

    console.log('[Session API] Verifying Firebase token');

    await verifyFirebaseToken(idToken);

    console.log('[Session API] Token verified, storing in cookie');

    const cookieStore = await cookies();
    cookieStore.set('session', idToken, {
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

    return NextResponse.json(
      {
        error: isConfigError ? 'Server configuration error' : 'Invalid token',
        details: errorMessage,
      },
      { status: statusCode }
    );
  }
});

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
