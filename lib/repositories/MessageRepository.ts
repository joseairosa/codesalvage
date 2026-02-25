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
 * - Conversation listing delegated to MessageRepository.conversations.ts
 */

import type { PrismaClient, Message, Prisma } from '@prisma/client';
import {
  MESSAGE_INCLUDE,
  type CreateMessageInput,
  type MessageWithRelations,
  type ConversationSummary,
} from './MessageRepository.types';
import { getConversations } from './MessageRepository.conversations';

export type { CreateMessageInput, MessageWithRelations, ConversationSummary };

export class MessageRepository {
  constructor(private prisma: PrismaClient) {
    console.log('[MessageRepository] Initialized');
  }

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
        include: MESSAGE_INCLUDE,
      });

      console.log('[MessageRepository] Message created:', message.id);
      return message;
    } catch (error) {
      console.error('[MessageRepository] create failed:', error);
      throw new Error('[MessageRepository] Failed to create message');
    }
  }

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
        include: MESSAGE_INCLUDE,
      });

      console.log('[MessageRepository] Found', messages.length, 'messages');
      return messages;
    } catch (error) {
      console.error('[MessageRepository] getConversation failed:', error);
      throw new Error('[MessageRepository] Failed to get conversation');
    }
  }

  async getConversations(
    userId: string,
    projectId?: string
  ): Promise<ConversationSummary[]> {
    return getConversations(this.prisma, userId, projectId);
  }

  async markAsRead(messageIds: string[]): Promise<number> {
    console.log('[MessageRepository] Marking messages as read:', messageIds.length);

    try {
      const result = await this.prisma.message.updateMany({
        where: { id: { in: messageIds }, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });

      console.log('[MessageRepository] Marked', result.count, 'messages as read');
      return result.count;
    } catch (error) {
      console.error('[MessageRepository] markAsRead failed:', error);
      throw new Error('[MessageRepository] Failed to mark messages as read');
    }
  }

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
        data: { isRead: true, readAt: new Date() },
      });

      console.log('[MessageRepository] Marked', result.count, 'messages as read');
      return result.count;
    } catch (error) {
      console.error('[MessageRepository] markConversationAsRead failed:', error);
      throw new Error('[MessageRepository] Failed to mark conversation as read');
    }
  }

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

  async findById(id: string): Promise<MessageWithRelations | null> {
    console.log('[MessageRepository] Finding message by ID:', id);

    try {
      const message = await this.prisma.message.findUnique({
        where: { id },
        include: MESSAGE_INCLUDE,
      });

      console.log('[MessageRepository] Message found:', !!message);
      return message;
    } catch (error) {
      console.error('[MessageRepository] findById failed:', error);
      throw new Error('[MessageRepository] Failed to find message');
    }
  }

  async delete(id: string): Promise<Message> {
    console.log('[MessageRepository] Deleting message:', id);

    try {
      const message = await this.prisma.message.delete({ where: { id } });
      console.log('[MessageRepository] Message deleted:', id);
      return message;
    } catch (error) {
      console.error('[MessageRepository] delete failed:', error);
      throw new Error('[MessageRepository] Failed to delete message');
    }
  }
}
