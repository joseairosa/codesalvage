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

    const partnerIds = new Set<string>();
    sentMessages.forEach((msg) => partnerIds.add(msg.recipientId));
    receivedMessages.forEach((msg) => partnerIds.add(msg.senderId));

    if (partnerIds.size === 0) {
      return [];
    }

    const partnerIdsArray = Array.from(partnerIds);

    // Batch-load all messages between userId and all partners in one query (ordered newest first)
    const allMessages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, recipientId: { in: partnerIdsArray } },
          { senderId: { in: partnerIdsArray }, recipientId: userId },
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

    // Group by partner — first occurrence per partner is the latest (sorted desc above)
    const latestByPartner = new Map<string, (typeof allMessages)[0]>();
    for (const message of allMessages) {
      const partnerId =
        message.senderId === userId ? message.recipientId : message.senderId;
      if (!latestByPartner.has(partnerId)) {
        latestByPartner.set(partnerId, message);
      }
    }

    // Batch-load all unread counts with a single groupBy (instead of N count queries)
    const unreadGroups = await prisma.message.groupBy({
      by: ['senderId'],
      where: {
        senderId: { in: partnerIdsArray },
        recipientId: userId,
        isRead: false,
        ...(projectId && { projectId }),
      },
      _count: { id: true },
    });

    const unreadByPartner = new Map<string, number>(
      unreadGroups.map((g) => [g.senderId, g._count.id])
    );

    const conversations: ConversationSummary[] = Array.from(
      latestByPartner.entries()
    ).map(([partnerId, latestMessage]) => {
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
        unreadCount: unreadByPartner.get(partnerId) ?? 0,
      };
    });

    const validConversations = conversations.sort(
      (a, b) =>
        b.latestMessage.createdAt.getTime() - a.latestMessage.createdAt.getTime()
    );

    console.log('[MessageRepository] Found', validConversations.length, 'conversations');
    return validConversations;
  } catch (error) {
    console.error('[MessageRepository] getConversations failed:', error);
    throw new Error('[MessageRepository] Failed to get conversations');
  }
}
