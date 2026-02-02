/**
 * GET /api/user/github-repos
 *
 * Returns the authenticated user's GitHub repositories.
 * Requires a connected GitHub account with a stored access token.
 */

import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { githubAccessToken: true },
  });

  if (!user?.githubAccessToken) {
    return NextResponse.json(
      { error: 'GitHub not connected' },
      { status: 400 }
    );
  }

  try {
    const token = decrypt(user.githubAccessToken);

    // Fetch user's repos from GitHub API (sorted by most recently pushed)
    const response = await fetch(
      'https://api.github.com/user/repos?sort=pushed&direction=desc&per_page=100&type=all',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (!response.ok) {
      console.error('[GitHub Repos] API error:', response.status, await response.text());
      return NextResponse.json(
        { error: 'Failed to fetch repositories' },
        { status: 502 }
      );
    }

    const repos = await response.json();

    // Return a slim payload with only what the UI needs
    const mapped = repos.map((repo: any) => ({
      fullName: repo.full_name,
      name: repo.name,
      owner: repo.owner?.login,
      description: repo.description,
      private: repo.private,
      url: repo.html_url,
      language: repo.language,
      stars: repo.stargazers_count,
      updatedAt: repo.pushed_at,
    }));

    return NextResponse.json({ repos: mapped });
  } catch (error) {
    console.error('[GitHub Repos] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repositories' },
      { status: 500 }
    );
  }
}
