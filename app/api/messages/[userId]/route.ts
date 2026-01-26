/**
 * Conversation Thread API Route
 *
 * Get all messages in a conversation with a specific user.
 *
 * GET /api/messages/[userId] - Get conversation thread
 *
 * @example
 * GET /api/messages/user123?projectId=project456
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const componentName = 'ConversationAPI';

/**
 * GET /api/messages/[userId]
 *
 * Get all messages in a conversation with a specific user
 */
export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = params;
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    console.log(`[${componentName}] Fetching conversation:`, {
      currentUser: session.user.id,
      partnerId: userId,
      projectId,
    });

    // Cannot get conversation with yourself
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot view conversation with yourself' },
        { status: 400 }
      );
    }

    // Validate other user exists
    const otherUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        isSeller: true,
      },
    });

    if (!otherUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get all messages in the conversation
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          {
            senderId: session.user.id,
            recipientId: userId,
            ...(projectId && { projectId }),
          },
          {
            senderId: userId,
            recipientId: session.user.id,
            ...(projectId && { projectId }),
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
            thumbnailImageUrl: true,
            priceCents: true,
            status: true,
          },
        },
        transaction: {
          select: {
            id: true,
            paymentStatus: true,
            completedAt: true,
          },
        },
      },
    });

    console.log(`[${componentName}] Found ${messages.length} messages`);

    // Mark unread messages from the other user as read
    const unreadMessageIds = messages
      .filter((msg) => msg.senderId === userId && !msg.isRead)
      .map((msg) => msg.id);

    if (unreadMessageIds.length > 0) {
      await prisma.message.updateMany({
        where: {
          id: { in: unreadMessageIds },
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      console.log(`[${componentName}] Marked ${unreadMessageIds.length} messages as read`);
    }

    return NextResponse.json(
      {
        messages,
        partner: otherUser,
        total: messages.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error fetching conversation:`, error);

    return NextResponse.json(
      {
        error: 'Failed to fetch conversation',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
