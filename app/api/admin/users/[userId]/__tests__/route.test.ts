/**
 * Admin Users PATCH Route Tests
 *
 * PATCH /api/admin/users/[userId] — update user role flags
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockRequireAdminApiAuth, mockUpdateUserRoles } = vi.hoisted(() => ({
  mockRequireAdminApiAuth: vi.fn(),
  mockUpdateUserRoles: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  requireAdminApiAuth: mockRequireAdminApiAuth,
}));

vi.mock('@/lib/utils/admin-services', () => ({
  getUserRepository: vi.fn(() => ({ updateUserRoles: mockUpdateUserRoles })),
}));

import { PATCH } from '../route';

const ADMIN_AUTH = {
  user: { id: 'admin1', isAdmin: true, email: 'admin@example.com' },
};

const MOCK_USER = {
  id: 'user1',
  username: 'testuser',
  email: 'test@example.com',
  isSeller: true,
  isVerifiedSeller: false,
  isAdmin: false,
};

function makePatchRequest(userId: string, body: unknown) {
  return new NextRequest(`http://localhost/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('PATCH /api/admin/users/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with updated user when admin sets isSeller', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);
    mockUpdateUserRoles.mockResolvedValue({ ...MOCK_USER, isSeller: true });

    const req = makePatchRequest('user1', { isSeller: true });
    const res = await PATCH(req, { params: Promise.resolve({ userId: 'user1' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.isSeller).toBe(true);
    expect(body.user.id).toBe('user1');
  });

  it('returns 200 when setting multiple role flags', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);
    mockUpdateUserRoles.mockResolvedValue({
      ...MOCK_USER,
      isSeller: true,
      isVerifiedSeller: true,
    });

    const req = makePatchRequest('user1', { isSeller: true, isVerifiedSeller: true });
    const res = await PATCH(req, { params: Promise.resolve({ userId: 'user1' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.isVerifiedSeller).toBe(true);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(null);

    const req = makePatchRequest('user1', { isSeller: true });
    const res = await PATCH(req, { params: Promise.resolve({ userId: 'user1' }) });

    expect(res.status).toBe(401);
  });

  it('returns 400 when body has no role fields', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);

    const req = makePatchRequest('user1', {});
    const res = await PATCH(req, { params: Promise.resolve({ userId: 'user1' }) });

    expect(res.status).toBe(400);
  });

  it('returns 400 when body has invalid field types', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);

    const req = makePatchRequest('user1', { isSeller: 'yes' });
    const res = await PATCH(req, { params: Promise.resolve({ userId: 'user1' }) });

    expect(res.status).toBe(400);
  });

  it('returns 404 when userId does not exist', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);
    mockUpdateUserRoles.mockRejectedValue(
      new Error('[UserRepository] Failed to update user roles - user may not exist')
    );

    const req = makePatchRequest('nonexistent', { isSeller: true });
    const res = await PATCH(req, {
      params: Promise.resolve({ userId: 'nonexistent' }),
    });

    expect(res.status).toBe(404);
  });

  it('returns 500 on unexpected errors', async () => {
    mockRequireAdminApiAuth.mockResolvedValue(ADMIN_AUTH);
    mockUpdateUserRoles.mockRejectedValue(new Error('DB connection failed'));

    const req = makePatchRequest('user1', { isSeller: true });
    const res = await PATCH(req, { params: Promise.resolve({ userId: 'user1' }) });

    expect(res.status).toBe(500);
  });
});
