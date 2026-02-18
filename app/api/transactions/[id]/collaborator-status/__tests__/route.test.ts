/**
 * Collaborator Status Route Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockAuthenticateApiRequest,
  mockFindUnique,
  mockCheckCollaboratorAccess,
  mockDecrypt,
} = vi.hoisted(() => ({
  mockAuthenticateApiRequest: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCheckCollaboratorAccess: vi.fn(),
  mockDecrypt: vi.fn((token: string) => `decrypted_${token}`),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mockAuthenticateApiRequest,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    transaction: {
      findUnique: mockFindUnique,
    },
  },
}));

vi.mock('@/lib/services/GitHubService', () => ({
  githubService: {
    checkCollaboratorAccess: mockCheckCollaboratorAccess,
  },
}));

vi.mock('@/lib/middleware/withRateLimit', () => ({
  withApiRateLimit: (handler: any) => handler,
}));

vi.mock('@/lib/encryption', () => ({
  decrypt: mockDecrypt,
}));

import { GET } from '../route';

function makeRequest(id: string) {
  return new NextRequest(`http://localhost/api/transactions/${id}/collaborator-status`, {
    method: 'GET',
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const baseTransaction = {
  id: 'txn-123',
  buyerId: 'buyer-456',
  sellerId: 'seller-789',
  project: { githubUrl: 'https://github.com/seller/my-repo' },
  seller: { githubAccessToken: 'gha_token_abc' },
  repositoryTransfer: { buyerGithubUsername: 'buyeruser' },
};

describe('GET /api/transactions/[id]/collaborator-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when request is not authenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue(null);

    const response = await GET(makeRequest('txn-123'), makeParams('txn-123'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('should return 404 when transaction is not found', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'buyer-456' } });
    mockFindUnique.mockResolvedValue(null);

    const response = await GET(makeRequest('txn-123'), makeParams('txn-123'));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Transaction not found');
  });

  it('should return 403 when user is neither buyer nor seller', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'other-user' } });
    mockFindUnique.mockResolvedValue(baseTransaction);

    const response = await GET(makeRequest('txn-123'), makeParams('txn-123'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('should return invitation_not_sent when no github URL on project', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'buyer-456' } });
    mockFindUnique.mockResolvedValue({
      ...baseTransaction,
      project: { githubUrl: null },
    });

    const response = await GET(makeRequest('txn-123'), makeParams('txn-123'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(false);
    expect(body.reason).toBe('invitation_not_sent');
  });

  it('should return invitation_not_sent when no buyer github username', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'buyer-456' } });
    mockFindUnique.mockResolvedValue({
      ...baseTransaction,
      repositoryTransfer: { buyerGithubUsername: null },
    });

    const response = await GET(makeRequest('txn-123'), makeParams('txn-123'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(false);
    expect(body.reason).toBe('invitation_not_sent');
  });

  it('should return seller_token_missing when seller has no GitHub token', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'buyer-456' } });
    mockFindUnique.mockResolvedValue({
      ...baseTransaction,
      seller: { githubAccessToken: null },
    });

    const response = await GET(makeRequest('txn-123'), makeParams('txn-123'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(false);
    expect(body.reason).toBe('seller_token_missing');
  });

  it('should return invalid_github_url when github URL cannot be parsed', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'buyer-456' } });
    mockFindUnique.mockResolvedValue({
      ...baseTransaction,
      project: { githubUrl: 'not-a-valid-github-url' },
    });

    const response = await GET(makeRequest('txn-123'), makeParams('txn-123'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(false);
    expect(body.reason).toBe('invalid_github_url');
  });

  it('should return accepted=true when buyer has accepted the invitation', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'buyer-456' } });
    mockFindUnique.mockResolvedValue(baseTransaction);
    mockCheckCollaboratorAccess.mockResolvedValue(true);

    const response = await GET(makeRequest('txn-123'), makeParams('txn-123'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(true);
    expect(body.username).toBe('buyeruser');
    expect(body.reason).toBe('accepted');
    expect(mockDecrypt).toHaveBeenCalledWith('gha_token_abc');
    expect(mockCheckCollaboratorAccess).toHaveBeenCalledWith(
      'seller',
      'my-repo',
      'buyeruser',
      'decrypted_gha_token_abc'
    );
  });

  it('should return accepted=false with reason pending when invitation not yet accepted', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'seller-789' } });
    mockFindUnique.mockResolvedValue(baseTransaction);
    mockCheckCollaboratorAccess.mockResolvedValue(false);

    const response = await GET(makeRequest('txn-123'), makeParams('txn-123'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(false);
    expect(body.username).toBe('buyeruser');
    expect(body.reason).toBe('pending');
  });

  it('should allow seller to check status', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'seller-789' } });
    mockFindUnique.mockResolvedValue(baseTransaction);
    mockCheckCollaboratorAccess.mockResolvedValue(true);

    const response = await GET(makeRequest('txn-123'), makeParams('txn-123'));

    expect(response.status).toBe(200);
  });

  it('should return 500 on unexpected errors', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({ user: { id: 'buyer-456' } });
    mockFindUnique.mockRejectedValue(new Error('DB connection failed'));

    const response = await GET(makeRequest('txn-123'), makeParams('txn-123'));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to check collaborator status');
  });
});
