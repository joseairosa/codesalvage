/**
 * Collaborator Status API Route
 *
 * Checks whether the buyer has accepted their GitHub repository collaborator invitation.
 * Polls GitHub's API to determine invitation acceptance state.
 *
 * GET /api/transactions/[id]/collaborator-status
 */

import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { withApiRateLimit } from '@/lib/middleware/withRateLimit';
import { githubService } from '@/lib/services/GitHubService';

const componentName = 'CollaboratorStatusAPI';

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/);
    if (!match) return null;
    return { owner: match[1]!, repo: match[2]! };
  } catch {
    return null;
  }
}

async function getCollaboratorStatus(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      select: {
        id: true,
        buyerId: true,
        sellerId: true,
        project: { select: { githubUrl: true } },
        seller: { select: { githubAccessToken: true } },
        repositoryTransfer: {
          select: {
            buyerGithubUsername: true,
          },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (auth.user.id !== transaction.buyerId && auth.user.id !== transaction.sellerId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const githubUrl = transaction.project?.githubUrl;
    const buyerUsername = transaction.repositoryTransfer?.buyerGithubUsername;
    const sellerToken = transaction.seller?.githubAccessToken;

    if (!githubUrl || !buyerUsername) {
      return NextResponse.json(
        { accepted: false, reason: 'invitation_not_sent' },
        { status: 200 }
      );
    }

    if (!sellerToken) {
      return NextResponse.json(
        { accepted: false, reason: 'seller_token_missing' },
        { status: 200 }
      );
    }

    const parsed = parseGithubUrl(githubUrl);
    if (!parsed) {
      return NextResponse.json(
        { accepted: false, reason: 'invalid_github_url' },
        { status: 200 }
      );
    }

    console.log(`[${componentName}] Checking collaborator status`, {
      transactionId: id,
      owner: parsed.owner,
      repo: parsed.repo,
      buyerUsername,
    });

    const accepted = await githubService.checkCollaboratorAccess(
      parsed.owner,
      parsed.repo,
      buyerUsername,
      sellerToken
    );

    console.log(`[${componentName}] Collaborator status:`, { buyerUsername, accepted });

    return NextResponse.json(
      {
        accepted,
        username: buyerUsername,
        reason: accepted ? 'accepted' : 'pending',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error checking collaborator status:`, error);
    return NextResponse.json(
      {
        error: 'Failed to check collaborator status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withApiRateLimit(getCollaboratorStatus, async (request) => {
  const auth = await authenticateApiRequest(request);
  return auth?.user.id || 'anonymous';
});
