/**
 * withRateLimit Middleware Tests
 *
 * Tests for the HOF wrappers that apply rate limiting to API route handlers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { mockApplyRateLimit, mockAddRateLimitHeaders } = vi.hoisted(() => ({
  mockApplyRateLimit: vi.fn(),
  mockAddRateLimitHeaders: vi.fn(),
}));

vi.mock('@/lib/utils/rateLimit', () => ({
  applyRateLimit: mockApplyRateLimit,
  addRateLimitHeaders: mockAddRateLimitHeaders,
  RateLimitPresets: {
    auth: { maxRequests: 5, windowSeconds: 900, namespace: 'auth' },
    api: { maxRequests: 100, windowSeconds: 60, namespace: 'api' },
    public: { maxRequests: 1000, windowSeconds: 3600, namespace: 'public' },
    strict: { maxRequests: 10, windowSeconds: 3600, namespace: 'strict' },
  },
}));

import {
  withRateLimit,
  withAuthRateLimit,
  withApiRateLimit,
  withPublicRateLimit,
  withStrictRateLimit,
} from '../withRateLimit';

const allowedResult = {
  allowed: true,
  remaining: 99,
  limit: 100,
  resetSeconds: 60,
  currentCount: 1,
};

const deniedResponse = NextResponse.json(
  { error: 'Too many requests', retryAfter: 60 },
  { status: 429 }
);

function makeRequest(url = 'http://localhost/api/test') {
  return new NextRequest(url, { method: 'GET' });
}

describe('withRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddRateLimitHeaders.mockImplementation((response) => response);
  });

  it('calls handler and returns response when rate limit not exceeded', async () => {
    mockApplyRateLimit.mockResolvedValue(allowedResult);

    const handlerResponse = NextResponse.json({ data: 'ok' }, { status: 200 });
    const handler = vi.fn().mockResolvedValue(handlerResponse);

    const wrapped = withRateLimit(handler, 'api');
    const request = makeRequest();
    const result = await wrapped(request);

    expect(handler).toHaveBeenCalledWith(request, undefined);
    expect(result.status).toBe(200);
    expect(mockAddRateLimitHeaders).toHaveBeenCalledWith(handlerResponse, allowedResult);
  });

  it('returns 429 and does not call handler when rate limit exceeded', async () => {
    mockApplyRateLimit.mockResolvedValue(deniedResponse);

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ data: 'ok' }));

    const wrapped = withRateLimit(handler, 'api');
    const result = await wrapped(makeRequest());

    expect(handler).not.toHaveBeenCalled();
    expect(result.status).toBe(429);
  });

  it('passes context (dynamic route params) through to handler', async () => {
    mockApplyRateLimit.mockResolvedValue(allowedResult);

    const handlerResponse = NextResponse.json({ ok: true });
    const handler = vi.fn().mockResolvedValue(handlerResponse);
    const context = { params: Promise.resolve({ id: 'abc-123' }) };

    const wrapped = withRateLimit(handler, 'api');
    const request = makeRequest();
    await wrapped(request, context);

    expect(handler).toHaveBeenCalledWith(request, context);
  });

  it('uses custom identifier when getIdentifier is provided', async () => {
    mockApplyRateLimit.mockResolvedValue(allowedResult);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({}));

    const getIdentifier = vi.fn().mockResolvedValue('user-42');

    const wrapped = withRateLimit(handler, 'api', getIdentifier);
    await wrapped(makeRequest());

    expect(getIdentifier).toHaveBeenCalled();
    expect(mockApplyRateLimit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      'api',
      'user-42'
    );
  });

  it('uses undefined identifier when no getIdentifier provided (falls back to IP)', async () => {
    mockApplyRateLimit.mockResolvedValue(allowedResult);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({}));

    const wrapped = withRateLimit(handler, 'api');
    await wrapped(makeRequest());

    expect(mockApplyRateLimit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      'api',
      undefined
    );
  });
});

describe('withAuthRateLimit', () => {
  it('applies auth preset', async () => {
    mockApplyRateLimit.mockResolvedValue(allowedResult);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({}));

    const wrapped = withAuthRateLimit(handler);
    await wrapped(makeRequest());

    expect(mockApplyRateLimit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      'auth',
      undefined
    );
  });
});

describe('withApiRateLimit', () => {
  it('applies api preset', async () => {
    mockApplyRateLimit.mockResolvedValue(allowedResult);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({}));

    const wrapped = withApiRateLimit(handler);
    await wrapped(makeRequest());

    expect(mockApplyRateLimit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      'api',
      undefined
    );
  });

  it('passes custom identifier function', async () => {
    mockApplyRateLimit.mockResolvedValue(allowedResult);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({}));
    const getId = vi.fn().mockReturnValue('user-99');

    const wrapped = withApiRateLimit(handler, getId);
    await wrapped(makeRequest());

    expect(mockApplyRateLimit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      'api',
      'user-99'
    );
  });
});

describe('withPublicRateLimit', () => {
  it('applies public preset', async () => {
    mockApplyRateLimit.mockResolvedValue(allowedResult);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({}));

    const wrapped = withPublicRateLimit(handler);
    await wrapped(makeRequest());

    expect(mockApplyRateLimit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      'public',
      undefined
    );
  });
});

describe('withStrictRateLimit', () => {
  it('applies strict preset', async () => {
    mockApplyRateLimit.mockResolvedValue(allowedResult);
    const handler = vi.fn().mockResolvedValue(NextResponse.json({}));

    const wrapped = withStrictRateLimit(handler);
    await wrapped(makeRequest());

    expect(mockApplyRateLimit).toHaveBeenCalledWith(
      expect.any(NextRequest),
      'strict',
      undefined
    );
  });
});
