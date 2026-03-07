/**
 * PATCH /api/user/avatar — Unit Tests
 *
 * Tests avatar URL update endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockUserUpdate, mockAuthenticateApiRequest } = vi.hoisted(() => ({
  mockUserUpdate: vi.fn(),
  mockAuthenticateApiRequest: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      update: mockUserUpdate,
    },
  },
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mockAuthenticateApiRequest,
}));

import { PATCH } from '../route';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/user/avatar', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/user/avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when unauthenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue(null);

    const response = await PATCH(
      makeRequest({ avatarUrl: 'https://example.com/img.png' })
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('should update avatar URL and return 200', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-123' },
    });
    mockUserUpdate.mockResolvedValue({
      id: 'user-123',
      avatarUrl: 'https://r2.example.com/avatar.png',
    });

    const response = await PATCH(
      makeRequest({ avatarUrl: 'https://r2.example.com/avatar.png' })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.avatarUrl).toBe('https://r2.example.com/avatar.png');

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { avatarUrl: 'https://r2.example.com/avatar.png' },
    });
  });

  it('should return 400 for invalid (non-URL) avatarUrl', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-123' },
    });

    const response = await PATCH(makeRequest({ avatarUrl: 'not-a-url' }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid request');
  });

  it('should return 400 when avatarUrl is missing', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-123' },
    });

    const response = await PATCH(makeRequest({}));

    expect(response.status).toBe(400);
  });

  it('should return 500 on database error', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-123' },
    });
    mockUserUpdate.mockRejectedValue(new Error('DB connection failed'));

    const response = await PATCH(
      makeRequest({ avatarUrl: 'https://r2.example.com/avatar.png' })
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('Failed to update avatar');
  });
});
