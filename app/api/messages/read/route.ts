/**
 * Mark Messages as Read API Route
 *
 * Mark specific messages or all messages from a user as read.
 *
 * POST /api/messages/read
 * Body: { messageIds?: string[], userId?: string, projectId?: string }
 *
 * @example
 * POST /api/messages/read
 * { "messageIds": ["msg1", "msg2"] }
 * OR
 * { "userId": "user123", "projectId": "project456" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { MessageService } from '@/lib/services/MessageService';
import { withApiRateLimit } from '@/lib/middleware/withRateLimit';
import { MessageRepository } from '@/lib/repositories/MessageRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import { z } from 'zod';

const componentName = 'MarkReadAPI';

// Initialize repositories and service
const messageRepository = new MessageRepository(prisma);
const userRepository = new UserRepository(prisma);
const projectRepository = new ProjectRepository(prisma);
const messageService = new MessageService(
  messageRepository,
  userRepository,
  projectRepository
);

const markReadSchema = z
  .object({
    messageIds: z.array(z.string()).optional(),
    userId: z.string().optional(),
    projectId: z.string().optional(),
  })
  .refine((data) => data.messageIds || data.userId, {
    message: 'Either messageIds or userId must be provided',
  });

/**
 * POST /api/messages/read (internal handler)
 *
 * Mark messages as read
 */
async function markMessagesAsRead(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = markReadSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validatedData.error.errors,
        },
        { status: 400 }
      );
    }

    const { messageIds, userId, projectId } = validatedData.data;

    let updatedCount = 0;

    if (messageIds && messageIds.length > 0) {
      // Mark specific messages as read using repository directly
      updatedCount = await messageRepository.markAsRead(messageIds);
      console.log(`[${componentName}] Marked ${updatedCount} messages as read by IDs`);
    } else if (userId) {
      // Mark all messages from a specific user as read using service
      updatedCount = await messageService.markConversationAsRead(
        session.user.id,
        userId,
        projectId
      );
      console.log(
        `[${componentName}] Marked ${updatedCount} messages as read from user: ${userId}`
      );
    }

    return NextResponse.json(
      {
        success: true,
        markedCount: updatedCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error marking messages as read:`, error);

    return NextResponse.json(
      {
        error: 'Failed to mark messages as read',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Export rate-limited handler
 *
 * POST: API rate limiting (100 requests / minute per user)
 */
export const POST = withApiRateLimit(markMessagesAsRead, async (_request) => {
  const session = await auth();
  return session?.user?.id || 'anonymous';
});
