/**
 * Project Download API Route
 *
 * Generate secure download link for purchased project code.
 * Uses Cloudflare R2 pre-signed URLs for secure access.
 *
 * POST /api/projects/[id]/download
 *
 * @example
 * POST /api/projects/project123/download
 * Response: { downloadUrl: "https://...", expiresIn: 3600 }
 */

import { NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { r2Service, FileType } from '@/lib/services';

/**
 * POST /api/projects/[id]/download
 *
 * Generate download link for purchased project
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check authentication
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;

    console.log('[Project Download] Generating download link:', {
      projectId,
      userId: auth.user.id,
    });

    // Find successful transaction for this buyer and project
    const transaction = await prisma.transaction.findFirst({
      where: {
        projectId,
        buyerId: auth.user.id,
        paymentStatus: 'succeeded',
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            githubUrl: true,
            githubRepoName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Get most recent purchase
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'You have not purchased this project' },
        { status: 403 }
      );
    }

    console.log('[Project Download] Transaction found:', transaction.id);

    // Generate pre-signed download URL
    // In production, this would point to the actual code ZIP in R2
    // For now, we'll return the GitHub info

    // If codeZipUrl exists in transaction, generate pre-signed URL
    let downloadUrl: string | null = null;
    const expiresIn = 3600; // 1 hour

    if (transaction.codeZipUrl) {
      // Generate pre-signed URL for download
      const uploadConfig = await r2Service.getUploadUrl(
        `${projectId}-code.zip`,
        'application/zip',
        auth.user.id,
        FileType.ZIP,
        expiresIn
      );

      downloadUrl = uploadConfig.uploadUrl;
    }

    // Update code access timestamp
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        codeAccessedAt: new Date(),
        codeDeliveryStatus: 'accessed',
      },
    });

    console.log('[Project Download] Access timestamp updated');

    return NextResponse.json(
      {
        downloadUrl,
        githubUrl: transaction.project.githubUrl,
        githubRepoName: transaction.project.githubRepoName,
        expiresIn,
        message: downloadUrl
          ? 'Download link generated'
          : 'GitHub repository URL provided',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Project Download] Error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'Failed to generate download link',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
