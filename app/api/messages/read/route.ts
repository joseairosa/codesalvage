/**
 * Mark Messages as Read API Route
 *
 * Mark specific messages or all messages from a user as read.
 *
 * POST /api/messages/read
 * Body: { messageIds?: string[], userId?: string }
 *
 * @example
 * POST /api/messages/read
 * { "messageIds": ["msg1", "msg2"] }
 * OR
 * { "userId": "user123" }
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const componentName = 'MarkReadAPI';

const markReadSchema = z
  .object({
    messageIds: z.array(z.string()).optional(),
    userId: z.string().optional(),
  })
  .refine((data) => data.messageIds || data.userId, {
    message: 'Either messageIds or userId must be provided',
  });

/**
 * POST /api/messages/read
 *
 * Mark messages as read
 */
export async function POST(request: Request) {
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

    const { messageIds, userId } = validatedData.data;

    let updatedCount = 0;

    if (messageIds && messageIds.length > 0) {
      // Mark specific messages as read (only if recipient is current user)
      const result = await prisma.message.updateMany({
        where: {
          id: { in: messageIds },
          recipientId: session.user.id, // Can only mark own messages as read
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      updatedCount = result.count;
      console.log(`[${componentName}] Marked ${updatedCount} messages as read by IDs`);
    } else if (userId) {
      // Mark all messages from a specific user as read
      const result = await prisma.message.updateMany({
        where: {
          senderId: userId,
          recipientId: session.user.id,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      updatedCount = result.count;
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
