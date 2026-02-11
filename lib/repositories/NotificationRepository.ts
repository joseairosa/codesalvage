/**
 * NotificationRepository - Data Access Layer for Notifications
 *
 * Responsibilities:
 * - CRUD operations for notifications
 * - Query notifications by user with pagination
 * - Manage read status updates
 * - Cleanup old notifications
 *
 * Architecture:
 * - Repository Pattern: Abstracts database operations
 * - Single Responsibility: Only handles data access
 * - Uses ULID for IDs (generated via ulidx)
 * - Error handling: Catches and wraps database errors
 *
 * @example
 * const notificationRepo = new NotificationRepository(prisma);
 * const notification = await notificationRepo.create({...});
 */

import type { PrismaClient, Notification } from '@prisma/client';
import { ulid } from 'ulidx';

/**
 * Notification type constants
 */
export type NotificationType =
  | 'new_message'
  | 'project_sold'
  | 'new_review'
  | 'project_featured'
  | 'new_offer'
  | 'offer_accepted'
  | 'offer_rejected'
  | 'offer_countered'
  | 'offer_expired'
  | 'repo_transfer_initiated'
  | 'repo_transfer_confirmed'
  | 'escrow_released';

/**
 * Notification creation input
 */
export interface CreateNotificationInput {
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  actionUrl?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

/**
 * Query options for finding notifications
 */
export interface NotificationQueryOptions {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

export class NotificationRepository {
  constructor(private prisma: PrismaClient) {
    console.log('[NotificationRepository] Initialized');
  }

  /**
   * Create a new notification with a ULID
   *
   * @param data - Notification creation data
   * @returns Created notification
   */
  async create(data: CreateNotificationInput): Promise<Notification> {
    console.log('[NotificationRepository] Creating notification:', {
      userId: data.userId,
      type: data.type,
    });

    try {
      // Build data object conditionally to handle exactOptionalPropertyTypes
      const createData: {
        id: string;
        userId: string;
        type: string;
        title: string;
        message: string;
        actionUrl?: string;
        relatedEntityType?: string;
        relatedEntityId?: string;
      } = {
        id: ulid(),
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
      };

      if (data.actionUrl) createData.actionUrl = data.actionUrl;
      if (data.relatedEntityType) createData.relatedEntityType = data.relatedEntityType;
      if (data.relatedEntityId) createData.relatedEntityId = data.relatedEntityId;

      const notification = await this.prisma.notification.create({
        data: createData,
      });

      console.log('[NotificationRepository] Notification created:', notification.id);
      return notification;
    } catch (error) {
      console.error('[NotificationRepository] create failed:', error);
      throw new Error('[NotificationRepository] Failed to create notification');
    }
  }

  /**
   * Find notifications for a user with pagination and optional unread filter
   *
   * @param userId - User ID
   * @param options - Query options (limit, offset, unreadOnly)
   * @returns Array of notifications
   */
  async findByUserId(
    userId: string,
    options: NotificationQueryOptions = {}
  ): Promise<Notification[]> {
    const { limit = 20, offset = 0, unreadOnly = false } = options;

    console.log('[NotificationRepository] Finding notifications:', {
      userId,
      limit,
      offset,
      unreadOnly,
    });

    try {
      const where: { userId: string; isRead?: boolean } = { userId };
      if (unreadOnly) {
        where.isRead = false;
      }

      const notifications = await this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      console.log(
        '[NotificationRepository] Found',
        notifications.length,
        'notifications'
      );
      return notifications;
    } catch (error) {
      console.error('[NotificationRepository] findByUserId failed:', error);
      throw new Error('[NotificationRepository] Failed to find notifications');
    }
  }

  /**
   * Get unread notification count for a user
   *
   * @param userId - User ID
   * @returns Unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    console.log('[NotificationRepository] Getting unread count for:', userId);

    try {
      const count = await this.prisma.notification.count({
        where: { userId, isRead: false },
      });

      console.log('[NotificationRepository] Unread count:', count);
      return count;
    } catch (error) {
      console.error('[NotificationRepository] getUnreadCount failed:', error);
      throw new Error('[NotificationRepository] Failed to get unread count');
    }
  }

  /**
   * Mark specific notifications as read (validates user ownership)
   *
   * @param notificationIds - Array of notification IDs
   * @param userId - User ID (for ownership validation)
   * @returns Number of updated notifications
   */
  async markAsRead(notificationIds: string[], userId: string): Promise<number> {
    console.log(
      '[NotificationRepository] Marking as read:',
      notificationIds.length,
      'for user:',
      userId
    );

    try {
      const result = await this.prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      console.log('[NotificationRepository] Marked', result.count, 'as read');
      return result.count;
    } catch (error) {
      console.error('[NotificationRepository] markAsRead failed:', error);
      throw new Error('[NotificationRepository] Failed to mark notifications as read');
    }
  }

  /**
   * Mark all notifications as read for a user
   *
   * @param userId - User ID
   * @returns Number of updated notifications
   */
  async markAllAsRead(userId: string): Promise<number> {
    console.log('[NotificationRepository] Marking all as read for:', userId);

    try {
      const result = await this.prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });

      console.log('[NotificationRepository] Marked', result.count, 'as read (all)');
      return result.count;
    } catch (error) {
      console.error('[NotificationRepository] markAllAsRead failed:', error);
      throw new Error(
        '[NotificationRepository] Failed to mark all notifications as read'
      );
    }
  }

  /**
   * Find a notification by ID
   *
   * @param id - Notification ID
   * @returns Notification or null
   */
  async findById(id: string): Promise<Notification | null> {
    console.log('[NotificationRepository] Finding by ID:', id);

    try {
      const notification = await this.prisma.notification.findUnique({
        where: { id },
      });

      console.log('[NotificationRepository] Found:', !!notification);
      return notification;
    } catch (error) {
      console.error('[NotificationRepository] findById failed:', error);
      throw new Error('[NotificationRepository] Failed to find notification');
    }
  }

  /**
   * Delete old notifications for a user
   *
   * @param userId - User ID
   * @param olderThanDays - Delete notifications older than this (default: 90)
   * @returns Number of deleted notifications
   */
  async deleteOldNotifications(
    userId: string,
    olderThanDays: number = 90
  ): Promise<number> {
    console.log(
      '[NotificationRepository] Deleting old notifications for:',
      userId,
      'older than:',
      olderThanDays,
      'days'
    );

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.prisma.notification.deleteMany({
        where: {
          userId,
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      console.log('[NotificationRepository] Deleted', result.count, 'old notifications');
      return result.count;
    } catch (error) {
      console.error('[NotificationRepository] deleteOldNotifications failed:', error);
      throw new Error('[NotificationRepository] Failed to delete old notifications');
    }
  }
}
