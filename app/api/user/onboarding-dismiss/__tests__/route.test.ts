/**
 * Onboarding Dismiss API Route Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockAuthenticateApiRequest, mockPrismaUserUpdate } = vi.hoisted(() => ({
  mockAuthenticateApiRequest: vi.fn(),
  mockPrismaUserUpdate: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mockAuthenticateApiRequest,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { update: mockPrismaUserUpdate },
  },
}));

import { PATCH } from '../route';

function makeRequest() {
  return new NextRequest('http://localhost/api/user/onboarding-dismiss', {
    method: 'PATCH',
  });
}

describe('PATCH /api/user/onboarding-dismiss', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue(null);

    const response = await PATCH(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(mockPrismaUserUpdate).not.toHaveBeenCalled();
  });

  it('sets onboardingDismissedAt and returns dismissed: true', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'user-1' } });
    mockPrismaUserUpdate.mockResolvedValue({});

    const response = await PATCH(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.dismissed).toBe(true);
    expect(mockPrismaUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { onboardingDismissedAt: expect.any(Date) },
    });
  });

  it('returns 500 on unexpected error', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'user-1' } });
    mockPrismaUserUpdate.mockRejectedValue(new Error('DB error'));

    const response = await PATCH(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to dismiss onboarding');
  });
});
