/**
 * MessageRepository Unit Tests
 *
 * Test Coverage:
 * - CRUD operations (Create, Delete)
 * - Find operations (by ID, conversation, conversations)
 * - Read status operations (mark as read, unread count)
 * - Conversation threading
 * - Error handling
 * - Edge cases
 *
 * Testing Approach:
 * - Mock Prisma Client
 * - Test repository behavior in isolation
 * - Verify correct Prisma query construction
 * - Test error propagation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageRepository } from '../MessageRepository';
import type { PrismaClient } from '@prisma/client';

// Mock Prisma Client
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(),
}));

// Mock data helpers
const createMockMessage = (overrides = {}) => ({
  id: 'msg123',
  senderId: 'sender123',
  recipientId: 'recipient123',
  projectId: null,
  transactionId: null,
  content: 'Test message',
  isRead: false,
  readAt: null,
  createdAt: new Date('2026-01-15T10:00:00Z'),
  ...overrides,
});

const createMockMessageWithRelations = (overrides = {}) => ({
  ...createMockMessage(overrides),
  sender: {
    id: 'sender123',
    username: 'sender',
    fullName: 'Sender Name',
    avatarUrl: 'https://avatar.com/sender.jpg',
  },
  recipient: {
    id: 'recipient123',
    username: 'recipient',
    fullName: 'Recipient Name',
    avatarUrl: 'https://avatar.com/recipient.jpg',
  },
  project: null,
  transaction: null,
});

const createMockUser = (id: string, username: string) => ({
  id,
  username,
  fullName: `${username} Name`,
  avatarUrl: `https://avatar.com/${username}.jpg`,
});

describe('MessageRepository', () => {
  let messageRepository: MessageRepository;
  let mockPrismaClient: any;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create mock Prisma Client with message methods
    mockPrismaClient = {
      message: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
    };

    // Create MessageRepository with mocked Prisma
    messageRepository = new MessageRepository(mockPrismaClient as PrismaClient);
  });

  describe('create', () => {
    it('should create a new message with correct data', async () => {
      // Arrange
      const messageData = {
        senderId: 'sender123',
        recipientId: 'recipient123',
        projectId: 'project123',
        transactionId: null,
        content: 'Hello there!',
      };

      const expectedMessage = createMockMessageWithRelations({
        ...messageData,
        id: 'newmsg123',
      });

      mockPrismaClient.message.create.mockResolvedValue(expectedMessage);

      // Act
      const result = await messageRepository.create(messageData);

      // Assert
      expect(mockPrismaClient.message.create).toHaveBeenCalledWith({
        data: {
          senderId: messageData.senderId,
          recipientId: messageData.recipientId,
          projectId: messageData.projectId,
          transactionId: null,
          content: messageData.content,
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
      expect(result).toEqual(expectedMessage);
    });

    it('should create message without projectId or transactionId', async () => {
      // Arrange
      const messageData = {
        senderId: 'sender123',
        recipientId: 'recipient123',
        content: 'Simple message',
      };

      const expectedMessage = createMockMessageWithRelations(messageData);
      mockPrismaClient.message.create.mockResolvedValue(expectedMessage);

      // Act
      const result = await messageRepository.create(messageData);

      // Assert
      expect(mockPrismaClient.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: null,
            transactionId: null,
          }),
        })
      );
      expect(result).toEqual(expectedMessage);
    });

    it('should throw error when database operation fails', async () => {
      // Arrange
      const messageData = {
        senderId: 'sender123',
        recipientId: 'recipient123',
        content: 'Test message',
      };

      mockPrismaClient.message.create.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(messageRepository.create(messageData)).rejects.toThrow(
        '[MessageRepository] Failed to create message'
      );
    });
  });

  describe('getConversation', () => {
    it('should get messages between two users', async () => {
      // Arrange
      const userId1 = 'user1';
      const userId2 = 'user2';

      const expectedMessages = [
        createMockMessageWithRelations({ senderId: userId1, recipientId: userId2 }),
        createMockMessageWithRelations({ senderId: userId2, recipientId: userId1 }),
      ];

      mockPrismaClient.message.findMany.mockResolvedValue(expectedMessages);

      // Act
      const result = await messageRepository.getConversation(userId1, userId2);

      // Assert
      expect(mockPrismaClient.message.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { senderId: userId1, recipientId: userId2 },
            { senderId: userId2, recipientId: userId1 },
          ],
        },
        orderBy: { createdAt: 'asc' },
        include: expect.any(Object),
      });
      expect(result).toEqual(expectedMessages);
      expect(result.length).toBe(2);
    });

    it('should filter by projectId when provided', async () => {
      // Arrange
      const userId1 = 'user1';
      const userId2 = 'user2';
      const projectId = 'project123';

      mockPrismaClient.message.findMany.mockResolvedValue([]);

      // Act
      await messageRepository.getConversation(userId1, userId2, projectId);

      // Assert
      expect(mockPrismaClient.message.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { senderId: userId1, recipientId: userId2 },
            { senderId: userId2, recipientId: userId1 },
          ],
          projectId,
        },
        orderBy: { createdAt: 'asc' },
        include: expect.any(Object),
      });
    });

    it('should return empty array when no messages exist', async () => {
      // Arrange
      mockPrismaClient.message.findMany.mockResolvedValue([]);

      // Act
      const result = await messageRepository.getConversation('user1', 'user2');

      // Assert
      expect(result).toEqual([]);
    });

    it('should throw error when database operation fails', async () => {
      // Arrange
      mockPrismaClient.message.findMany.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(messageRepository.getConversation('user1', 'user2')).rejects.toThrow(
        '[MessageRepository] Failed to get conversation'
      );
    });
  });

  describe('getConversations', () => {
    it('should get all unique conversations for user', async () => {
      // Arrange
      const userId = 'user123';

      // Mock sent messages
      mockPrismaClient.message.findMany
        .mockResolvedValueOnce([
          { recipientId: 'user2', projectId: null, transactionId: null },
        ]) // sent
        .mockResolvedValueOnce([
          { senderId: 'user3', projectId: null, transactionId: null },
        ]); // received

      // Mock latest message for each conversation (with proper user IDs)
      const latestMessage1 = {
        ...createMockMessageWithRelations({
          senderId: userId,
          content: 'Latest to user2',
          createdAt: new Date('2026-01-15T12:00:00Z'),
        }),
        recipient: createMockUser('user2', 'user2'),
      };

      const latestMessage2 = {
        ...createMockMessageWithRelations({
          recipientId: userId,
          content: 'Latest from user3',
          createdAt: new Date('2026-01-15T11:00:00Z'),
        }),
        sender: createMockUser('user3', 'user3'),
        senderId: 'user3',
      };

      mockPrismaClient.message.findFirst
        .mockResolvedValueOnce(latestMessage1) // user2 conversation
        .mockResolvedValueOnce(latestMessage2); // user3 conversation

      // Mock unread counts
      mockPrismaClient.message.count
        .mockResolvedValueOnce(2) // user2 unread
        .mockResolvedValueOnce(5); // user3 unread

      // Act
      const result = await messageRepository.getConversations(userId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].partnerId).toBe('user2'); // More recent message
      expect(result[0].unreadCount).toBe(2);
      expect(result[1].partnerId).toBe('user3'); // Older message
      expect(result[1].unreadCount).toBe(5);
    });

    it('should filter by projectId when provided', async () => {
      // Arrange
      const userId = 'user123';
      const projectId = 'project123';

      mockPrismaClient.message.findMany
        .mockResolvedValueOnce([]) // sent
        .mockResolvedValueOnce([]); // received

      // Act
      await messageRepository.getConversations(userId, projectId);

      // Assert
      expect(mockPrismaClient.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId }),
        })
      );
    });

    it('should sort conversations by latest message date (newest first)', async () => {
      // Arrange
      const userId = 'user123';

      mockPrismaClient.message.findMany
        .mockResolvedValueOnce([{ recipientId: 'user2' }])
        .mockResolvedValueOnce([{ senderId: 'user3' }]);

      // Older message
      const olderMessage = {
        ...createMockMessageWithRelations({
          recipientId: userId,
          createdAt: new Date('2026-01-14T10:00:00Z'),
        }),
        sender: createMockUser('user2', 'user2'),
        senderId: 'user2',
      };

      // Newer message
      const newerMessage = {
        ...createMockMessageWithRelations({
          recipientId: userId,
          createdAt: new Date('2026-01-15T10:00:00Z'),
        }),
        sender: createMockUser('user3', 'user3'),
        senderId: 'user3',
      };

      mockPrismaClient.message.findFirst
        .mockResolvedValueOnce(olderMessage)
        .mockResolvedValueOnce(newerMessage);

      mockPrismaClient.message.count.mockResolvedValue(0);

      // Act
      const result = await messageRepository.getConversations(userId);

      // Assert
      expect(result[0].partnerId).toBe('user3'); // Newer message first
      expect(result[1].partnerId).toBe('user2'); // Older message second
    });

    it('should return empty array when user has no conversations', async () => {
      // Arrange
      mockPrismaClient.message.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // Act
      const result = await messageRepository.getConversations('user123');

      // Assert
      expect(result).toEqual([]);
    });

    it('should throw error when database operation fails', async () => {
      // Arrange
      mockPrismaClient.message.findMany.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(messageRepository.getConversations('user123')).rejects.toThrow(
        '[MessageRepository] Failed to get conversations'
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark messages as read', async () => {
      // Arrange
      const messageIds = ['msg1', 'msg2', 'msg3'];
      mockPrismaClient.message.updateMany.mockResolvedValue({ count: 3 });

      // Act
      const result = await messageRepository.markAsRead(messageIds);

      // Assert
      expect(mockPrismaClient.message.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: messageIds },
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
      expect(result).toBe(3);
    });

    it('should return 0 when no unread messages found', async () => {
      // Arrange
      const messageIds = ['msg1', 'msg2'];
      mockPrismaClient.message.updateMany.mockResolvedValue({ count: 0 });

      // Act
      const result = await messageRepository.markAsRead(messageIds);

      // Assert
      expect(result).toBe(0);
    });

    it('should throw error when database operation fails', async () => {
      // Arrange
      mockPrismaClient.message.updateMany.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(messageRepository.markAsRead(['msg1'])).rejects.toThrow(
        '[MessageRepository] Failed to mark messages as read'
      );
    });
  });

  describe('markConversationAsRead', () => {
    it('should mark all messages from sender to recipient as read', async () => {
      // Arrange
      const recipientId = 'recipient123';
      const senderId = 'sender123';
      mockPrismaClient.message.updateMany.mockResolvedValue({ count: 5 });

      // Act
      const result = await messageRepository.markConversationAsRead(
        recipientId,
        senderId
      );

      // Assert
      expect(mockPrismaClient.message.updateMany).toHaveBeenCalledWith({
        where: {
          senderId,
          recipientId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
      expect(result).toBe(5);
    });

    it('should filter by projectId when provided', async () => {
      // Arrange
      const recipientId = 'recipient123';
      const senderId = 'sender123';
      const projectId = 'project123';
      mockPrismaClient.message.updateMany.mockResolvedValue({ count: 2 });

      // Act
      await messageRepository.markConversationAsRead(recipientId, senderId, projectId);

      // Assert
      expect(mockPrismaClient.message.updateMany).toHaveBeenCalledWith({
        where: {
          senderId,
          recipientId,
          isRead: false,
          projectId,
        },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
    });

    it('should throw error when database operation fails', async () => {
      // Arrange
      mockPrismaClient.message.updateMany.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(
        messageRepository.markConversationAsRead('recipient', 'sender')
      ).rejects.toThrow('[MessageRepository] Failed to mark conversation as read');
    });
  });

  describe('getUnreadCount', () => {
    it('should count unread messages for user', async () => {
      // Arrange
      const userId = 'user123';
      mockPrismaClient.message.count.mockResolvedValue(10);

      // Act
      const result = await messageRepository.getUnreadCount(userId);

      // Assert
      expect(mockPrismaClient.message.count).toHaveBeenCalledWith({
        where: {
          recipientId: userId,
          isRead: false,
        },
      });
      expect(result).toBe(10);
    });

    it('should filter by sender when provided', async () => {
      // Arrange
      const userId = 'user123';
      const senderId = 'sender123';
      mockPrismaClient.message.count.mockResolvedValue(3);

      // Act
      const result = await messageRepository.getUnreadCount(userId, senderId);

      // Assert
      expect(mockPrismaClient.message.count).toHaveBeenCalledWith({
        where: {
          recipientId: userId,
          isRead: false,
          senderId,
        },
      });
      expect(result).toBe(3);
    });

    it('should return 0 when no unread messages', async () => {
      // Arrange
      mockPrismaClient.message.count.mockResolvedValue(0);

      // Act
      const result = await messageRepository.getUnreadCount('user123');

      // Assert
      expect(result).toBe(0);
    });

    it('should throw error when database operation fails', async () => {
      // Arrange
      mockPrismaClient.message.count.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(messageRepository.getUnreadCount('user123')).rejects.toThrow(
        '[MessageRepository] Failed to get unread count'
      );
    });
  });

  describe('findById', () => {
    it('should find message by ID with relations', async () => {
      // Arrange
      const messageId = 'msg123';
      const expectedMessage = createMockMessageWithRelations({ id: messageId });
      mockPrismaClient.message.findUnique.mockResolvedValue(expectedMessage);

      // Act
      const result = await messageRepository.findById(messageId);

      // Assert
      expect(mockPrismaClient.message.findUnique).toHaveBeenCalledWith({
        where: { id: messageId },
        include: expect.any(Object),
      });
      expect(result).toEqual(expectedMessage);
    });

    it('should return null when message not found', async () => {
      // Arrange
      mockPrismaClient.message.findUnique.mockResolvedValue(null);

      // Act
      const result = await messageRepository.findById('nonexistent');

      // Assert
      expect(result).toBeNull();
    });

    it('should throw error when database operation fails', async () => {
      // Arrange
      mockPrismaClient.message.findUnique.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(messageRepository.findById('msg123')).rejects.toThrow(
        '[MessageRepository] Failed to find message'
      );
    });
  });

  describe('delete', () => {
    it('should delete message by ID', async () => {
      // Arrange
      const messageId = 'msg123';
      const deletedMessage = createMockMessage({ id: messageId });
      mockPrismaClient.message.delete.mockResolvedValue(deletedMessage);

      // Act
      const result = await messageRepository.delete(messageId);

      // Assert
      expect(mockPrismaClient.message.delete).toHaveBeenCalledWith({
        where: { id: messageId },
      });
      expect(result).toEqual(deletedMessage);
    });

    it('should throw error when message not found', async () => {
      // Arrange
      mockPrismaClient.message.delete.mockRejectedValue(new Error('Record not found'));

      // Act & Assert
      await expect(messageRepository.delete('nonexistent')).rejects.toThrow(
        '[MessageRepository] Failed to delete message'
      );
    });

    it('should throw error when database operation fails', async () => {
      // Arrange
      mockPrismaClient.message.delete.mockRejectedValue(new Error('DB Error'));

      // Act & Assert
      await expect(messageRepository.delete('msg123')).rejects.toThrow(
        '[MessageRepository] Failed to delete message'
      );
    });
  });
});
