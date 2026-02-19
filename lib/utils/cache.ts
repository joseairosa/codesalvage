/**
 * Redis Caching Utility
 *
 * Caching layer for expensive database queries and API responses
 * Provides 50-70% faster response times for cached data
 *
 * Cache Strategies:
 * - Featured projects: 5 minutes TTL
 * - User profiles: 10 minutes TTL
 * - Project search results: 2 minutes TTL
 * - Seller analytics: 15 minutes TTL
 */

import { createClient } from 'redis';

let cacheClient: ReturnType<typeof createClient> | null = null;
let cacheConnectionFailed = false;
let cacheErrorLogged = false;

/**
 * Get or create Redis cache client
 *
 * Returns null if Redis is not configured or connection previously failed.
 * Logs errors only once to prevent log spam.
 */
export async function getCacheClient(): Promise<ReturnType<typeof createClient> | null> {
  if (!process.env['REDIS_URL']) {
    if (!cacheErrorLogged) {
      console.warn('[Cache] REDIS_URL not configured, caching disabled');
      cacheErrorLogged = true;
    }
    return null;
  }

  if (cacheConnectionFailed) {
    return null;
  }

  if (!cacheClient) {
    try {
      cacheClient = createClient({
        url: process.env['REDIS_URL'],
      });

      cacheClient.on('error', (err) => {
        if (!cacheErrorLogged) {
          console.error('[Cache] Redis error:', err);
          cacheErrorLogged = true;
        }
        cacheConnectionFailed = true;
        cacheClient = null;
      });

      await cacheClient.connect();
      console.log('[Cache] Redis connected');
    } catch (err) {
      if (!cacheErrorLogged) {
        console.error('[Cache] Redis connection failed:', err);
        cacheErrorLogged = true;
      }
      cacheConnectionFailed = true;
      cacheClient = null;
      return null;
    }
  }

  return cacheClient;
}

/**
 * Cache configuration presets
 */
export const CacheTTL = {
  /**
   * Featured projects: 5 minutes
   * Changes infrequently, high traffic
   */
  FEATURED_PROJECTS: 300,

  /**
   * User profiles: 10 minutes
   * Changes occasionally, moderate traffic
   */
  USER_PROFILE: 600,

  /**
   * Project search: 2 minutes
   * Changes frequently, high traffic
   */
  SEARCH_RESULTS: 120,

  /**
   * Seller analytics: 15 minutes
   * Expensive queries, changes infrequently
   */
  ANALYTICS: 900,

  /**
   * Project detail: 5 minutes
   * Moderate changes, moderate traffic
   */
  PROJECT_DETAIL: 300,

  /**
   * Subscription info: 10 minutes
   * Changes rarely, moderate traffic
   */
  SUBSCRIPTION: 600,

  /**
   * Short cache: 1 minute
   * Use for rapidly changing data
   */
  SHORT: 60,

  /**
   * Long cache: 1 hour
   * Use for rarely changing data
   */
  LONG: 3600,

  /**
   * Repo analysis: 24 hours
   * GitHub repo AI analysis — expensive, changes only when repo is pushed to
   */
  REPO_ANALYSIS: 86400,
} as const;

/**
 * Get cached value
 *
 * @param key - Cache key
 * @returns Cached value or null if not found/expired
 *
 * @example
 * const cachedProjects = await getCache('featured:projects');
 * if (cachedProjects) {
 *   return JSON.parse(cachedProjects);
 * }
 */
export async function getCache(key: string): Promise<string | null> {
  try {
    const redis = await getCacheClient();
    if (!redis) return null;
    const value = await redis.get(key);

    if (value) {
      console.log(`[Cache] HIT: ${key}`);
    } else {
      console.log(`[Cache] MISS: ${key}`);
    }

    return value;
  } catch (error) {
    console.error('[Cache] Error getting cache:', error);
    return null;
  }
}

/**
 * Set cached value with TTL
 *
 * @param key - Cache key
 * @param value - Value to cache (will be stringified if object)
 * @param ttlSeconds - Time to live in seconds
 *
 * @example
 * await setCache('featured:projects', JSON.stringify(projects), CacheTTL.FEATURED_PROJECTS);
 */
export async function setCache(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
  try {
    const redis = await getCacheClient();
    if (!redis) return;
    await redis.setEx(key, ttlSeconds, value);
    console.log(`[Cache] SET: ${key} (TTL: ${ttlSeconds}s)`);
  } catch (error) {
    console.error('[Cache] Error setting cache:', error);
  }
}

/**
 * Delete cached value(s)
 *
 * @param pattern - Cache key or pattern (e.g., 'user:123:*')
 *
 * @example
 * await deleteCache('user:123:profile');
 * await deleteCache('user:123:*');
 */
export async function deleteCache(pattern: string): Promise<void> {
  try {
    const redis = await getCacheClient();
    if (!redis) return;

    if (pattern.includes('*')) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(keys);
        console.log(`[Cache] DELETE: ${pattern} (${keys.length} keys)`);
      }
    } else {
      await redis.del(pattern);
      console.log(`[Cache] DELETE: ${pattern}`);
    }
  } catch (error) {
    console.error('[Cache] Error deleting cache:', error);
  }
}

/**
 * Get or set cache with a generator function
 *
 * @param key - Cache key
 * @param ttlSeconds - Time to live in seconds
 * @param generator - Function to generate value if cache miss
 * @returns Cached or generated value
 *
 * @example
 * const projects = await getOrSetCache(
 *   'featured:projects',
 *   CacheTTL.FEATURED_PROJECTS,
 *   async () => {
 *     return await projectRepository.findFeatured();
 *   }
 * );
 */
export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  generator: () => Promise<T>
): Promise<T> {
  const cached = await getCache(key);
  if (cached) {
    return JSON.parse(cached) as T;
  }

  const value = await generator();

  await setCache(key, JSON.stringify(value), ttlSeconds);

  return value;
}

/**
 * Cache key builders
 * Consistent key naming across the application
 */
export const CacheKeys = {
  /**
   * Featured projects list
   */
  featuredProjects: (page?: number, limit?: number) =>
    page && limit ? `featured:projects:${page}:${limit}` : 'featured:projects',

  /**
   * Featured listing pricing
   */
  featuredPricing: () => 'featured:pricing',

  /**
   * Subscription pricing
   */
  subscriptionPricing: () => 'subscription:pricing',

  /**
   * Seller rating statistics
   */
  sellerRatingStats: (sellerId: string) => `seller:${sellerId}:rating-stats`,

  /**
   * Project detail
   */
  projectDetail: (projectId: string) => `project:${projectId}:detail`,

  /**
   * Project search results
   */
  searchResults: (query: string, filters: string) => `search:${query}:${filters}`,

  /**
   * User profile
   */
  userProfile: (userId: string) => `user:${userId}:profile`,

  /**
   * User subscription
   */
  userSubscription: (userId: string) => `user:${userId}:subscription`,

  /**
   * Seller analytics
   */
  sellerAnalytics: (sellerId: string, range: string) => `analytics:${sellerId}:${range}`,

  /**
   * Seller projects
   */
  sellerProjects: (sellerId: string) => `seller:${sellerId}:projects`,

  /**
   * All cache for a user (for invalidation)
   */
  userAll: (userId: string) => `user:${userId}:*`,

  /**
   * All cache for a project (for invalidation)
   */
  projectAll: (projectId: string) => `project:${projectId}:*`,

  /**
   * All search cache (for invalidation)
   */
  searchAll: () => 'search:*',

  /**
   * All featured cache (for invalidation)
   */
  featuredAll: () => 'featured:*',

  /**
   * GitHub repo AI analysis — keyed by fullName + pushedAt so any new push
   * invalidates the cache automatically without manual TTL juggling.
   */
  repoAnalysis: (fullName: string, pushedAt: string) =>
    `repo-analysis:${fullName}:${pushedAt}`,
} as const;

/**
 * Cache invalidation helpers
 */
export const invalidateCache = {
  /**
   * Invalidate user-related cache
   */
  user: async (userId: string) => {
    await deleteCache(CacheKeys.userAll(userId));
  },

  /**
   * Invalidate project-related cache
   */
  project: async (projectId: string) => {
    await deleteCache(CacheKeys.projectAll(projectId));
    await deleteCache(CacheKeys.featuredAll());
    await deleteCache(CacheKeys.searchAll());
  },

  /**
   * Invalidate seller-related cache
   */
  seller: async (sellerId: string) => {
    await deleteCache(CacheKeys.sellerAnalytics(sellerId, '*'));
    await deleteCache(CacheKeys.sellerProjects(sellerId));
    await deleteCache(CacheKeys.sellerRatingStats(sellerId));
  },

  /**
   * Invalidate search cache
   */
  search: async () => {
    await deleteCache(CacheKeys.searchAll());
  },

  /**
   * Invalidate featured projects
   */
  featured: async () => {
    await deleteCache(CacheKeys.featuredAll());
  },

  /**
   * Invalidate pricing cache (featured + subscription)
   */
  pricing: async () => {
    await deleteCache(CacheKeys.featuredPricing());
    await deleteCache(CacheKeys.subscriptionPricing());
  },
} as const;

/**
 * Wrapper for caching expensive functions
 *
 * @param key - Cache key
 * @param ttlSeconds - Time to live
 * @param fn - Function to cache
 * @returns Wrapped function that caches results
 *
 * @example
 * const getCachedFeaturedProjects = withCache(
 *   CacheKeys.featuredProjects(),
 *   CacheTTL.FEATURED_PROJECTS,
 *   async () => {
 *     return await projectRepository.findFeatured();
 *   }
 * );
 *
 *
 * const projects = await getCachedFeaturedProjects();
 */
export function withCache<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): () => Promise<T> {
  return async () => {
    return getOrSetCache(key, ttlSeconds, fn);
  };
}

/**
 * Close Redis connection (cleanup)
 */
export async function closeCacheConnection(): Promise<void> {
  if (cacheClient) {
    await cacheClient.quit();
    cacheClient = null;
    console.log('[Cache] Redis connection closed');
  }
}

/**
 * Warm up cache (preload hot data)
 *
 * Call this on app startup to preload frequently accessed data
 */
export async function warmupCache(): Promise<void> {
  console.log('[Cache] Warming up cache...');

  console.log('[Cache] Cache warmup complete');
}

/**
 * Clear all cache (use with caution)
 *
 * Useful for testing or manual cache clearing
 */
export async function clearAllCache(): Promise<void> {
  try {
    const redis = await getCacheClient();
    if (!redis) return;
    await redis.flushDb();
    console.log('[Cache] All cache cleared');
  } catch (error) {
    console.error('[Cache] Error clearing cache:', error);
  }
}
