/**
 * Rate Limit Utility Tests
 *
 * Tests for the in-memory fallback rate limiter that activates
 * when Redis is unavailable, ensuring basic abuse protection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('redis', () => ({
  createClient: vi.fn(() => ({
    on: vi.fn(),
    connect: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
    get: vi.fn(),
    set: vi.fn(),
    setEx: vi.fn(),
    incr: vi.fn(),
    ttl: vi.fn(),
    del: vi.fn(),
    ping: vi.fn(),
    quit: vi.fn(),
  })),
}));

vi.stubEnv('REDIS_URL', 'redis://localhost:6391');

import { checkRateLimit, type RateLimitConfig } from '../rateLimit';

describe('Rate Limit Fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkRateLimit with Redis unavailable', () => {
    it('should allow requests when under fallback limit', async () => {
      const config: RateLimitConfig = {
        maxRequests: 5,
        windowSeconds: 900,
        identifier: 'test-fallback-allow',
        namespace: 'test',
      };

      const result = await checkRateLimit(config);

      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBeGreaterThanOrEqual(0);
    });

    it('should enforce fallback limit after exceeding threshold', async () => {
      const config: RateLimitConfig = {
        maxRequests: 2,
        windowSeconds: 900,
        identifier: 'test-fallback-exceed',
        namespace: 'test',
      };

      const fallbackLimit = 2 * 5;

      for (let i = 0; i < fallbackLimit; i++) {
        const result = await checkRateLimit(config);
        expect(result.allowed).toBe(true);
      }

      const denied = await checkRateLimit(config);
      expect(denied.allowed).toBe(false);
      expect(denied.remaining).toBe(0);
    });

    it('should track remaining requests correctly', async () => {
      const config: RateLimitConfig = {
        maxRequests: 3,
        windowSeconds: 60,
        identifier: 'test-fallback-remaining',
        namespace: 'test',
      };

      const fallbackLimit = 3 * 5;

      const first = await checkRateLimit(config);
      expect(first.allowed).toBe(true);
      expect(first.limit).toBe(fallbackLimit);
      expect(first.remaining).toBe(fallbackLimit - 1);
    });

    it('should use different counters for different identifiers', async () => {
      const config1: RateLimitConfig = {
        maxRequests: 1,
        windowSeconds: 900,
        identifier: 'user-a-isolation',
        namespace: 'test',
      };

      const config2: RateLimitConfig = {
        maxRequests: 1,
        windowSeconds: 900,
        identifier: 'user-b-isolation',
        namespace: 'test',
      };

      for (let i = 0; i < 5; i++) {
        await checkRateLimit(config1);
      }
      const deniedA = await checkRateLimit(config1);
      expect(deniedA.allowed).toBe(false);

      const allowedB = await checkRateLimit(config2);
      expect(allowedB.allowed).toBe(true);
    });

    it('should return resetSeconds based on window configuration', async () => {
      const config: RateLimitConfig = {
        maxRequests: 5,
        windowSeconds: 300,
        identifier: 'test-fallback-reset',
        namespace: 'test',
      };

      const result = await checkRateLimit(config);
      expect(result.resetSeconds).toBeGreaterThan(0);
      expect(result.resetSeconds).toBeLessThanOrEqual(300);
    });
  });
});
