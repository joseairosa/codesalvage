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

let redisClient: ReturnType<typeof createClient> | null = null;
let redisConnectionFailed = false;
let redisErrorLogged = false;

/**
 * Get or create Redis client
 *
 * Returns null if Redis is not configured or connection previously failed.
 * Logs errors only once to prevent log spam.
 */
async function getRedisClient(): Promise<ReturnType<typeof createClient> | null> {
  if (!process.env['REDIS_URL']) {
    if (!redisErrorLogged) {
      console.warn('[RateLimit] REDIS_URL not configured, rate limiting disabled');
      redisErrorLogged = true;
    }
    return null;
  }

  if (redisConnectionFailed) {
    return null;
  }

  if (!redisClient) {
    try {
      redisClient = createClient({
        url: process.env['REDIS_URL'],
      });

      redisClient.on('error', (err) => {
        if (!redisErrorLogged) {
          console.error('[RateLimit] Redis error:', err);
          redisErrorLogged = true;
        }
        redisConnectionFailed = true;
        redisClient = null;
      });

      await redisClient.connect();
      console.log('[RateLimit] Redis connected');
    } catch (err) {
      if (!redisErrorLogged) {
        console.error('[RateLimit] Redis connection failed:', err);
        redisErrorLogged = true;
      }
      redisConnectionFailed = true;
      redisClient = null;
      return null;
    }
  }

  return redisClient;
}

/**
 * In-memory fallback rate limiter
 *
 * Activates when Redis is unavailable. Uses a more generous limit
 * (5x the normal limit) since it's per-instance only and loses state
 * on restart. Provides basic abuse protection rather than no protection.
 */
const fallbackLimitMap = new Map<string, { count: number; resetAt: number }>();
const FALLBACK_MULTIPLIER = 5;

function checkFallbackRateLimit(config: {
  maxRequests: number;
  windowSeconds: number;
  identifier: string;
}): RateLimitResult {
  const now = Date.now();
  const key = `${config.identifier}`;
  const entry = fallbackLimitMap.get(key);
  const fallbackMax = config.maxRequests * FALLBACK_MULTIPLIER;
  const windowMs = config.windowSeconds * 1000;

  if (Math.random() < 0.01) {
    fallbackLimitMap.forEach((v, k) => {
      if (now > v.resetAt) fallbackLimitMap.delete(k);
    });
  }

  if (!entry || now > entry.resetAt) {
    fallbackLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: fallbackMax - 1,
      limit: fallbackMax,
      resetSeconds: config.windowSeconds,
      currentCount: 1,
    };
  }

  if (entry.count >= fallbackMax) {
    const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      limit: fallbackMax,
      resetSeconds: resetSeconds > 0 ? resetSeconds : config.windowSeconds,
      currentCount: entry.count,
    };
  }

  entry.count++;
  const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);
  return {
    allowed: true,
    remaining: fallbackMax - entry.count,
    limit: fallbackMax,
    resetSeconds: resetSeconds > 0 ? resetSeconds : config.windowSeconds,
    currentCount: entry.count,
  };
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
 *   windowSeconds: 900,
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

    if (!redis) {
      return checkFallbackRateLimit({ maxRequests, windowSeconds, identifier });
    }

    const key = `ratelimit:${namespace}:${identifier}`;

    const currentCount = await redis.get(key);
    const count = currentCount ? parseInt(currentCount, 10) : 0;

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

    const newCount = count + 1;
    if (count === 0) {
      await redis.setEx(key, windowSeconds, newCount.toString());
    } else {
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
    console.error('[RateLimit] Error checking rate limit, using fallback:', error);

    return checkFallbackRateLimit({ maxRequests, windowSeconds, identifier });
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
    windowSeconds: 900,
    namespace: 'auth',
  },

  /**
   * API endpoints: 100 requests / minute per user
   * Use for authenticated API routes
   */
  api: {
    maxRequests: 100,
    windowSeconds: 60,
    namespace: 'api',
  },

  /**
   * Public endpoints: 1000 requests / hour per IP
   * Use for public API routes (search, browse)
   */
  public: {
    maxRequests: 1000,
    windowSeconds: 3600,
    namespace: 'public',
  },

  /**
   * Strict endpoints: 10 requests / hour per IP
   * Use for sensitive operations (admin, export, bulk actions)
   */
  strict: {
    maxRequests: 10,
    windowSeconds: 3600,
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
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIP = forwardedFor.split(',')[0];
    if (firstIP) {
      return firstIP.trim();
    }
  }

  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

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
 *
 * export async function POST(request: NextRequest) {
 *   const rateLimitResult = await applyRateLimit(request, 'auth');
 *   if (rateLimitResult instanceof NextResponse) {
 *     return rateLimitResult;
 *   }
 *
 *
 * }
 */
export async function applyRateLimit(
  request: NextRequest,
  preset: keyof typeof RateLimitPresets,
  identifier?: string
): Promise<RateLimitResult | NextResponse> {
  const config = RateLimitPresets[preset];

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
export async function clearRateLimit(
  namespace: string,
  identifier: string
): Promise<void> {
  try {
    const redis = await getRedisClient();
    if (!redis) return;
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
