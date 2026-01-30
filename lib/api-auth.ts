/**
 * API Authentication Helper
 *
 * Responsibilities:
 * - Provide unified authentication for API routes
 * - Support dual authentication (Firebase tokens OR API keys)
 * - Extract auth from cookies (Firebase session) OR Authorization header (API keys)
 *
 * Architecture:
 * - Tries cookie-based auth first (for browser requests)
 * - Falls back to Authorization header (for programmatic API access)
 * - Returns standardized auth result
 * - Follows ataglance pattern for consistency
 *
 * Usage:
 * ```typescript
 * import { authenticateApiRequest } from '@/lib/api-auth';
 *
 * export async function GET(request: Request) {
 *   const auth = await authenticateApiRequest(request);
 *   if (!auth) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *   // Use auth.user.id, auth.user.isAdmin, etc.
 * }
 * ```
 */

import { cookies } from 'next/headers';
import { verifyFirebaseToken, verifyAuth, type AuthResult } from './firebase-auth';

/**
 * Authenticate API request using cookies OR Authorization header
 *
 * Priority:
 * 1. Try Firebase session token from cookie (browser requests)
 * 2. Try Authorization header (API key or Firebase token)
 *
 * @returns AuthResult if authenticated, null otherwise
 */
export async function authenticateApiRequest(
  request: Request
): Promise<AuthResult | null> {
  console.log('[API Auth] Authenticating request');

  // Try cookie-based authentication first (Firebase session)
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session')?.value;

    if (sessionToken) {
      console.log('[API Auth] Found session token in cookie, verifying');
      const auth = await verifyFirebaseToken(sessionToken);
      console.log('[API Auth] Cookie auth successful for user:', auth.user.id);
      return auth;
    }
  } catch (error) {
    console.log('[API Auth] Cookie auth failed, trying Authorization header');
  }

  // Try Authorization header (API key or Firebase token)
  try {
    const authHeader = request.headers.get('authorization');

    if (authHeader) {
      console.log('[API Auth] Found Authorization header, verifying');
      const auth = await verifyAuth(authHeader);
      console.log(
        '[API Auth] Authorization header auth successful for user:',
        auth.user.id,
        auth.apiKeyId ? `(API key: ${auth.apiKeyId})` : '(Firebase token)'
      );
      return auth;
    }
  } catch (error) {
    console.log('[API Auth] Authorization header auth failed');
  }

  console.log('[API Auth] Authentication failed - no valid credentials found');
  return null;
}

/**
 * Require admin authentication for API request
 *
 * @returns AuthResult if authenticated as admin, null otherwise
 */
export async function requireAdminApiAuth(
  request: Request
): Promise<AuthResult | null> {
  const auth = await authenticateApiRequest(request);

  if (!auth) {
    console.log('[API Auth] requireAdmin: No authentication');
    return null;
  }

  if (!auth.user.isAdmin) {
    console.log('[API Auth] requireAdmin: User is not admin:', auth.user.id);
    return null;
  }

  console.log('[API Auth] requireAdmin: Admin access granted:', auth.user.id);
  return auth;
}
