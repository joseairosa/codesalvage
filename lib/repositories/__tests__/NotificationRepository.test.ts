/**
 * NotificationRepository Unit Tests
 *
 * Test Coverage:
 * - CRUD operations (Create, Find)
 * - Query operations (by user ID, unread count)
 * - Read status operations (mark as read, mark all as read)
 * - Pagination and filtering
 * - Error handling
 *
 * Testing Approach:
 * - Mock Prisma Client
 * - Test repository behavior in isolation
 * - Verify correct Prisma query construction
 * - Test error propagation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationRepository } from '../NotificationRepository';
import type { PrismaClient } from '@prisma/client';

// Mock ulidx
vi.mock('ulidx', () => ({
  ulid: vi.fn(() => 'mock-ulid-123'),
}));

// Mock Prisma Client
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(),
}));

// Mock data helpers
const createMockNotification = (overrides = {}) => ({
  id: 'mock-ulid-123',
  userId: 'user123',
  type: 'new_message',
  title: 'New message from Alice',
  message: 'Alice sent you a message about "My Project"',
  actionUrl: '/messages/alice123',
  relatedEntityType: 'message',
  relatedEntityId: 'msg456',
  isRead: false,
  readAt: null,
  createdAt: new Date('2026-02-03T10:00:00Z'),
  ...overrides,
});

describe('NotificationRepository', () => {
  let notificationRepository: NotificationRepository;
  let mockPrismaClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrismaClient = {
      notification: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
    };

    notificationRepository = new NotificationRepository(
      mockPrismaClient as unknown as PrismaClient
    );
  });

  describe('create', () => {
    it('should create a notification with ULID and return it', async () => {
      const mockNotification = createMockNotification();
      mockPrismaClient.notification.create.mockResolvedValue(mockNotification);

      const result = await notificationRepository.create({
        userId: 'user123',
        type: 'new_message',
        title: 'New message from Alice',
        message: 'Alice sent you a message about "My Project"',
        actionUrl: '/messages/alice123',
        relatedEntityType: 'message',
        relatedEntityId: 'msg456',
      });

      expect(result).toEqual(mockNotification);
      expect(mockPrismaClient.notification.create).toHaveBeenCalledWith({
        data: {
          id: 'mock-ulid-123',
          userId: 'user123',
          type: 'new_message',
          title: 'New message from Alice',
          message: 'Alice sent you a message about "My Project"',
          actionUrl: '/messages/alice123',
          relatedEntityType: 'message',
          relatedEntityId: 'msg456',
        },
      });
    });

    it('should create a notification without optional fields', async () => {
      const mockNotification = createMockNotification({
        actionUrl: null,
        relatedEntityType: null,
        relatedEntityId: null,
      });
      mockPrismaClient.notification.create.mockResolvedValue(mockNotification);

      const result = await notificationRepository.create({
        userId: 'user123',
        type: 'new_message',
        title: 'New message',
        message: 'You have a new message',
      });

      expect(result).toEqual(mockNotification);
      expect(mockPrismaClient.notification.create).toHaveBeenCalledWith({
        data: {
          id: 'mock-ulid-123',
          userId: 'user123',
          type: 'new_message',
          title: 'New message',
          message: 'You have a new message',
          actionUrl: undefined,
          relatedEntityType: undefined,
          relatedEntityId: undefined,
        },
      });
    });

    it('should throw error when database operation fails', async () => {
      mockPrismaClient.notification.create.mockRejectedValue(new Error('DB error'));

      await expect(
        notificationRepository.create({
          userId: 'user123',
          type: 'new_message',
          title: 'Test',
          message: 'Test message',
        })
      ).rejects.toThrow('[NotificationRepository] Failed to create notification');
    });
  });

  describe('findByUserId', () => {
    it('should return notifications for a user with defaults', async () => {
      const mockNotifications = [
        createMockNotification(),
        createMockNotification({ id: 'notif-2', isRead: true }),
      ];
      mockPrismaClient.notification.findMany.mockResolvedValue(mockNotifications);

      const result = await notificationRepository.findByUserId('user123');

      expect(result).toEqual(mockNotifications);
      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user123' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });

    it('should support pagination with limit and offset', async () => {
      mockPrismaClient.notification.findMany.mockResolvedValue([]);

      await notificationRepository.findByUserId('user123', {
        limit: 10,
        offset: 20,
      });

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user123' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 20,
      });
    });

    it('should filter unread only when specified', async () => {
      mockPrismaClient.notification.findMany.mockResolvedValue([]);

      await notificationRepository.findByUserId('user123', {
        unreadOnly: true,
      });

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user123', isRead: false },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });

    it('should throw error when database operation fails', async () => {
      mockPrismaClient.notification.findMany.mockRejectedValue(new Error('DB error'));

      await expect(notificationRepository.findByUserId('user123')).rejects.toThrow(
        '[NotificationRepository] Failed to find notifications'
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count for a user', async () => {
      mockPrismaClient.notification.count.mockResolvedValue(5);

      const result = await notificationRepository.getUnreadCount('user123');

      expect(result).toBe(5);
      expect(mockPrismaClient.notification.count).toHaveBeenCalledWith({
        where: { userId: 'user123', isRead: false },
      });
    });

    it('should return 0 when no unread notifications', async () => {
      mockPrismaClient.notification.count.mockResolvedValue(0);

      const result = await notificationRepository.getUnreadCount('user123');

      expect(result).toBe(0);
    });

    it('should throw error when database operation fails', async () => {
      mockPrismaClient.notification.count.mockRejectedValue(new Error('DB error'));

      await expect(notificationRepository.getUnreadCount('user123')).rejects.toThrow(
        '[NotificationRepository] Failed to get unread count'
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark specific notifications as read for a user', async () => {
      mockPrismaClient.notification.updateMany.mockResolvedValue({ count: 2 });

      const result = await notificationRepository.markAsRead(
        ['notif-1', 'notif-2'],
        'user123'
      );

      expect(result).toBe(2);
      expect(mockPrismaClient.notification.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['notif-1', 'notif-2'] },
          userId: 'user123',
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
    });

    it('should return 0 when no matching notifications found', async () => {
      mockPrismaClient.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await notificationRepository.markAsRead(['nonexistent'], 'user123');

      expect(result).toBe(0);
    });

    it('should throw error when database operation fails', async () => {
      mockPrismaClient.notification.updateMany.mockRejectedValue(new Error('DB error'));

      await expect(
        notificationRepository.markAsRead(['notif-1'], 'user123')
      ).rejects.toThrow('[NotificationRepository] Failed to mark notifications as read');
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read for a user', async () => {
      mockPrismaClient.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await notificationRepository.markAllAsRead('user123');

      expect(result).toBe(5);
      expect(mockPrismaClient.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user123',
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });
    });

    it('should return 0 when no unread notifications', async () => {
      mockPrismaClient.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await notificationRepository.markAllAsRead('user123');

      expect(result).toBe(0);
    });

    it('should throw error when database operation fails', async () => {
      mockPrismaClient.notification.updateMany.mockRejectedValue(new Error('DB error'));

      await expect(notificationRepository.markAllAsRead('user123')).rejects.toThrow(
        '[NotificationRepository] Failed to mark all notifications as read'
      );
    });
  });

  describe('findById', () => {
    it('should return a notification by ID', async () => {
      const mockNotification = createMockNotification();
      mockPrismaClient.notification.findUnique.mockResolvedValue(mockNotification);

      const result = await notificationRepository.findById('mock-ulid-123');

      expect(result).toEqual(mockNotification);
      expect(mockPrismaClient.notification.findUnique).toHaveBeenCalledWith({
        where: { id: 'mock-ulid-123' },
      });
    });

    it('should return null when notification not found', async () => {
      mockPrismaClient.notification.findUnique.mockResolvedValue(null);

      const result = await notificationRepository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error when database operation fails', async () => {
      mockPrismaClient.notification.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(notificationRepository.findById('mock-ulid-123')).rejects.toThrow(
        '[NotificationRepository] Failed to find notification'
      );
    });
  });

  describe('deleteOldNotifications', () => {
    it('should delete notifications older than specified days', async () => {
      mockPrismaClient.notification.deleteMany.mockResolvedValue({ count: 10 });

      const result = await notificationRepository.deleteOldNotifications('user123', 30);

      expect(result).toBe(10);
      expect(mockPrismaClient.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user123',
          createdAt: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('should default to 90 days when not specified', async () => {
      mockPrismaClient.notification.deleteMany.mockResolvedValue({ count: 5 });

      await notificationRepository.deleteOldNotifications('user123');

      const callArgs = mockPrismaClient.notification.deleteMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.createdAt.lt;
      const now = new Date();
      const diffDays = Math.round(
        (now.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      expect(diffDays).toBe(90);
    });

    it('should throw error when database operation fails', async () => {
      mockPrismaClient.notification.deleteMany.mockRejectedValue(new Error('DB error'));

      await expect(
        notificationRepository.deleteOldNotifications('user123')
      ).rejects.toThrow('[NotificationRepository] Failed to delete old notifications');
    });
  });
});
