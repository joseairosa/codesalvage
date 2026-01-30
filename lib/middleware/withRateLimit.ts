/**
 * Rate Limit Middleware
 *
 * Higher-order function to wrap API routes with rate limiting
 * Makes it easy to apply rate limiting to any route handler
 */

import { type NextRequest, NextResponse } from 'next/server';
import {
  applyRateLimit,
  addRateLimitHeaders,
  type RateLimitPresets,
} from '@/lib/utils/rateLimit';

type RouteHandler = (request: NextRequest, context?: any) => Promise<NextResponse>;

/**
 * Wrap API route with rate limiting
 *
 * @param handler - Route handler function
 * @param preset - Rate limit preset (auth, api, public, strict)
 * @param getIdentifier - Optional function to extract custom identifier
 * @returns Wrapped handler with rate limiting
 *
 * @example
 * // Apply auth rate limiting (5 requests / 15 minutes)
 * export const POST = withRateLimit(
 *   async (request: NextRequest) => {
 *     // Your route logic here
 *     return NextResponse.json({ success: true });
 *   },
 *   'auth'
 * );
 *
 * @example
 * // Apply API rate limiting with user ID
 * export const GET = withRateLimit(
 *   async (request: NextRequest) => {
 *     // Your route logic here
 *     return NextResponse.json({ data: [] });
 *   },
 *   'api',
 *   async (request) => {
 *     const session = await auth();
 *     return session?.user?.id || getClientIP(request);
 *   }
 * );
 */
export function withRateLimit(
  handler: RouteHandler,
  preset: keyof typeof RateLimitPresets,
  getIdentifier?: (request: NextRequest) => Promise<string> | string
): RouteHandler {
  return async (request: NextRequest, context?: any) => {
    // Get identifier (custom or default to IP)
    const identifier = getIdentifier ? await getIdentifier(request) : undefined;

    // Apply rate limiting
    const result = await applyRateLimit(request, preset, identifier);

    // If rate limit exceeded, return error response
    if (result instanceof NextResponse) {
      return result;
    }

    // Execute original handler
    const response = await handler(request, context);

    // Add rate limit headers to response
    return addRateLimitHeaders(response, result);
  };
}

/**
 * Convenience wrappers for common rate limit presets
 */

/**
 * Apply auth rate limiting (5 requests / 15 minutes)
 * Use for login, signup, password reset endpoints
 */
export function withAuthRateLimit(handler: RouteHandler): RouteHandler {
  return withRateLimit(handler, 'auth');
}

/**
 * Apply API rate limiting (100 requests / minute per user)
 * Use for authenticated API endpoints
 */
export function withApiRateLimit(
  handler: RouteHandler,
  getIdentifier?: (request: NextRequest) => Promise<string> | string
): RouteHandler {
  return withRateLimit(handler, 'api', getIdentifier);
}

/**
 * Apply public rate limiting (1000 requests / hour per IP)
 * Use for public endpoints (search, browse, etc.)
 */
export function withPublicRateLimit(handler: RouteHandler): RouteHandler {
  return withRateLimit(handler, 'public');
}

/**
 * Apply strict rate limiting (10 requests / hour per IP)
 * Use for sensitive operations (admin, export, bulk actions)
 */
export function withStrictRateLimit(handler: RouteHandler): RouteHandler {
  return withRateLimit(handler, 'strict');
}
