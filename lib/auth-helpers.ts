/**
 * Admin Authentication Helpers
 *
 * Server-side helpers for admin route protection.
 *
 * Responsibilities:
 * - Provide auth helpers for Server Components
 * - Provide auth helpers for API Routes
 * - Check admin status
 *
 * Architecture:
 * - Uses auth() from lib/auth for session retrieval
 * - Redirects non-admin users appropriately
 * - Type-safe session returns
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

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

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
  const session = await auth();

  if (!session?.user?.id) {
    console.log('[AuthHelpers] requireAdmin: No session, redirecting to signin');
    redirect('/auth/signin');
  }

  if (!session.user.isAdmin) {
    console.log('[AuthHelpers] requireAdmin: User is not admin, redirecting to dashboard');
    redirect('/dashboard');
  }

  console.log('[AuthHelpers] requireAdmin: Admin access granted for user:', session.user.id);
  return session;
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
  const session = await auth();

  if (!session?.user?.id || !session.user.isAdmin) {
    console.log('[AuthHelpers] requireAdminApi: Access denied');
    return null;
  }

  console.log('[AuthHelpers] requireAdminApi: Admin API access granted for user:', session.user.id);
  return session;
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
  const session = await auth();
  const adminStatus = !!session?.user?.isAdmin;

  console.log('[AuthHelpers] isAdmin check:', {
    userId: session?.user?.id,
    isAdmin: adminStatus,
  });

  return adminStatus;
}
