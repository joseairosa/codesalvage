/**
 * Rate Limiting Utility
 *
 * Redis-based rate limiting for API routes and authentication endpoints
 * Prevents abuse, brute force attacks, and DoS
 *
 * Usage:
 * - Auth endpoints: 5 attempts / 15 minutes per IP
 * - API endpoints: 100 requests / minute per user
 * - Public endpoints: 1000 requests / hour per IP
 */

import { createClient } from 'redis';
import { type NextRequest, NextResponse } from 'next/server';

// Redis client singleton
let redisClient: ReturnType<typeof createClient> | null = null;

/**
 * Get or create Redis client
 */
async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env['REDIS_URL'] || 'redis://localhost:6379',
    });

    redisClient.on('error', (err) => {
      console.error('[RateLimit] Redis error:', err);
    });

    await redisClient.connect();
    console.log('[RateLimit] Redis connected');
  }

  return redisClient;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /**
   * Maximum number of requests allowed
   */
  maxRequests: number;

  /**
   * Time window in seconds
   */
  windowSeconds: number;

  /**
   * Unique identifier (IP address, user ID, etc.)
   */
  identifier: string;

  /**
   * Namespace for Redis keys (e.g., 'auth', 'api', 'public')
   */
  namespace: string;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /**
   * Whether the request is allowed
   */
  allowed: boolean;

  /**
   * Remaining requests in current window
   */
  remaining: number;

  /**
   * Total requests allowed in window
   */
  limit: number;

  /**
   * Seconds until window resets
   */
  resetSeconds: number;

  /**
   * Current request count
   */
  currentCount: number;
}

/**
 * Check if request is within rate limit
 *
 * @param config - Rate limit configuration
 * @returns Rate limit result
 *
 * @example
 * const result = await checkRateLimit({
 *   maxRequests: 5,
 *   windowSeconds: 900, // 15 minutes
 *   identifier: req.ip,
 *   namespace: 'auth',
 * });
 *
 * if (!result.allowed) {
 *   return NextResponse.json(
 *     { error: 'Too many requests', retryAfter: result.resetSeconds },
 *     { status: 429 }
 *   );
 * }
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const { maxRequests, windowSeconds, identifier, namespace } = config;

  try {
    const redis = await getRedisClient();
    const key = `ratelimit:${namespace}:${identifier}`;

    // Get current count
    const currentCount = await redis.get(key);
    const count = currentCount ? parseInt(currentCount, 10) : 0;

    // Check if limit exceeded
    if (count >= maxRequests) {
      const ttl = await redis.ttl(key);
      return {
        allowed: false,
        remaining: 0,
        limit: maxRequests,
        resetSeconds: ttl > 0 ? ttl : windowSeconds,
        currentCount: count,
      };
    }

    // Increment counter
    const newCount = count + 1;
    if (count === 0) {
      // First request in window - set with expiration
      await redis.setEx(key, windowSeconds, newCount.toString());
    } else {
      // Increment existing counter
      await redis.incr(key);
    }

    const ttl = await redis.ttl(key);

    return {
      allowed: true,
      remaining: maxRequests - newCount,
      limit: maxRequests,
      resetSeconds: ttl > 0 ? ttl : windowSeconds,
      currentCount: newCount,
    };
  } catch (error) {
    console.error('[RateLimit] Error checking rate limit:', error);

    // Fail open - allow request if Redis is down
    // This prevents rate limiting from breaking the app
    return {
      allowed: true,
      remaining: maxRequests,
      limit: maxRequests,
      resetSeconds: windowSeconds,
      currentCount: 0,
    };
  }
}

/**
 * Rate limit presets for common use cases
 */
export const RateLimitPresets = {
  /**
   * Auth endpoints: 5 attempts / 15 minutes per IP
   * Use for login, signup, password reset
   */
  auth: {
    maxRequests: 5,
    windowSeconds: 900, // 15 minutes
    namespace: 'auth',
  },

  /**
   * API endpoints: 100 requests / minute per user
   * Use for authenticated API routes
   */
  api: {
    maxRequests: 100,
    windowSeconds: 60, // 1 minute
    namespace: 'api',
  },

  /**
   * Public endpoints: 1000 requests / hour per IP
   * Use for public API routes (search, browse)
   */
  public: {
    maxRequests: 1000,
    windowSeconds: 3600, // 1 hour
    namespace: 'public',
  },

  /**
   * Strict endpoints: 10 requests / hour per IP
   * Use for sensitive operations (admin, export, bulk actions)
   */
  strict: {
    maxRequests: 10,
    windowSeconds: 3600, // 1 hour
    namespace: 'strict',
  },
};

/**
 * Get client IP address from request
 *
 * @param request - Next.js request object
 * @returns IP address or 'unknown'
 */
export function getClientIP(request: NextRequest): string {
  // Check X-Forwarded-For (most common proxy header)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Return first IP in list (client IP)
    const firstIP = forwardedFor.split(',')[0];
    if (firstIP) {
      return firstIP.trim();
    }
  }

  // Check X-Real-IP (Nginx)
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Fallback to 'unknown' (should rarely happen)
  return 'unknown';
}

/**
 * Apply rate limiting to Next.js API route
 *
 * @param request - Next.js request object
 * @param preset - Rate limit preset (auth, api, public, strict)
 * @param identifier - Optional custom identifier (defaults to IP or user ID)
 * @returns Rate limit result or error response
 *
 * @example
 * // In API route
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = await applyRateLimit(request, 'auth');
 *   if (rateLimitResult instanceof NextResponse) {
 *     return rateLimitResult; // Rate limit exceeded
 *   }
 *
 *   // Continue with request...
 * }
 */
export async function applyRateLimit(
  request: NextRequest,
  preset: keyof typeof RateLimitPresets,
  identifier?: string
): Promise<RateLimitResult | NextResponse> {
  const config = RateLimitPresets[preset];

  // Use custom identifier or default to IP
  const id = identifier || getClientIP(request);

  const result = await checkRateLimit({
    ...config,
    identifier: id,
  });

  if (!result.allowed) {
    console.warn(`[RateLimit] Rate limit exceeded for ${preset}:${id}`, {
      currentCount: result.currentCount,
      limit: result.limit,
      resetSeconds: result.resetSeconds,
    });

    return NextResponse.json(
      {
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${result.resetSeconds} seconds.`,
        retryAfter: result.resetSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': result.resetSeconds.toString(),
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetSeconds.toString(),
        },
      }
    );
  }

  // Add rate limit headers to successful responses
  // (will be added by caller after processing request)
  return result;
}

/**
 * Add rate limit headers to response
 *
 * @param response - Next.js response object
 * @param result - Rate limit result
 * @returns Response with rate limit headers
 *
 * @example
 * const result = await applyRateLimit(request, 'api');
 * const response = NextResponse.json({ data });
 * return addRateLimitHeaders(response, result);
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.resetSeconds.toString());
  return response;
}

/**
 * Clear rate limit for identifier (admin use)
 *
 * @param namespace - Namespace (auth, api, public)
 * @param identifier - Identifier to clear
 *
 * @example
 * await clearRateLimit('auth', '192.168.1.1');
 */
export async function clearRateLimit(namespace: string, identifier: string): Promise<void> {
  try {
    const redis = await getRedisClient();
    const key = `ratelimit:${namespace}:${identifier}`;
    await redis.del(key);
    console.log(`[RateLimit] Cleared rate limit for ${namespace}:${identifier}`);
  } catch (error) {
    console.error('[RateLimit] Error clearing rate limit:', error);
  }
}

/**
 * Close Redis connection (cleanup)
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log('[RateLimit] Redis connection closed');
  }
}
