/**
 * getConversations — extracted to keep MessageRepository under 300 lines.
 * Queries the latest message per conversation partner and assembles summaries.
 */

import type { PrismaClient } from '@prisma/client';
import type { ConversationSummary } from './MessageRepository.types';

export async function getConversations(
  prisma: PrismaClient,
  userId: string,
  projectId?: string
): Promise<ConversationSummary[]> {
  console.log('[MessageRepository] Getting conversations for user:', userId);

  try {
    const sentMessages = await prisma.message.findMany({
      where: {
        senderId: userId,
        ...(projectId && { projectId }),
      },
      select: { recipientId: true, projectId: true, transactionId: true },
      distinct: ['recipientId', 'projectId'],
    });

    const receivedMessages = await prisma.message.findMany({
      where: {
        recipientId: userId,
        ...(projectId && { projectId }),
      },
      select: { senderId: true, projectId: true, transactionId: true },
      distinct: ['senderId', 'projectId'],
    });

    const conversationPartnerIds = new Set<string>();
    sentMessages.forEach((msg) => conversationPartnerIds.add(msg.recipientId));
    receivedMessages.forEach((msg) => conversationPartnerIds.add(msg.senderId));

    const conversations = await Promise.all(
      Array.from(conversationPartnerIds).map(async (partnerId) => {
        const latestMessage = await prisma.message.findFirst({
          where: {
            OR: [
              { senderId: userId, recipientId: partnerId },
              { senderId: partnerId, recipientId: userId },
            ],
            ...(projectId && { projectId }),
          },
          orderBy: { createdAt: 'desc' },
          include: {
            sender: {
              select: { id: true, username: true, fullName: true, avatarUrl: true },
            },
            recipient: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
                email: true,
              },
            },
            project: {
              select: { id: true, title: true, thumbnailImageUrl: true },
            },
          },
        });

        if (!latestMessage) return null;

        const unreadCount = await prisma.message.count({
          where: {
            senderId: partnerId,
            recipientId: userId,
            isRead: false,
            ...(projectId && { projectId }),
          },
        });

        const partner =
          latestMessage.senderId === userId
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

    const validConversations = conversations
      .filter((c) => c !== null)
      .sort(
        (a, b) =>
          b!.latestMessage.createdAt.getTime() - a!.latestMessage.createdAt.getTime()
      ) as ConversationSummary[];

    console.log('[MessageRepository] Found', validConversations.length, 'conversations');
    return validConversations;
  } catch (error) {
    console.error('[MessageRepository] getConversations failed:', error);
    throw new Error('[MessageRepository] Failed to get conversations');
  }
}
