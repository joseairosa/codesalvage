/**
 * Next.js Middleware - Route Protection (Firebase)
 *
 * Responsibilities:
 * - Protect authenticated routes (dashboard, seller pages, buyer pages)
 * - Redirect unauthenticated users to sign-in page
 * - Lightweight Firebase token validation
 * - Preserve original URL for post-auth redirect
 *
 * Architecture:
 * - Runs on Edge Runtime (fast, globally distributed)
 * - Uses Firebase tokens stored in httpOnly cookies
 * - Lightweight token check (full verification in routes with requireAuth/requireAdmin)
 * - Follows ataglance pattern for consistency
 *
 * Protected Routes:
 * - /dashboard/* - All authenticated users
 * - /seller/* - Sellers only (full check in route)
 * - /buyer/* - Buyers only (all users by default)
 * - /projects/* - Protected routes
 * - /admin/* - Admins only (full check in route)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';

/**
 * Middleware function - runs on every request matching config.matcher
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log('[Middleware] Checking route:', pathname);

  // Public routes (no auth required)
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/webhooks') ||
    pathname === '/' ||
    pathname.startsWith('/api/auth/session') // Allow session API route
  ) {
    console.log('[Middleware] Public route, allowing access');
    return NextResponse.next();
  }

  // Get session cookie
  const sessionToken = request.cookies.get('session')?.value;

  // Protected routes require session token
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/seller') ||
    pathname.startsWith('/buyer') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/projects');

  if (isProtectedRoute) {
    if (!sessionToken) {
      console.log('[Middleware] No session token, redirecting to sign-in');

      // Redirect to sign-in with callback URL
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);

      return NextResponse.redirect(signInUrl);
    }

    // Lightweight token check (full verification happens in routes)
    try {
      await getAuth().verifyIdToken(sessionToken);
      console.log('[Middleware] Token valid, allowing access');
    } catch (error) {
      console.log('[Middleware] Invalid/expired token, redirecting to sign-in');

      // Token invalid/expired, clear cookie and redirect
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);

      const response = NextResponse.redirect(signInUrl);
      response.cookies.delete('session');

      return response;
    }

    // Note: Seller/admin-specific checks happen in route with requireAuth/requireAdmin
    // Middleware only checks token validity for performance
  }

  // Allow request to proceed
  return NextResponse.next();
}

/**
 * Middleware configuration
 *
 * Specifies which routes this middleware should run on.
 * Uses matcher to include only protected routes for performance.
 */
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/seller/:path*',
    '/buyer/:path*',
    '/admin/:path*',
    '/projects/:path*',
  ],
};
