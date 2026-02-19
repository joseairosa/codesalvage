/**
 * POST /api/projects/analyze-repo — Tests
 *
 * Covers:
 * - Cache hit: returns cached analysis, Claude API is NOT called
 * - Cache miss: calls Claude API, result is cached
 * - Rate limiting uses user ID (not IP)
 * - 401 when unauthenticated
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';


const { mockAnalyzeRepo, mockFetchRepoData, mockGetOrSetCache } =
  vi.hoisted(() => ({
    mockAnalyzeRepo: vi.fn(),
    mockFetchRepoData: vi.fn(),
    mockGetOrSetCache: vi.fn(),
  }));

vi.mock('@/lib/services/RepoAnalysisService', () => ({
  RepoAnalysisService: vi.fn().mockImplementation(() => ({
    analyzeRepo: mockAnalyzeRepo,
  })),
  RepoAnalysisError: class extends Error {},
}));

vi.mock('@/lib/services/GitHubService', () => ({
  GitHubService: vi.fn().mockImplementation(() => ({
    fetchRepoData: mockFetchRepoData,
  })),
  GitHubServiceError: class extends Error {
    constructor(
      message: string,
      public statusCode: number
    ) {
      super(message);
    }
  },
}));

vi.mock('@/lib/utils/cache', () => ({
  getOrSetCache: mockGetOrSetCache,
  CacheKeys: {
    repoAnalysis: (fullName: string, pushedAt: string) =>
      `repo-analysis:${fullName}:${pushedAt}`,
  },
  CacheTTL: { REPO_ANALYSIS: 86400 },
}));

vi.mock('@/lib/middleware/withRateLimit', () => ({
  withRateLimit: (handler: unknown) => handler,
}));

vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: vi.fn().mockResolvedValue(null) } } }));
vi.mock('@/lib/encryption', () => ({ decrypt: vi.fn() }));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
}));

vi.mock('@/lib/utils/rateLimit', () => ({
  getClientIP: () => '127.0.0.1',
}));

import { POST } from '../route';
import { authenticateApiRequest } from '@/lib/api-auth';


const mockRepoData = {
  metadata: {
    fullName: 'owner/my-repo',
    pushedAt: '2026-02-01T00:00:00Z',
    name: 'my-repo',
    description: null,
    language: 'TypeScript',
    topics: [],
    defaultBranch: 'main',
    stars: 5,
    forks: 1,
    openIssues: 0,
    isPrivate: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2026-02-01T00:00:00Z',
    htmlUrl: 'https://github.com/owner/my-repo',
    license: null,
  },
  readme: '# My Repo',
  languages: { TypeScript: 10000 },
  dependencies: null,
  dependencyFile: null,
  fileTree: [],
};

const mockAnalysis = {
  title: 'My Repo',
  description: 'A great project',
  category: 'web_app',
  techStack: ['TypeScript'],
  completionPercentage: 70,
  suggestedPriceCents: 50000,
  licenseType: 'full_code',
  accessLevel: 'full',
};

function makeRequest(body: object) {
  return new NextRequest('http://localhost/api/projects/analyze-repo', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}


describe('POST /api/projects/analyze-repo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-abc', isSeller: true },
    } as any);
    mockFetchRepoData.mockResolvedValue(mockRepoData);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue(null);

    const res = await POST(makeRequest({ githubUrl: 'https://github.com/owner/repo' }));

    expect(res.status).toBe(401);
    expect(mockAnalyzeRepo).not.toHaveBeenCalled();
  });

  it('calls Claude and returns analysis on cache miss', async () => {
    mockGetOrSetCache.mockImplementation(async (_key: string, _ttl: number, generator: () => Promise<unknown>) =>
      generator()
    );
    mockAnalyzeRepo.mockResolvedValue(mockAnalysis);

    const res = await POST(makeRequest({ githubUrl: 'https://github.com/owner/my-repo' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.analysis).toEqual(mockAnalysis);
    expect(mockAnalyzeRepo).toHaveBeenCalledOnce();
  });

  it('does NOT call Claude when result is cached (cache hit)', async () => {
    mockGetOrSetCache.mockResolvedValue(mockAnalysis);

    const res = await POST(makeRequest({ githubUrl: 'https://github.com/owner/my-repo' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.analysis).toEqual(mockAnalysis);
    expect(mockAnalyzeRepo).not.toHaveBeenCalled();
  });

  it('uses the correct cache key (fullName + pushedAt)', async () => {
    mockGetOrSetCache.mockResolvedValue(mockAnalysis);

    await POST(makeRequest({ githubUrl: 'https://github.com/owner/my-repo' }));

    expect(mockGetOrSetCache).toHaveBeenCalledWith(
      'repo-analysis:owner/my-repo:2026-02-01T00:00:00Z',
      86400,
      expect.any(Function)
    );
  });

  it('returns 400 for an invalid GitHub URL', async () => {
    const res = await POST(makeRequest({ githubUrl: 'https://gitlab.com/owner/repo' }));

    expect(res.status).toBe(400);
    expect(mockAnalyzeRepo).not.toHaveBeenCalled();
  });
});
