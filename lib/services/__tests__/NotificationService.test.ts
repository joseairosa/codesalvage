/**
 * NotificationService Unit Tests
 *
 * Tests business logic for notification operations:
 * - Creating notifications
 * - Querying notifications with unread count
 * - Marking notifications as read
 * - Convenience factory methods for notification types
 * - Input validation
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationService, NotificationValidationError } from '../NotificationService';
import type { NotificationRepository } from '@/lib/repositories/NotificationRepository';

// Mock NotificationRepository
const mockNotificationRepository: NotificationRepository = {
  create: vi.fn(),
  findByUserId: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  findById: vi.fn(),
  deleteOldNotifications: vi.fn(),
} as any;

// Helper to create a mock notification
const createMockNotification = (overrides = {}) => ({
  id: 'notif-123',
  userId: 'user123',
  type: 'new_message',
  title: 'New message from Alice',
  message: 'Alice sent you a message',
  actionUrl: '/messages/alice123',
  relatedEntityType: 'message',
  relatedEntityId: 'msg456',
  isRead: false,
  readAt: null,
  createdAt: new Date('2026-02-03T10:00:00Z'),
  ...overrides,
});

describe('NotificationService', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    notificationService = new NotificationService(mockNotificationRepository);
  });

  describe('createNotification', () => {
    it('should create a notification with valid data', async () => {
      const mockNotification = createMockNotification();
      (mockNotificationRepository.create as any).mockResolvedValue(mockNotification);

      const result = await notificationService.createNotification({
        userId: 'user123',
        type: 'new_message',
        title: 'New message from Alice',
        message: 'Alice sent you a message',
        actionUrl: '/messages/alice123',
      });

      expect(result).toEqual(mockNotification);
      expect(mockNotificationRepository.create).toHaveBeenCalledWith({
        userId: 'user123',
        type: 'new_message',
        title: 'New message from Alice',
        message: 'Alice sent you a message',
        actionUrl: '/messages/alice123',
      });
    });

    it('should throw validation error when userId is empty', async () => {
      await expect(
        notificationService.createNotification({
          userId: '',
          type: 'new_message',
          title: 'Test',
          message: 'Test message',
        })
      ).rejects.toThrow(NotificationValidationError);
    });

    it('should throw validation error when title is empty', async () => {
      await expect(
        notificationService.createNotification({
          userId: 'user123',
          type: 'new_message',
          title: '',
          message: 'Test message',
        })
      ).rejects.toThrow(NotificationValidationError);
    });

    it('should throw validation error when message is empty', async () => {
      await expect(
        notificationService.createNotification({
          userId: 'user123',
          type: 'new_message',
          title: 'Test',
          message: '',
        })
      ).rejects.toThrow(NotificationValidationError);
    });

    it('should throw validation error when type is empty', async () => {
      await expect(
        notificationService.createNotification({
          userId: 'user123',
          type: '',
          title: 'Test',
          message: 'Test message',
        })
      ).rejects.toThrow(NotificationValidationError);
    });
  });

  describe('getNotifications', () => {
    it('should return notifications with unread count', async () => {
      const mockNotifications = [
        createMockNotification(),
        createMockNotification({ id: 'notif-2', isRead: true }),
      ];
      (mockNotificationRepository.findByUserId as any).mockResolvedValue(
        mockNotifications
      );
      (mockNotificationRepository.getUnreadCount as any).mockResolvedValue(1);

      const result = await notificationService.getNotifications('user123');

      expect(result).toEqual({
        notifications: mockNotifications,
        unreadCount: 1,
      });
      expect(mockNotificationRepository.findByUserId).toHaveBeenCalledWith('user123', {
        limit: 20,
        offset: 0,
        unreadOnly: false,
      });
      expect(mockNotificationRepository.getUnreadCount).toHaveBeenCalledWith('user123');
    });

    it('should pass pagination options through', async () => {
      (mockNotificationRepository.findByUserId as any).mockResolvedValue([]);
      (mockNotificationRepository.getUnreadCount as any).mockResolvedValue(0);

      await notificationService.getNotifications('user123', {
        limit: 10,
        offset: 5,
        unreadOnly: true,
      });

      expect(mockNotificationRepository.findByUserId).toHaveBeenCalledWith('user123', {
        limit: 10,
        offset: 5,
        unreadOnly: true,
      });
    });

    it('should throw validation error when userId is empty', async () => {
      await expect(notificationService.getNotifications('')).rejects.toThrow(
        NotificationValidationError
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count for a user', async () => {
      (mockNotificationRepository.getUnreadCount as any).mockResolvedValue(5);

      const result = await notificationService.getUnreadCount('user123');

      expect(result).toBe(5);
      expect(mockNotificationRepository.getUnreadCount).toHaveBeenCalledWith('user123');
    });

    it('should throw validation error when userId is empty', async () => {
      await expect(notificationService.getUnreadCount('')).rejects.toThrow(
        NotificationValidationError
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark specific notifications as read', async () => {
      (mockNotificationRepository.markAsRead as any).mockResolvedValue(2);

      const result = await notificationService.markAsRead('user123', [
        'notif-1',
        'notif-2',
      ]);

      expect(result).toBe(2);
      expect(mockNotificationRepository.markAsRead).toHaveBeenCalledWith(
        ['notif-1', 'notif-2'],
        'user123'
      );
    });

    it('should throw validation error when userId is empty', async () => {
      await expect(notificationService.markAsRead('', ['notif-1'])).rejects.toThrow(
        NotificationValidationError
      );
    });

    it('should throw validation error when notificationIds is empty', async () => {
      await expect(notificationService.markAsRead('user123', [])).rejects.toThrow(
        NotificationValidationError
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for a user', async () => {
      (mockNotificationRepository.markAllAsRead as any).mockResolvedValue(5);

      const result = await notificationService.markAllAsRead('user123');

      expect(result).toBe(5);
      expect(mockNotificationRepository.markAllAsRead).toHaveBeenCalledWith('user123');
    });

    it('should throw validation error when userId is empty', async () => {
      await expect(notificationService.markAllAsRead('')).rejects.toThrow(
        NotificationValidationError
      );
    });
  });

  describe('notifyNewMessage', () => {
    it('should create a new_message notification with project context', async () => {
      const mockNotification = createMockNotification();
      (mockNotificationRepository.create as any).mockResolvedValue(mockNotification);

      const result = await notificationService.notifyNewMessage({
        recipientId: 'user123',
        senderName: 'Alice',
        messagePreview: 'Hey, I am interested in your project!',
        projectTitle: 'My Cool App',
        conversationUrl: '/messages/alice456?projectId=proj789',
      });

      expect(result).toEqual(mockNotification);
      expect(mockNotificationRepository.create).toHaveBeenCalledWith({
        userId: 'user123',
        type: 'new_message',
        title: 'New message from Alice',
        message: 'Re: My Cool App — "Hey, I am interested in your project!"',
        actionUrl: '/messages/alice456?projectId=proj789',
        relatedEntityType: 'message',
      });
    });

    it('should create a new_message notification without project context', async () => {
      const mockNotification = createMockNotification();
      (mockNotificationRepository.create as any).mockResolvedValue(mockNotification);

      await notificationService.notifyNewMessage({
        recipientId: 'user123',
        senderName: 'Bob',
        messagePreview: 'Hello there!',
        conversationUrl: '/messages/bob789',
      });

      expect(mockNotificationRepository.create).toHaveBeenCalledWith({
        userId: 'user123',
        type: 'new_message',
        title: 'New message from Bob',
        message: '"Hello there!"',
        actionUrl: '/messages/bob789',
        relatedEntityType: 'message',
      });
    });

    it('should truncate long message previews to 100 characters', async () => {
      const longMessage = 'A'.repeat(200);
      const mockNotification = createMockNotification();
      (mockNotificationRepository.create as any).mockResolvedValue(mockNotification);

      await notificationService.notifyNewMessage({
        recipientId: 'user123',
        senderName: 'Alice',
        messagePreview: longMessage,
        conversationUrl: '/messages/alice456',
      });

      const createCall = (mockNotificationRepository.create as any).mock.calls[0][0];
      // Message should contain truncated preview (100 chars + "...")
      expect(createCall.message.length).toBeLessThan(200);
      expect(createCall.message).toContain('...');
    });
  });

  describe('notifyProjectSold', () => {
    it('should create a project_sold notification', async () => {
      const mockNotification = createMockNotification({ type: 'project_sold' });
      (mockNotificationRepository.create as any).mockResolvedValue(mockNotification);

      const result = await notificationService.notifyProjectSold({
        sellerId: 'seller123',
        buyerName: 'Bob',
        projectTitle: 'My Cool App',
        projectId: 'proj789',
        transactionId: 'tx123',
      });

      expect(result).toEqual(mockNotification);
      expect(mockNotificationRepository.create).toHaveBeenCalledWith({
        userId: 'seller123',
        type: 'project_sold',
        title: 'Project sold!',
        message: 'Bob purchased "My Cool App"',
        actionUrl: '/seller/projects',
        relatedEntityType: 'transaction',
        relatedEntityId: 'tx123',
      });
    });
  });

  describe('notifyNewReview', () => {
    it('should create a new_review notification', async () => {
      const mockNotification = createMockNotification({ type: 'new_review' });
      (mockNotificationRepository.create as any).mockResolvedValue(mockNotification);

      const result = await notificationService.notifyNewReview({
        sellerId: 'seller123',
        buyerName: 'Alice',
        projectTitle: 'My Cool App',
        rating: 5,
        reviewUrl: '/projects/proj789#reviews',
      });

      expect(result).toEqual(mockNotification);
      expect(mockNotificationRepository.create).toHaveBeenCalledWith({
        userId: 'seller123',
        type: 'new_review',
        title: 'New 5-star review!',
        message: 'Alice left a 5-star review on "My Cool App"',
        actionUrl: '/projects/proj789#reviews',
        relatedEntityType: 'review',
      });
    });
  });

  describe('notifyProjectFeatured', () => {
    it('should create a project_featured notification', async () => {
      const mockNotification = createMockNotification({
        type: 'project_featured',
      });
      (mockNotificationRepository.create as any).mockResolvedValue(mockNotification);

      const result = await notificationService.notifyProjectFeatured({
        sellerId: 'seller123',
        projectTitle: 'My Cool App',
        projectId: 'proj789',
      });

      expect(result).toEqual(mockNotification);
      expect(mockNotificationRepository.create).toHaveBeenCalledWith({
        userId: 'seller123',
        type: 'project_featured',
        title: 'Your project is featured!',
        message: '"My Cool App" is now featured on the homepage',
        actionUrl: '/projects/proj789',
        relatedEntityType: 'project',
        relatedEntityId: 'proj789',
      });
    });
  });
});
