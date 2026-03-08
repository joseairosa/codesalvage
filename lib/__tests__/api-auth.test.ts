/**
 * api-auth.ts Tests
 *
 * Verifies that authenticateApiRequest:
 * - Uses verifyFirebaseSessionCookie (not verifyFirebaseToken) for the cookie path
 * - Uses verifyAuth for the Authorization header path
 * - Returns null when both paths fail
 *
 * Verifies that requireAdminApiAuth:
 * - Returns null when not authenticated
 * - Returns null when authenticated but not admin
 * - Returns the auth result when authenticated as admin
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCookies, mockVerifyFirebaseSessionCookie, mockVerifyAuth } = vi.hoisted(
  () => ({
    mockCookies: vi.fn(),
    mockVerifyFirebaseSessionCookie: vi.fn(),
    mockVerifyAuth: vi.fn(),
  })
);

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

vi.mock('@/lib/firebase-auth', () => ({
  verifyFirebaseSessionCookie: mockVerifyFirebaseSessionCookie,
  verifyAuth: mockVerifyAuth,
}));

import { authenticateApiRequest, requireAdminApiAuth } from '../api-auth';

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  username: 'testuser',
  githubUsername: null,
  isSeller: false,
  isVerifiedSeller: false,
  isAdmin: false,
  isBanned: false,
  avatarUrl: null,
};

function makeRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) headers.set('authorization', authHeader);
  return new Request('http://localhost/api/test', { headers });
}

function mockCookieStore(sessionValue: string | undefined) {
  mockCookies.mockResolvedValue({
    get: (name: string) => (name === 'session' ? { value: sessionValue } : undefined),
  });
}

describe('authenticateApiRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('cookie path', () => {
    it('calls verifyFirebaseSessionCookie when session cookie is present', async () => {
      mockCookieStore('session-cookie-value');
      mockVerifyFirebaseSessionCookie.mockResolvedValue({ user: mockUser });

      const result = await authenticateApiRequest(makeRequest());

      expect(mockVerifyFirebaseSessionCookie).toHaveBeenCalledWith(
        'session-cookie-value'
      );
      expect(result).toEqual({ user: mockUser });
    });

    it('returns auth result from session cookie without trying Authorization header', async () => {
      mockCookieStore('session-cookie-value');
      mockVerifyFirebaseSessionCookie.mockResolvedValue({ user: mockUser });

      await authenticateApiRequest(makeRequest('Bearer some-token'));

      expect(mockVerifyFirebaseSessionCookie).toHaveBeenCalledTimes(1);
      expect(mockVerifyAuth).not.toHaveBeenCalled();
    });

    it('falls through to Authorization header when session cookie auth fails', async () => {
      mockCookieStore('bad-session-cookie');
      mockVerifyFirebaseSessionCookie.mockRejectedValue(new Error('Invalid session'));
      mockVerifyAuth.mockResolvedValue({ user: mockUser });

      const result = await authenticateApiRequest(makeRequest('Bearer valid-token'));

      expect(mockVerifyAuth).toHaveBeenCalledWith('Bearer valid-token');
      expect(result).toEqual({ user: mockUser });
    });
  });

  describe('Authorization header path', () => {
    it('calls verifyAuth when no session cookie is present', async () => {
      mockCookieStore(undefined);
      mockVerifyAuth.mockResolvedValue({ user: mockUser });

      const result = await authenticateApiRequest(makeRequest('Bearer some-token'));

      expect(mockVerifyAuth).toHaveBeenCalledWith('Bearer some-token');
      expect(result).toEqual({ user: mockUser });
    });
  });

  describe('failure cases', () => {
    it('returns null when both cookie and Authorization header are absent', async () => {
      mockCookieStore(undefined);

      const result = await authenticateApiRequest(makeRequest());

      expect(result).toBeNull();
    });

    it('returns null when cookie fails and no Authorization header is present', async () => {
      mockCookieStore('bad-cookie');
      mockVerifyFirebaseSessionCookie.mockRejectedValue(new Error('Bad session'));

      const result = await authenticateApiRequest(makeRequest());

      expect(result).toBeNull();
    });

    it('returns null when both cookie and Authorization header auth fail', async () => {
      mockCookieStore('bad-cookie');
      mockVerifyFirebaseSessionCookie.mockRejectedValue(new Error('Bad session'));
      mockVerifyAuth.mockRejectedValue(new Error('Bad token'));

      const result = await authenticateApiRequest(makeRequest('Bearer bad-token'));

      expect(result).toBeNull();
    });
  });
});

describe('requireAdminApiAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when not authenticated', async () => {
    mockCookieStore(undefined);

    const result = await requireAdminApiAuth(makeRequest());

    expect(result).toBeNull();
  });

  it('returns null when authenticated but not admin', async () => {
    mockCookieStore('session-cookie-value');
    mockVerifyFirebaseSessionCookie.mockResolvedValue({
      user: { ...mockUser, isAdmin: false },
    });

    const result = await requireAdminApiAuth(makeRequest());

    expect(result).toBeNull();
  });

  it('returns auth result when authenticated as admin', async () => {
    const adminUser = { ...mockUser, isAdmin: true };
    mockCookieStore('session-cookie-value');
    mockVerifyFirebaseSessionCookie.mockResolvedValue({ user: adminUser });

    const result = await requireAdminApiAuth(makeRequest());

    expect(result).toEqual({ user: adminUser });
  });
});
