/**
 * MessageService Unit Tests
 *
 * Tests validation logic, permission checks, and business rules
 * for messaging operations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MessageService,
  MessageValidationError,
  MessagePermissionError,
} from '../MessageService';
import type { MessageRepository } from '@/lib/repositories/MessageRepository';
import type { UserRepository } from '@/lib/repositories/UserRepository';
import type { ProjectRepository } from '@/lib/repositories/ProjectRepository';

// Mock implementations
const mockMessageRepository: MessageRepository = {
  create: vi.fn(),
  getConversation: vi.fn(),
  getConversations: vi.fn(),
  markAsRead: vi.fn(),
  markConversationAsRead: vi.fn(),
  getUnreadCount: vi.fn(),
  findById: vi.fn(),
  delete: vi.fn(),
} as any;

const mockUserRepository: UserRepository = {
  findById: vi.fn(),
  findByEmail: vi.fn(),
  findByGitHubId: vi.fn(),
  createUser: vi.fn(),
  updateUserProfile: vi.fn(),
  deleteUser: vi.fn(),
  getVerifiedSellers: vi.fn(),
  updateStripeAccount: vi.fn(),
} as any;

const mockProjectRepository: ProjectRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  search: vi.fn(),
  findBySellerId: vi.fn(),
  incrementViewCount: vi.fn(),
  getFeatured: vi.fn(),
  getStatistics: vi.fn(),
} as any;

const mockEmailService = {
  sendNewMessageNotification: vi.fn().mockResolvedValue(undefined),
};

const mockNotificationService = {
  notifyNewMessage: vi.fn().mockResolvedValue({ id: 'notif-123' }),
};

// Mock user helper
const createMockUser = (id: string, username: string) => ({
  id,
  username,
  email: `${username}@example.com`,
  fullName: `${username} Name`,
  avatarUrl: `https://avatar.com/${username}.jpg`,
  isSeller: false,
  isBuyer: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Mock project helper
const createMockProject = (id: string, sellerId: string) => ({
  id,
  sellerId,
  title: 'Test Project',
  description: 'A test project',
  status: 'active',
  priceCents: 50000,
  techStack: ['React'],
  thumbnailImageUrl: 'https://example.com/thumb.jpg',
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Mock message helper
const createMockMessage = (senderId: string, recipientId: string) => ({
  id: 'msg123',
  senderId,
  recipientId,
  content: 'Test message',
  isRead: false,
  readAt: null,
  projectId: null,
  transactionId: null,
  createdAt: new Date(),
  sender: createMockUser(senderId, 'sender'),
  recipient: createMockUser(recipientId, 'recipient'),
  project: null,
  transaction: null,
});

describe('MessageService', () => {
  let messageService: MessageService;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create fresh instance
    messageService = new MessageService(
      mockMessageRepository,
      mockUserRepository,
      mockProjectRepository,
      mockEmailService
    );
  });

  // ============================================
  // SEND MESSAGE TESTS
  // ============================================

  describe('sendMessage', () => {
    const senderId = 'user123';
    const recipientId = 'user456';

    const validMessageData = {
      recipientId,
      content: 'Hello! Interested in your project.',
    };

    beforeEach(() => {
      // Mock users exist
      vi.mocked(mockUserRepository.findById)
        .mockResolvedValueOnce(createMockUser(senderId, 'sender') as any)
        .mockResolvedValueOnce(createMockUser(recipientId, 'recipient') as any);
    });

    it('should send message with valid data', async () => {
      const mockMessage = createMockMessage(senderId, recipientId);
      vi.mocked(mockMessageRepository.create).mockResolvedValue(mockMessage as any);

      const result = await messageService.sendMessage(senderId, validMessageData);

      expect(result).toEqual(mockMessage);
      expect(mockMessageRepository.create).toHaveBeenCalledWith({
        senderId,
        recipientId,
        content: validMessageData.content,
        projectId: null,
        transactionId: null,
      });
    });

    it('should send message with projectId', async () => {
      const projectId = 'proj789';
      const messageWithProject = {
        ...validMessageData,
        projectId,
      };

      const mockProject = createMockProject(projectId, 'seller123');
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject as any);

      const mockMessage = createMockMessage(senderId, recipientId);
      vi.mocked(mockMessageRepository.create).mockResolvedValue(mockMessage as any);

      await messageService.sendMessage(senderId, messageWithProject);

      expect(mockProjectRepository.findById).toHaveBeenCalledWith(projectId);
      expect(mockMessageRepository.create).toHaveBeenCalledWith({
        senderId,
        recipientId,
        content: validMessageData.content,
        projectId,
        transactionId: null,
      });
    });

    it('should trim message content before saving', async () => {
      const messageWithSpaces = {
        ...validMessageData,
        content: '  Hello!  ',
      };

      const mockMessage = createMockMessage(senderId, recipientId);
      vi.mocked(mockMessageRepository.create).mockResolvedValue(mockMessage as any);

      await messageService.sendMessage(senderId, messageWithSpaces);

      expect(mockMessageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Hello!', // Trimmed
        })
      );
    });

    it('should send email notification after message sent', async () => {
      const mockMessage = createMockMessage(senderId, recipientId);
      vi.mocked(mockMessageRepository.create).mockResolvedValue(mockMessage as any);

      await messageService.sendMessage(senderId, validMessageData);

      expect(mockEmailService.sendNewMessageNotification).toHaveBeenCalledWith(
        mockMessage
      );
    });

    it('should not throw if email notification fails', async () => {
      const mockMessage = createMockMessage(senderId, recipientId);
      vi.mocked(mockMessageRepository.create).mockResolvedValue(mockMessage as any);
      vi.mocked(mockEmailService.sendNewMessageNotification).mockRejectedValue(
        new Error('Email service down')
      );

      // Should not throw
      await expect(
        messageService.sendMessage(senderId, validMessageData)
      ).resolves.toBeDefined();
    });

    // Validation error tests
    it('should reject empty content', async () => {
      const invalidData = {
        ...validMessageData,
        content: '',
      };

      await expect(messageService.sendMessage(senderId, invalidData)).rejects.toThrow(
        MessageValidationError
      );
    });

    it('should reject content that is only whitespace', async () => {
      const invalidData = {
        ...validMessageData,
        content: '   ',
      };

      await expect(messageService.sendMessage(senderId, invalidData)).rejects.toThrow(
        MessageValidationError
      );
    });

    it('should reject content longer than 5000 characters', async () => {
      const invalidData = {
        ...validMessageData,
        content: 'A'.repeat(5001), // Too long
      };

      await expect(messageService.sendMessage(senderId, invalidData)).rejects.toThrow(
        MessageValidationError
      );
    });

    it('should accept content at max length (5000 characters)', async () => {
      const validData = {
        ...validMessageData,
        content: 'A'.repeat(5000), // Exactly at limit
      };

      const mockMessage = createMockMessage(senderId, recipientId);
      vi.mocked(mockMessageRepository.create).mockResolvedValue(mockMessage as any);

      await expect(
        messageService.sendMessage(senderId, validData)
      ).resolves.toBeDefined();
    });

    it('should reject missing recipientId', async () => {
      const invalidData = {
        ...validMessageData,
        recipientId: '',
      };

      await expect(messageService.sendMessage(senderId, invalidData)).rejects.toThrow(
        MessageValidationError
      );
    });

    it('should reject sending message to yourself', async () => {
      const invalidData = {
        ...validMessageData,
        recipientId: senderId, // Same as sender
      };

      await expect(messageService.sendMessage(senderId, invalidData)).rejects.toThrow(
        MessageValidationError
      );
    });

    // Permission error tests
    it('should reject if sender does not exist', async () => {
      // Override beforeEach user mocks - recipient exists, sender does not
      vi.mocked(mockUserRepository.findById)
        .mockReset()
        .mockResolvedValueOnce(createMockUser(recipientId, 'recipient') as any) // Recipient exists
        .mockResolvedValueOnce(null); // Sender not found

      await expect(
        messageService.sendMessage(senderId, validMessageData)
      ).rejects.toThrow(MessagePermissionError);

      // Verify create was NOT called
      expect(mockMessageRepository.create).not.toHaveBeenCalled();
    });

    it('should reject if recipient does not exist', async () => {
      // Override beforeEach user mocks - recipient does not exist
      vi.mocked(mockUserRepository.findById).mockReset().mockResolvedValueOnce(null); // Recipient not found

      await expect(
        messageService.sendMessage(senderId, validMessageData)
      ).rejects.toThrow(MessagePermissionError);

      // Verify create was NOT called
      expect(mockMessageRepository.create).not.toHaveBeenCalled();
    });

    it('should reject if project does not exist', async () => {
      const messageWithProject = {
        ...validMessageData,
        projectId: 'nonexistent',
      };

      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      await expect(
        messageService.sendMessage(senderId, messageWithProject)
      ).rejects.toThrow(MessageValidationError);
    });

    it('should reject if project is not active', async () => {
      const projectId = 'proj789';
      const messageWithProject = {
        ...validMessageData,
        projectId,
      };

      const inactiveProject = {
        ...createMockProject(projectId, 'seller123'),
        status: 'draft', // Not active
      };
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(inactiveProject as any);

      await expect(
        messageService.sendMessage(senderId, messageWithProject)
      ).rejects.toThrow(MessageValidationError);
    });
  });

  // ============================================
  // GET CONVERSATION TESTS
  // ============================================

  describe('getConversation', () => {
    const currentUserId = 'user123';
    const otherUserId = 'user456';

    beforeEach(() => {
      // Mock users exist
      vi.mocked(mockUserRepository.findById)
        .mockResolvedValueOnce(createMockUser(currentUserId, 'current') as any)
        .mockResolvedValueOnce(createMockUser(otherUserId, 'other') as any);
    });

    it('should get conversation between two users', async () => {
      const mockMessages = [
        createMockMessage(currentUserId, otherUserId),
        createMockMessage(otherUserId, currentUserId),
      ];

      vi.mocked(mockMessageRepository.getConversation).mockResolvedValue(
        mockMessages as any
      );
      vi.mocked(mockMessageRepository.markAsRead).mockResolvedValue(1);

      const result = await messageService.getConversation(currentUserId, otherUserId);

      expect(result.messages).toEqual(mockMessages);
      expect(result.participant.id).toBe(otherUserId);
      expect(mockMessageRepository.getConversation).toHaveBeenCalledWith(
        currentUserId,
        otherUserId,
        undefined
      );
    });

    it('should get conversation filtered by project', async () => {
      const projectId = 'proj789';
      const mockProject = createMockProject(projectId, 'seller123');
      const mockMessages = [createMockMessage(currentUserId, otherUserId)];

      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject as any);
      vi.mocked(mockMessageRepository.getConversation).mockResolvedValue(
        mockMessages as any
      );
      vi.mocked(mockMessageRepository.markAsRead).mockResolvedValue(0);

      const result = await messageService.getConversation(
        currentUserId,
        otherUserId,
        projectId
      );

      expect(result.project).toEqual({
        id: projectId,
        title: mockProject.title,
        thumbnailImageUrl: mockProject.thumbnailImageUrl,
      });
      expect(mockMessageRepository.getConversation).toHaveBeenCalledWith(
        currentUserId,
        otherUserId,
        projectId
      );
    });

    it('should auto-mark unread messages from other user as read', async () => {
      // Override beforeEach user mocks
      vi.mocked(mockUserRepository.findById)
        .mockReset()
        .mockResolvedValueOnce(createMockUser(currentUserId, 'current') as any)
        .mockResolvedValueOnce(createMockUser(otherUserId, 'other') as any);

      const mockMessages = [
        { ...createMockMessage(otherUserId, currentUserId), isRead: false }, // Unread
        { ...createMockMessage(otherUserId, currentUserId), isRead: false }, // Unread
        { ...createMockMessage(currentUserId, otherUserId), isRead: false }, // From current user, skip
      ];

      vi.mocked(mockMessageRepository.getConversation).mockResolvedValue(
        mockMessages as any
      );
      vi.mocked(mockMessageRepository.markAsRead).mockResolvedValue(2);

      await messageService.getConversation(currentUserId, otherUserId);

      expect(mockMessageRepository.markAsRead).toHaveBeenCalledWith([
        mockMessages[0]!.id,
        mockMessages[1]!.id,
      ]);
    });

    it('should not call markAsRead if no unread messages', async () => {
      const mockMessages = [
        { ...createMockMessage(otherUserId, currentUserId), isRead: true }, // Already read
      ];

      vi.mocked(mockMessageRepository.getConversation).mockResolvedValue(
        mockMessages as any
      );

      await messageService.getConversation(currentUserId, otherUserId);

      expect(mockMessageRepository.markAsRead).not.toHaveBeenCalled();
    });

    it('should throw if current user not found', async () => {
      // Override beforeEach user mocks - current user not found
      vi.mocked(mockUserRepository.findById).mockReset().mockResolvedValueOnce(null); // Current user not found

      await expect(
        messageService.getConversation(currentUserId, otherUserId)
      ).rejects.toThrow(MessagePermissionError);

      // Verify getConversation was NOT called
      expect(mockMessageRepository.getConversation).not.toHaveBeenCalled();
    });

    it('should throw if other user not found', async () => {
      // Override beforeEach user mocks - current user exists, other user not found
      vi.mocked(mockUserRepository.findById)
        .mockReset()
        .mockResolvedValueOnce(createMockUser(currentUserId, 'current') as any)
        .mockResolvedValueOnce(null); // Other user not found

      await expect(
        messageService.getConversation(currentUserId, otherUserId)
      ).rejects.toThrow(MessagePermissionError);

      // Verify getConversation was NOT called
      expect(mockMessageRepository.getConversation).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // GET CONVERSATIONS TESTS
  // ============================================

  describe('getConversations', () => {
    it('should get all conversations for user', async () => {
      const userId = 'user123';
      const mockConversations = [
        {
          partnerId: 'user456',
          partner: createMockUser('user456', 'user456'),
          latestMessage: {
            id: 'msg1',
            content: 'Latest message',
            createdAt: new Date(),
            isRead: false,
            senderId: 'user456',
          },
          unreadCount: 3,
        },
      ];

      vi.mocked(mockMessageRepository.getConversations).mockResolvedValue(
        mockConversations as any
      );

      const result = await messageService.getConversations(userId);

      expect(result).toEqual(mockConversations);
      expect(mockMessageRepository.getConversations).toHaveBeenCalledWith(
        userId,
        undefined
      );
    });

    it('should get conversations filtered by project', async () => {
      const userId = 'user123';
      const projectId = 'proj789';

      vi.mocked(mockMessageRepository.getConversations).mockResolvedValue([]);

      await messageService.getConversations(userId, projectId);

      expect(mockMessageRepository.getConversations).toHaveBeenCalledWith(
        userId,
        projectId
      );
    });
  });

  // ============================================
  // MARK CONVERSATION AS READ TESTS
  // ============================================

  describe('markConversationAsRead', () => {
    it('should mark conversation as read', async () => {
      const recipientId = 'user123';
      const senderId = 'user456';

      vi.mocked(mockMessageRepository.markConversationAsRead).mockResolvedValue(5);

      const result = await messageService.markConversationAsRead(recipientId, senderId);

      expect(result).toBe(5);
      expect(mockMessageRepository.markConversationAsRead).toHaveBeenCalledWith(
        recipientId,
        senderId,
        undefined
      );
    });

    it('should mark conversation as read with project filter', async () => {
      const recipientId = 'user123';
      const senderId = 'user456';
      const projectId = 'proj789';

      vi.mocked(mockMessageRepository.markConversationAsRead).mockResolvedValue(2);

      await messageService.markConversationAsRead(recipientId, senderId, projectId);

      expect(mockMessageRepository.markConversationAsRead).toHaveBeenCalledWith(
        recipientId,
        senderId,
        projectId
      );
    });
  });

  // ============================================
  // GET UNREAD COUNT TESTS
  // ============================================

  describe('getUnreadCount', () => {
    it('should get unread message count', async () => {
      const userId = 'user123';
      vi.mocked(mockMessageRepository.getUnreadCount).mockResolvedValue(7);

      const result = await messageService.getUnreadCount(userId);

      expect(result).toBe(7);
      expect(mockMessageRepository.getUnreadCount).toHaveBeenCalledWith(userId);
    });

    it('should return 0 if no unread messages', async () => {
      const userId = 'user123';
      vi.mocked(mockMessageRepository.getUnreadCount).mockResolvedValue(0);

      const result = await messageService.getUnreadCount(userId);

      expect(result).toBe(0);
    });
  });

  // ============================================
  // NOTIFICATION INTEGRATION TESTS
  // ============================================

  describe('notification integration', () => {
    let messageServiceWithNotifications: MessageService;

    beforeEach(() => {
      vi.clearAllMocks();
      messageServiceWithNotifications = new MessageService(
        mockMessageRepository,
        mockUserRepository,
        mockProjectRepository,
        mockEmailService,
        mockNotificationService
      );
    });

    it('should create in-app notification when sending a message', async () => {
      const senderId = 'sender123';
      const recipientId = 'recipient123';
      const mockMessage = createMockMessage(senderId, recipientId);

      vi.mocked(mockUserRepository.findById).mockResolvedValue(
        createMockUser(recipientId, 'recipient') as any
      );
      vi.mocked(mockMessageRepository.create).mockResolvedValue(mockMessage);

      await messageServiceWithNotifications.sendMessage(senderId, {
        recipientId,
        content: 'Hello!',
      });

      expect(mockNotificationService.notifyNewMessage).toHaveBeenCalledWith({
        recipientId,
        senderName: 'sender Name',
        messagePreview: 'Hello!',
        projectTitle: undefined,
        conversationUrl: `/messages/${senderId}`,
      });
    });

    it('should include project title in notification when message has project', async () => {
      const senderId = 'sender123';
      const recipientId = 'recipient123';
      const projectId = 'proj789';
      const mockMessage = {
        ...createMockMessage(senderId, recipientId),
        projectId,
        project: { id: projectId, title: 'My Cool App', thumbnailImageUrl: null },
      };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(
        createMockUser(recipientId, 'recipient') as any
      );
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        createMockProject(projectId, senderId) as any
      );
      vi.mocked(mockMessageRepository.create).mockResolvedValue(mockMessage);

      await messageServiceWithNotifications.sendMessage(senderId, {
        recipientId,
        content: 'Interested in your project',
        projectId,
      });

      expect(mockNotificationService.notifyNewMessage).toHaveBeenCalledWith({
        recipientId,
        senderName: 'sender Name',
        messagePreview: 'Interested in your project',
        projectTitle: 'My Cool App',
        conversationUrl: `/messages/${senderId}?projectId=${projectId}`,
      });
    });

    it('should not fail if notification service throws', async () => {
      const senderId = 'sender123';
      const recipientId = 'recipient123';
      const mockMessage = createMockMessage(senderId, recipientId);

      vi.mocked(mockUserRepository.findById).mockResolvedValue(
        createMockUser(recipientId, 'recipient') as any
      );
      vi.mocked(mockMessageRepository.create).mockResolvedValue(mockMessage);
      mockNotificationService.notifyNewMessage.mockRejectedValue(
        new Error('Notification failed')
      );

      // Should not throw
      const result = await messageServiceWithNotifications.sendMessage(senderId, {
        recipientId,
        content: 'Hello!',
      });

      expect(result).toEqual(mockMessage);
    });

    it('should not call notification service when not provided', async () => {
      const senderId = 'sender123';
      const recipientId = 'recipient123';
      const mockMessage = createMockMessage(senderId, recipientId);

      vi.mocked(mockUserRepository.findById).mockResolvedValue(
        createMockUser(recipientId, 'recipient') as any
      );
      vi.mocked(mockMessageRepository.create).mockResolvedValue(mockMessage);

      // Use messageService without notificationService
      await messageService.sendMessage(senderId, {
        recipientId,
        content: 'Hello!',
      });

      expect(mockNotificationService.notifyNewMessage).not.toHaveBeenCalled();
    });
  });
});
