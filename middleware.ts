/**
 * Next.js Middleware - Route Protection
 *
 * Responsibilities:
 * - Protect authenticated routes (dashboard, seller pages, buyer pages)
 * - Redirect unauthenticated users to sign-in page
 * - Handle seller-only routes
 * - Preserve original URL for post-auth redirect
 *
 * Architecture:
 * - Runs on Edge Runtime (fast, globally distributed)
 * - Uses Auth.js session checking
 * - Matches routes via config.matcher
 *
 * Protected Routes:
 * - /dashboard/* - All authenticated users
 * - /seller/* - Sellers only
 * - /buyer/* - Buyers only (all users by default)
 * - /projects/new - Sellers only (create project)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * Middleware function - runs on every request matching config.matcher
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  console.log('[Middleware] Checking route:', pathname);

  // Get session (Auth.js automatically handles this)
  const session = await auth();

  // Route protection rules
  const isAuthRoute = pathname.startsWith('/auth/');
  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isSellerRoute = pathname.startsWith('/seller');
  const isBuyerRoute = pathname.startsWith('/buyer');
  const isCreateProjectRoute = pathname === '/projects/new';

  // Allow auth routes (sign-in, sign-out, etc.)
  if (isAuthRoute) {
    console.log('[Middleware] Auth route, allowing access');
    return NextResponse.next();
  }

  // Check authentication for protected routes
  if (isDashboardRoute || isSellerRoute || isBuyerRoute || isCreateProjectRoute) {
    if (!session?.user) {
      console.log('[Middleware] Unauthenticated user, redirecting to sign-in');

      // Redirect to sign-in with callback URL
      const signInUrl = new URL('/auth/signin', request.url);
      signInUrl.searchParams.set('callbackUrl', pathname);

      return NextResponse.redirect(signInUrl);
    }

    // Check seller-only routes
    if ((isSellerRoute || isCreateProjectRoute) && !session.user.isSeller) {
      console.log(
        '[Middleware] Non-seller accessing seller route, redirecting to dashboard'
      );

      // Redirect non-sellers to dashboard
      const dashboardUrl = new URL('/dashboard', request.url);
      return NextResponse.redirect(dashboardUrl);
    }

    console.log('[Middleware] Authenticated user, allowing access');
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
    /*
     * Match all routes except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public files (images, etc.)
     * - API routes (handle auth separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
