/**
 * Messages API Route
 *
 * Handles message operations for buyer-seller communication.
 *
 * GET /api/messages - List user's conversations
 * POST /api/messages - Send a new message
 *
 * @example
 * GET /api/messages?userId=user123
 * POST /api/messages { recipientId, projectId, content }
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services';
import { env } from '@/config/env';
import { z } from 'zod';

const componentName = 'MessagesAPI';

const sendMessageSchema = z.object({
  recipientId: z.string(),
  projectId: z.string().optional(),
  transactionId: z.string().optional(),
  content: z.string().min(1).max(5000),
});

/**
 * GET /api/messages
 *
 * List user's conversations with message preview
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    console.log(`[${componentName}] Fetching conversations for user:`, session.user.id);

    // Get all unique conversations for the user
    const sentMessages = await prisma.message.findMany({
      where: {
        senderId: session.user.id,
        ...(projectId && { projectId }),
      },
      select: {
        recipientId: true,
        projectId: true,
        transactionId: true,
      },
      distinct: ['recipientId', 'projectId'],
    });

    const receivedMessages = await prisma.message.findMany({
      where: {
        recipientId: session.user.id,
        ...(projectId && { projectId }),
      },
      select: {
        senderId: true,
        projectId: true,
        transactionId: true,
      },
      distinct: ['senderId', 'projectId'],
    });

    // Get unique conversation partners
    const conversationPartnerIds = new Set<string>();
    sentMessages.forEach((msg) => conversationPartnerIds.add(msg.recipientId));
    receivedMessages.forEach((msg) => conversationPartnerIds.add(msg.senderId));

    // Build conversation list with latest message and unread count
    const conversations = await Promise.all(
      Array.from(conversationPartnerIds).map(async (partnerId) => {
        // Get latest message in conversation
        const latestMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: session.user.id, recipientId: partnerId },
              { senderId: partnerId, recipientId: session.user.id },
            ],
            ...(projectId && { projectId }),
          },
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
              },
            },
            recipient: {
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
              },
            },
          },
        });

        if (!latestMessage) return null;

        // Count unread messages from this partner
        const unreadCount = await prisma.message.count({
          where: {
            senderId: partnerId,
            recipientId: session.user.id,
            isRead: false,
            ...(projectId && { projectId }),
          },
        });

        // Get the partner info (the other person in the conversation)
        const partner =
          latestMessage.senderId === session.user.id
            ? latestMessage.recipient
            : latestMessage.sender;

        return {
          partnerId: partner.id,
          partner,
          latestMessage: {
            id: latestMessage.id,
            content: latestMessage.content,
            createdAt: latestMessage.createdAt,
            isRead: latestMessage.isRead,
            senderId: latestMessage.senderId,
          },
          project: latestMessage.project,
          unreadCount,
        };
      })
    );

    // Filter out nulls and sort by latest message
    const validConversations = conversations
      .filter((c) => c !== null)
      .sort(
        (a, b) =>
          new Date(b!.latestMessage.createdAt).getTime() -
          new Date(a!.latestMessage.createdAt).getTime()
      );

    console.log(`[${componentName}] Found ${validConversations.length} conversations`);

    return NextResponse.json(
      {
        conversations: validConversations,
        total: validConversations.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(`[${componentName}] Error fetching conversations:`, error);

    return NextResponse.json(
      {
        error: 'Failed to fetch conversations',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messages
 *
 * Send a new message
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = sendMessageSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validatedData.error.errors,
        },
        { status: 400 }
      );
    }

    const { recipientId, projectId, transactionId, content } = validatedData.data;

    console.log(`[${componentName}] Sending message:`, {
      senderId: session.user.id,
      recipientId,
      projectId,
    });

    // Validate recipient exists
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { id: true, username: true },
    });

    if (!recipient) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 });
    }

    // Cannot message yourself
    if (recipientId === session.user.id) {
      return NextResponse.json({ error: 'Cannot message yourself' }, { status: 400 });
    }

    // If projectId provided, validate it exists
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, title: true },
      });

      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
    }

    // If transactionId provided, validate user is involved in transaction
    if (transactionId) {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        select: { id: true, buyerId: true, sellerId: true },
      });

      if (!transaction) {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }

      // User must be buyer or seller in the transaction
      if (
        transaction.buyerId !== session.user.id &&
        transaction.sellerId !== session.user.id
      ) {
        return NextResponse.json(
          { error: 'You are not authorized to message about this transaction' },
          { status: 403 }
        );
      }
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        senderId: session.user.id,
        recipientId,
        projectId: projectId || null,
        transactionId: transactionId || null,
        content,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        recipient: {
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
          },
        },
      },
    });

    console.log(`[${componentName}] Message sent:`, message.id);

    // Send email notification to recipient
    const appUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3011';
    const conversationUrl = message.project
      ? `${appUrl}/messages/${message.senderId}?projectId=${message.project.id}`
      : `${appUrl}/messages/${message.senderId}`;

    try {
      await emailService.sendNewMessageNotification(
        {
          email: message.recipient.email!,
          name: message.recipient.fullName || message.recipient.username,
        },
        {
          recipientName: message.recipient.fullName || message.recipient.username,
          senderName: message.sender.fullName || message.sender.username,
          messagePreview: content.slice(0, 150),
          projectTitle: message.project?.title,
          conversationUrl,
        }
      );

      console.log(`[${componentName}] Message notification sent to recipient`);
    } catch (emailError) {
      console.error(`[${componentName}] Failed to send email notification:`, emailError);
      // Don't fail message sending if email fails
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error(`[${componentName}] Error sending message:`, error);

    return NextResponse.json(
      {
        error: 'Failed to send message',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
