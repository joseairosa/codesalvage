/**
 * Authentication Helpers
 *
 * Server-side helpers for route protection using Firebase.
 *
 * Responsibilities:
 * - Provide auth helpers for Server Components
 * - Provide auth helpers for API Routes
 * - Check admin status
 * - Maintain compatibility with Auth.js signatures
 *
 * Architecture:
 * - Uses Firebase tokens stored in httpOnly cookies
 * - Redirects non-admin users appropriately
 * - Type-safe session returns
 * - NOTE: Maintains same function signatures as Auth.js version for compatibility
 *
 * @example
 * // In a Server Component:
 * import { requireAdmin } from '@/lib/auth-helpers';
 * const session = await requireAdmin();
 *
 * @example
 * // In an API Route:
 * import { requireAdminApi } from '@/lib/auth-helpers';
 * const session = await requireAdminApi();
 * if (!session) {
 *   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 * }
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyFirebaseToken } from './firebase-auth';

/**
 * Require admin authentication (Server Components)
 *
 * Use this in Server Components to protect admin routes.
 * Automatically redirects non-authenticated users to signin,
 * and non-admin users to dashboard.
 *
 * @throws Redirects to /auth/signin if not authenticated
 * @throws Redirects to /dashboard if not admin
 * @returns Session with admin user
 *
 * @example
 * export default async function AdminPage() {
 *   const session = await requireAdmin();
 *   return <div>Welcome Admin: {session.user.username}</div>;
 * }
 */
export async function requireAdmin() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;

  if (!sessionToken) {
    console.log('[AuthHelpers] requireAdmin: No session token, redirecting to signin');
    redirect('/auth/signin');
  }

  try {
    const auth = await verifyFirebaseToken(sessionToken);

    if (!auth.user.isAdmin) {
      console.log(
        '[AuthHelpers] requireAdmin: User is not admin, redirecting to dashboard'
      );
      redirect('/dashboard');
    }

    console.log(
      '[AuthHelpers] requireAdmin: Admin access granted for user:',
      auth.user.id
    );

    return {
      user: {
        id: auth.user.id,
        email: auth.user.email,
        username: auth.user.username,
        isAdmin: auth.user.isAdmin,
        isSeller: auth.user.isSeller,
        isVerifiedSeller: auth.user.isVerifiedSeller,
      },
    };
  } catch {
    console.log(
      '[AuthHelpers] requireAdmin: Token verification failed, redirecting to signin'
    );
    redirect('/auth/signin');
  }
}

/**
 * Require admin authentication (API Routes)
 *
 * Use this in API Routes to protect admin endpoints.
 * Returns null if user is not authenticated or not admin,
 * allowing you to return appropriate error responses.
 *
 * @returns Session with admin user, or null if not authorized
 *
 * @example
 * export async function GET() {
 *   const session = await requireAdminApi();
 *   if (!session) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *   // Admin-only logic here
 * }
 */
export async function requireAdminApi() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;

  if (!sessionToken) {
    console.log('[AuthHelpers] requireAdminApi: No session token');
    return null;
  }

  try {
    const auth = await verifyFirebaseToken(sessionToken);

    if (!auth.user.isAdmin) {
      console.log('[AuthHelpers] requireAdminApi: User is not admin');
      return null;
    }

    console.log(
      '[AuthHelpers] requireAdminApi: Admin API access granted for user:',
      auth.user.id
    );

    return {
      user: {
        id: auth.user.id,
        email: auth.user.email,
        username: auth.user.username,
        isAdmin: auth.user.isAdmin,
        isSeller: auth.user.isSeller,
        isVerifiedSeller: auth.user.isVerifiedSeller,
      },
    };
  } catch {
    console.log('[AuthHelpers] requireAdminApi: Token verification failed');
    return null;
  }
}

/**
 * Require authenticated user (Server Components)
 *
 * Use this in Server Components to protect user routes.
 * Automatically redirects non-authenticated users to signin.
 *
 * @throws Redirects to /auth/signin if not authenticated
 * @returns Session with user
 */
export async function requireAuth() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;

  if (!sessionToken) {
    console.log('[AuthHelpers] requireAuth: No session token, redirecting to signin');
    redirect('/auth/signin');
  }

  try {
    const auth = await verifyFirebaseToken(sessionToken);

    console.log('[AuthHelpers] requireAuth: Access granted for user:', auth.user.id);

    return {
      user: {
        id: auth.user.id,
        email: auth.user.email,
        username: auth.user.username,
        isAdmin: auth.user.isAdmin,
        isSeller: auth.user.isSeller,
        isVerifiedSeller: auth.user.isVerifiedSeller,
      },
    };
  } catch {
    console.log(
      '[AuthHelpers] requireAuth: Token verification failed, redirecting to signin'
    );
    redirect('/auth/signin');
  }
}

/**
 * Get current session (optional auth)
 *
 * Non-blocking session retrieval. Returns null if not authenticated.
 * Useful for optional auth or conditional rendering.
 *
 * @returns Session with user, or null if not authenticated
 */
export async function getSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;

  if (!sessionToken) {
    return null;
  }

  try {
    const auth = await verifyFirebaseToken(sessionToken);

    return {
      user: {
        id: auth.user.id,
        email: auth.user.email,
        username: auth.user.username,
        isAdmin: auth.user.isAdmin,
        isSeller: auth.user.isSeller,
        isVerifiedSeller: auth.user.isVerifiedSeller,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Check if current user is admin
 *
 * Non-blocking check that returns a boolean.
 * Useful for conditional rendering or logic.
 *
 * @returns Boolean indicating admin status
 *
 * @example
 * const userIsAdmin = await isAdmin();
 * if (userIsAdmin) {
 *   // Show admin features
 * }
 */
export async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  const adminStatus = !!session?.user?.isAdmin;

  console.log('[AuthHelpers] isAdmin check:', {
    userId: session?.user?.id,
    isAdmin: adminStatus,
  });

  return adminStatus;
}
