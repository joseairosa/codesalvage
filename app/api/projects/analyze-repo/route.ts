/**
 * POST /api/projects/analyze-repo
 *
 * Analyzes a GitHub repository using AI (Claude) and returns
 * structured project listing data for form pre-fill.
 *
 * Auth: Required (Firebase session or API key)
 * Rate limit: 10 requests/hour per user ID
 * Caching: Analysis results cached 24h by (repoFullName + pushedAt).
 *   Any new push to the repo automatically invalidates the cache.
 * Body: { githubUrl: "https://github.com/owner/repo" }
 *
 * Supports both public repos (no token needed) and private repos
 * (requires user to connect GitHub via /api/github/connect first).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiRequest } from '@/lib/api-auth';
import { GitHubService, GitHubServiceError } from '@/lib/services/GitHubService';
import {
  RepoAnalysisService,
  RepoAnalysisError,
} from '@/lib/services/RepoAnalysisService';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';
import { withRateLimit } from '@/lib/middleware/withRateLimit';
import { getClientIP } from '@/lib/utils/rateLimit';
import { getOrSetCache, CacheKeys, CacheTTL } from '@/lib/utils/cache';

const requestSchema = z.object({
  githubUrl: z
    .string()
    .url()
    .refine(
      (url) => /github\.com\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+/.test(url),
      'Must be a valid GitHub repository URL'
    ),
});

export const POST = withRateLimit(
  async (request: NextRequest) => {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: z.infer<typeof requestSchema>;
    try {
      const raw = await request.json();
      body = requestSchema.parse(raw);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Invalid request', details: error.issues },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    let githubToken: string | undefined;
    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { githubAccessToken: true },
    });
    if (user?.githubAccessToken) {
      try {
        githubToken = decrypt(user.githubAccessToken);
      } catch (err) {
        console.error('[Analyze Repo] Failed to decrypt GitHub token:', err);
      }
    }

    const githubService = new GitHubService();
    let repoData;
    try {
      repoData = await githubService.fetchRepoData(body.githubUrl, githubToken);
    } catch (error) {
      if (error instanceof GitHubServiceError) {
        if (error.statusCode === 404) {
          const hint = githubToken
            ? 'Repository not found.'
            : 'Repository not found or is private. Connect your GitHub account to access private repos.';
          return NextResponse.json(
            { error: hint, requiresGitHubConnect: !githubToken },
            { status: 404 }
          );
        }
        if (error.statusCode === 403) {
          return NextResponse.json(
            { error: 'GitHub API rate limit exceeded. Try again later.' },
            { status: 429 }
          );
        }
        return NextResponse.json({ error: error.message }, { status: 502 });
      }
      return NextResponse.json(
        { error: 'Failed to fetch repository data' },
        { status: 502 }
      );
    }

    const cacheKey = CacheKeys.repoAnalysis(
      repoData.metadata.fullName,
      repoData.metadata.pushedAt
    );

    let analysis;
    try {
      analysis = await getOrSetCache(cacheKey, CacheTTL.REPO_ANALYSIS, async () => {
        console.log(
          '[Analyze Repo] Cache miss — calling Claude API for:',
          repoData.metadata.fullName
        );
        const repoAnalysisService = new RepoAnalysisService();
        return repoAnalysisService.analyzeRepo(repoData);
      });
    } catch (error) {
      if (error instanceof RepoAnalysisError) {
        return NextResponse.json({ error: error.message }, { status: 502 });
      }
      return NextResponse.json(
        { error: 'AI analysis failed. Please try again.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      analysis,
      repoMeta: {
        fullName: repoData.metadata.fullName,
        stars: repoData.metadata.stars,
        forks: repoData.metadata.forks,
        lastUpdated: repoData.metadata.pushedAt,
        isPrivate: repoData.metadata.isPrivate,
        htmlUrl: repoData.metadata.htmlUrl,
      },
    });
  },
  'strict',
  async (request) => {
    const auth = await authenticateApiRequest(request);
    return auth?.user.id ?? getClientIP(request);
  }
);
