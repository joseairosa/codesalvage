/**
 * MessageRepository - Data Access Layer for Messages
 *
 * Responsibilities:
 * - CRUD operations for messages
 * - Query conversations with threading
 * - Handle message relationships (sender, recipient, project, transaction)
 * - Manage read status updates
 *
 * Architecture:
 * - Repository Pattern: Abstracts database operations
 * - Single Responsibility: Only handles data access
 * - Type-safe: Returns properly typed Prisma models
 * - Error handling: Catches and wraps database errors
 *
 * @example
 * const messageRepo = new MessageRepository(prisma);
 * const message = await messageRepo.create({...});
 */

import type { PrismaClient, Message, Prisma } from '@prisma/client';

/**
 * Message creation input
 */
export interface CreateMessageInput {
  senderId: string;
  recipientId: string;
  projectId?: string | null;
  transactionId?: string | null;
  content: string;
}

/**
 * Message with full relations
 */
export interface MessageWithRelations extends Message {
  sender: {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  recipient: {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  project?: {
    id: string;
    title: string;
    thumbnailImageUrl: string | null;
  } | null;
  transaction?: {
    id: string;
    paymentStatus: string;
  } | null;
}

/**
 * Conversation summary with latest message
 */
export interface ConversationSummary {
  partnerId: string;
  partner: {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  latestMessage: {
    id: string;
    content: string;
    createdAt: Date;
    isRead: boolean;
    senderId: string;
  };
  project?: {
    id: string;
    title: string;
    thumbnailImageUrl: string | null;
  } | null;
  unreadCount: number;
}

export class MessageRepository {
  constructor(private prisma: PrismaClient) {
    console.log('[MessageRepository] Initialized');
  }

  /**
   * Create a new message
   *
   * @param data - Message creation data
   * @returns Created message with relations
   * @throws Error if database operation fails
   *
   * @example
   * const message = await messageRepo.create({
   *   senderId: 'user123',
   *   recipientId: 'user456',
   *   content: 'Hello!',
   * });
   */
  async create(data: CreateMessageInput): Promise<MessageWithRelations> {
    console.log('[MessageRepository] Creating message:', {
      senderId: data.senderId,
      recipientId: data.recipientId,
      projectId: data.projectId,
    });

    try {
      const message = await this.prisma.message.create({
        data: {
          senderId: data.senderId,
          recipientId: data.recipientId,
          projectId: data.projectId || null,
          transactionId: data.transactionId || null,
          content: data.content,
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
          transaction: {
            select: {
              id: true,
              paymentStatus: true,
            },
          },
        },
      });

      console.log('[MessageRepository] Message created:', message.id);
      return message;
    } catch (error) {
      console.error('[MessageRepository] create failed:', error);
      throw new Error('[MessageRepository] Failed to create message');
    }
  }

  /**
   * Get conversation between two users (optionally filtered by project)
   *
   * @param userId1 - First user ID
   * @param userId2 - Second user ID
   * @param projectId - Optional project filter
   * @returns Array of messages with sender/recipient/project/transaction
   *
   * @example
   * const conversation = await messageRepo.getConversation(
   *   'user123',
   *   'user456',
   *   'project789'
   * );
   */
  async getConversation(
    userId1: string,
    userId2: string,
    projectId?: string
  ): Promise<MessageWithRelations[]> {
    console.log('[MessageRepository] Getting conversation:', {
      userId1,
      userId2,
      projectId,
    });

    try {
      const where: Prisma.MessageWhereInput = {
        OR: [
          { senderId: userId1, recipientId: userId2 },
          { senderId: userId2, recipientId: userId1 },
        ],
      };

      if (projectId) {
        where.projectId = projectId;
      }

      const messages = await this.prisma.message.findMany({
        where,
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
          transaction: {
            select: {
              id: true,
              paymentStatus: true,
            },
          },
        },
      });

      console.log('[MessageRepository] Found', messages.length, 'messages');
      return messages;
    } catch (error) {
      console.error('[MessageRepository] getConversation failed:', error);
      throw new Error('[MessageRepository] Failed to get conversation');
    }
  }

  /**
   * Get all conversations for a user with latest message preview
   *
   * @param userId - User ID
   * @param projectId - Optional project filter
   * @returns Array of conversation summaries
   *
   * @example
   * const conversations = await messageRepo.getConversations('user123');
   */
  async getConversations(
    userId: string,
    projectId?: string
  ): Promise<ConversationSummary[]> {
    console.log('[MessageRepository] Getting conversations for user:', userId);

    try {
      // Get all unique conversation partners (sent messages)
      const sentMessages = await this.prisma.message.findMany({
        where: {
          senderId: userId,
          ...(projectId && { projectId }),
        },
        select: {
          recipientId: true,
          projectId: true,
          transactionId: true,
        },
        distinct: ['recipientId', 'projectId'],
      });

      // Get all unique conversation partners (received messages)
      const receivedMessages = await this.prisma.message.findMany({
        where: {
          recipientId: userId,
          ...(projectId && { projectId }),
        },
        select: {
          senderId: true,
          projectId: true,
          transactionId: true,
        },
        distinct: ['senderId', 'projectId'],
      });

      // Build unique set of conversation partners
      const conversationPartnerIds = new Set<string>();
      sentMessages.forEach((msg) => conversationPartnerIds.add(msg.recipientId));
      receivedMessages.forEach((msg) => conversationPartnerIds.add(msg.senderId));

      // Build conversation summaries for each partner
      const conversations = await Promise.all(
        Array.from(conversationPartnerIds).map(async (partnerId) => {
          // Get latest message in conversation
          const latestMessage = await this.prisma.message.findFirst({
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
          const unreadCount = await this.prisma.message.count({
            where: {
              senderId: partnerId,
              recipientId: userId,
              isRead: false,
              ...(projectId && { projectId }),
            },
          });

          // Determine the partner (the other person in the conversation)
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

      // Filter out nulls and sort by latest message
      const validConversations = conversations
        .filter((c): c is ConversationSummary => c !== null)
        .sort(
          (a, b) =>
            b.latestMessage.createdAt.getTime() - a.latestMessage.createdAt.getTime()
        );

      console.log(
        '[MessageRepository] Found',
        validConversations.length,
        'conversations'
      );
      return validConversations;
    } catch (error) {
      console.error('[MessageRepository] getConversations failed:', error);
      throw new Error('[MessageRepository] Failed to get conversations');
    }
  }

  /**
   * Mark messages as read
   *
   * @param messageIds - Array of message IDs
   * @returns Update count
   *
   * @example
   * const count = await messageRepo.markAsRead(['msg1', 'msg2']);
   */
  async markAsRead(messageIds: string[]): Promise<number> {
    console.log('[MessageRepository] Marking messages as read:', messageIds.length);

    try {
      const result = await this.prisma.message.updateMany({
        where: {
          id: { in: messageIds },
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      console.log('[MessageRepository] Marked', result.count, 'messages as read');
      return result.count;
    } catch (error) {
      console.error('[MessageRepository] markAsRead failed:', error);
      throw new Error('[MessageRepository] Failed to mark messages as read');
    }
  }

  /**
   * Mark all messages from sender to recipient as read
   *
   * @param recipientId - Recipient user ID
   * @param senderId - Sender user ID
   * @param projectId - Optional project filter
   * @returns Update count
   *
   * @example
   * const count = await messageRepo.markConversationAsRead('user123', 'user456');
   */
  async markConversationAsRead(
    recipientId: string,
    senderId: string,
    projectId?: string
  ): Promise<number> {
    console.log('[MessageRepository] Marking conversation as read:', {
      recipientId,
      senderId,
      projectId,
    });

    try {
      const result = await this.prisma.message.updateMany({
        where: {
          senderId,
          recipientId,
          isRead: false,
          ...(projectId && { projectId }),
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      console.log('[MessageRepository] Marked', result.count, 'messages as read');
      return result.count;
    } catch (error) {
      console.error('[MessageRepository] markConversationAsRead failed:', error);
      throw new Error('[MessageRepository] Failed to mark conversation as read');
    }
  }

  /**
   * Get unread message count for user
   *
   * @param userId - User ID
   * @param senderId - Optional filter by sender
   * @returns Unread count
   *
   * @example
   * const unreadCount = await messageRepo.getUnreadCount('user123');
   */
  async getUnreadCount(userId: string, senderId?: string): Promise<number> {
    console.log('[MessageRepository] Getting unread count for user:', userId);

    try {
      const count = await this.prisma.message.count({
        where: {
          recipientId: userId,
          isRead: false,
          ...(senderId && { senderId }),
        },
      });

      console.log('[MessageRepository] Unread count:', count);
      return count;
    } catch (error) {
      console.error('[MessageRepository] getUnreadCount failed:', error);
      throw new Error('[MessageRepository] Failed to get unread count');
    }
  }

  /**
   * Find message by ID
   *
   * @param id - Message ID
   * @returns Message or null
   *
   * @example
   * const message = await messageRepo.findById('msg123');
   */
  async findById(id: string): Promise<MessageWithRelations | null> {
    console.log('[MessageRepository] Finding message by ID:', id);

    try {
      const message = await this.prisma.message.findUnique({
        where: { id },
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
          transaction: {
            select: {
              id: true,
              paymentStatus: true,
            },
          },
        },
      });

      console.log('[MessageRepository] Message found:', !!message);
      return message;
    } catch (error) {
      console.error('[MessageRepository] findById failed:', error);
      throw new Error('[MessageRepository] Failed to find message');
    }
  }

  /**
   * Delete message
   *
   * @param id - Message ID
   * @returns Deleted message
   * @throws Error if message not found
   *
   * @example
   * const deleted = await messageRepo.delete('msg123');
   */
  async delete(id: string): Promise<Message> {
    console.log('[MessageRepository] Deleting message:', id);

    try {
      const message = await this.prisma.message.delete({
        where: { id },
      });

      console.log('[MessageRepository] Message deleted:', id);
      return message;
    } catch (error) {
      console.error('[MessageRepository] delete failed:', error);
      throw new Error('[MessageRepository] Failed to delete message');
    }
  }
}
