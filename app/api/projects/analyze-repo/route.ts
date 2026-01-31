/**
 * POST /api/projects/analyze-repo
 *
 * Analyzes a GitHub repository using AI (Claude) and returns
 * structured project listing data for form pre-fill.
 *
 * Auth: Required (Firebase session or API key)
 * Rate limit: 10 requests/hour per user
 * Body: { githubUrl: "https://github.com/owner/repo" }
 *
 * Supports both public repos (no token needed) and private repos
 * (requires user to connect GitHub via /api/github/connect first).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateApiRequest } from '@/lib/api-auth';
import { GitHubService, GitHubServiceError } from '@/lib/services/GitHubService';
import {
  RepoAnalysisService,
  RepoAnalysisError,
} from '@/lib/services/RepoAnalysisService';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

const requestSchema = z.object({
  githubUrl: z
    .string()
    .url()
    .refine(
      (url) => /github\.com\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+/.test(url),
      'Must be a valid GitHub repository URL'
    ),
});

// Simple in-memory rate limiter (per user, 10 requests/hour)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(request: Request) {
  // Authenticate
  const auth = await authenticateApiRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit
  if (!checkRateLimit(auth.user.id)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Maximum 10 analyses per hour.' },
      { status: 429 }
    );
  }

  // Parse and validate request body
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

  // Get user's GitHub token if they've connected their account
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
      // Continue without token — will work for public repos
    }
  }

  // Fetch repo data
  const githubService = new GitHubService();
  let repoData;
  try {
    repoData = await githubService.fetchRepoData(body.githubUrl, githubToken);
  } catch (error) {
    if (error instanceof GitHubServiceError) {
      if (error.statusCode === 404) {
        // If no token and 404, might be private
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

  // Analyze with AI
  let analysis;
  try {
    const repoAnalysisService = new RepoAnalysisService();
    analysis = await repoAnalysisService.analyzeRepo(repoData);
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
}
