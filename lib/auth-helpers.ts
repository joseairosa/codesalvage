/**
 * Auth Helper Utilities
 *
 * Responsibilities:
 * - Provide reusable auth check functions for Server Components
 * - Provide reusable auth check functions for API routes
 * - Handle unauthorized access with proper errors
 * - Type-safe session access
 *
 * Architecture:
 * - Utility functions (not a class)
 * - Works with Auth.js v5 auth() helper
 * - Can be used in both Server Components and API routes
 *
 * @example
 * import { requireAuth, requireSeller } from '@/lib/auth-helpers';
 * const session = await requireAuth(); // Throws if not authenticated
 * const sellerSession = await requireSeller(); // Throws if not seller
 */

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';

/**
 * Custom error for unauthorized access
 */
export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Custom error for forbidden access (authenticated but not authorized)
 */
export class ForbiddenError extends Error {
  constructor(message: string = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Get current session (returns null if not authenticated)
 *
 * Use this when you want to conditionally show content based on auth state.
 *
 * @returns Session or null
 *
 * @example
 * const session = await getSession();
 * if (session) {
 *   // Show authenticated content
 * } else {
 *   // Show public content
 * }
 */
export async function getSession(): Promise<Session | null> {
  return await auth();
}

/**
 * Require authentication (throws/redirects if not authenticated)
 *
 * Use this in Server Components when you need authentication.
 * Automatically redirects to sign-in page.
 *
 * @param callbackUrl - Optional URL to redirect to after sign-in
 * @returns Session (guaranteed to exist)
 * @throws Redirects to sign-in if not authenticated
 *
 * @example
 * const session = await requireAuth();
 * // session is guaranteed to exist here
 */
export async function requireAuth(callbackUrl?: string): Promise<Session> {
  const session = await auth();

  if (!session?.user) {
    console.log('[AuthHelpers] requireAuth: User not authenticated, redirecting');

    // Redirect to sign-in with callback URL
    const signInUrl = callbackUrl
      ? `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : '/auth/signin';

    redirect(signInUrl);
  }

  return session;
}

/**
 * Require authentication for API routes (throws error if not authenticated)
 *
 * Use this in API routes where you can't redirect.
 * Throws UnauthorizedError that should be caught and returned as 401.
 *
 * @returns Session (guaranteed to exist)
 * @throws UnauthorizedError if not authenticated
 *
 * @example
 * // In API route
 * try {
 *   const session = await requireAuthApi();
 *   // Process request
 * } catch (error) {
 *   if (error instanceof UnauthorizedError) {
 *     return new Response('Unauthorized', { status: 401 });
 *   }
 *   throw error;
 * }
 */
export async function requireAuthApi(): Promise<Session> {
  const session = await auth();

  if (!session?.user) {
    console.log('[AuthHelpers] requireAuthApi: User not authenticated');
    throw new UnauthorizedError('Authentication required');
  }

  return session;
}

/**
 * Require seller role (throws/redirects if not seller)
 *
 * Use this in Server Components for seller-only pages.
 * Redirects to dashboard if user is not a seller.
 *
 * @returns Session (guaranteed to exist and user is seller)
 * @throws Redirects to dashboard if not seller
 *
 * @example
 * const session = await requireSeller();
 * // session.user.isSeller is guaranteed to be true
 */
export async function requireSeller(): Promise<Session> {
  const session = await requireAuth();

  if (!session.user.isSeller) {
    console.log('[AuthHelpers] requireSeller: User is not a seller, redirecting');
    redirect('/dashboard');
  }

  return session;
}

/**
 * Require seller role for API routes (throws error if not seller)
 *
 * Use this in API routes for seller-only endpoints.
 * Throws ForbiddenError if user is authenticated but not a seller.
 *
 * @returns Session (guaranteed to exist and user is seller)
 * @throws UnauthorizedError if not authenticated
 * @throws ForbiddenError if not seller
 *
 * @example
 * // In API route
 * try {
 *   const session = await requireSellerApi();
 *   // Process seller-only request
 * } catch (error) {
 *   if (error instanceof UnauthorizedError) {
 *     return new Response('Unauthorized', { status: 401 });
 *   }
 *   if (error instanceof ForbiddenError) {
 *     return new Response('Forbidden - Seller access required', { status: 403 });
 *   }
 *   throw error;
 * }
 */
export async function requireSellerApi(): Promise<Session> {
  const session = await requireAuthApi();

  if (!session.user.isSeller) {
    console.log('[AuthHelpers] requireSellerApi: User is not a seller');
    throw new ForbiddenError('Seller access required');
  }

  return session;
}

/**
 * Require verified seller role (throws/redirects if not verified)
 *
 * Use this for features that require seller verification.
 *
 * @returns Session (guaranteed to exist and user is verified seller)
 * @throws Redirects to seller verification page if not verified
 *
 * @example
 * const session = await requireVerifiedSeller();
 * // session.user.isVerifiedSeller is guaranteed to be true
 */
export async function requireVerifiedSeller(): Promise<Session> {
  const session = await requireSeller();

  if (!session.user.isVerifiedSeller) {
    console.log('[AuthHelpers] requireVerifiedSeller: Seller not verified, redirecting');
    redirect('/seller/verify');
  }

  return session;
}

/**
 * Check if user is authenticated (boolean check)
 *
 * Use this when you need a simple boolean check without redirects.
 *
 * @returns true if authenticated
 *
 * @example
 * const isAuthenticated = await isAuth();
 * if (isAuthenticated) {
 *   // Show authenticated features
 * }
 */
export async function isAuth(): Promise<boolean> {
  const session = await auth();
  return !!session?.user;
}

/**
 * Check if user is a seller (boolean check)
 *
 * @returns true if user is a seller
 *
 * @example
 * const canCreateProject = await isSeller();
 * if (canCreateProject) {
 *   // Show "Create Project" button
 * }
 */
export async function isSeller(): Promise<boolean> {
  const session = await auth();
  return !!session?.user?.isSeller;
}

/**
 * Check if user is a verified seller (boolean check)
 *
 * @returns true if user is a verified seller
 *
 * @example
 * const isVerified = await isVerifiedSeller();
 * if (isVerified) {
 *   // Show verified badge
 * }
 */
export async function isVerifiedSeller(): Promise<boolean> {
  const session = await auth();
  return !!session?.user?.isVerifiedSeller;
}

/**
 * Get user ID from session (convenience helper)
 *
 * @returns User ID or null if not authenticated
 *
 * @example
 * const userId = await getUserId();
 * if (userId) {
 *   // Fetch user-specific data
 * }
 */
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
