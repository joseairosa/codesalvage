/**
 * GET /api/auth/me Route Tests
 *
 * Verifies that the session endpoint returns the correct user shape,
 * including avatarUrl so the nav bar can display the user's avatar.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCookies, mockVerifyFirebaseSessionCookie } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
  mockVerifyFirebaseSessionCookie: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

vi.mock('@/lib/firebase-auth', () => ({
  verifyFirebaseSessionCookie: mockVerifyFirebaseSessionCookie,
}));

import { GET } from '../route';

const baseUser = {
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

function mockCookieStore(sessionValue: string | undefined) {
  mockCookies.mockResolvedValue({
    get: (name: string) => (name === 'session' ? { value: sessionValue } : undefined),
  });
}

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns user: null when no session cookie is present', async () => {
    mockCookieStore(undefined);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ user: null });
  });

  it('returns full user object including avatarUrl when session is valid', async () => {
    mockCookieStore('valid-token');
    mockVerifyFirebaseSessionCookie.mockResolvedValue({ user: { ...baseUser, avatarUrl: null } });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user).toMatchObject({
      id: 'user-123',
      email: 'test@example.com',
      username: 'testuser',
      avatarUrl: null,
    });
  });

  it('returns avatarUrl when user has an avatar set', async () => {
    const avatarUrl = 'https://r2.example.com/avatars/user-123.png';
    mockCookieStore('valid-token');
    mockVerifyFirebaseSessionCookie.mockResolvedValue({
      user: { ...baseUser, avatarUrl },
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.user.avatarUrl).toBe(avatarUrl);
  });

  it('returns user: null when token verification fails', async () => {
    mockCookieStore('bad-token');
    mockVerifyFirebaseSessionCookie.mockRejectedValue(new Error('Token expired'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ user: null });
  });
});
