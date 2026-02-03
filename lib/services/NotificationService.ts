/**
 * NotificationService - Business Logic for Notifications
 *
 * Responsibilities:
 * - Validate notification data before database operations
 * - Create notifications for various event types
 * - Query notifications with pagination and unread counts
 * - Manage read status
 * - Provide convenience methods for specific notification types
 *
 * Architecture:
 * - Service Pattern: Encapsulates business logic
 * - Single Responsibility: Manages notification-related operations
 * - Dependency Injection: Receives repositories via constructor
 * - Error handling: Provides business-level error messages
 *
 * @example
 * const notificationService = new NotificationService(notificationRepo);
 * await notificationService.notifyNewMessage({...});
 */

import type {
  NotificationRepository,
  CreateNotificationInput,
  NotificationQueryOptions,
} from '@/lib/repositories/NotificationRepository';
import type { Notification } from '@prisma/client';

/**
 * Notification validation error
 */
export class NotificationValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'NotificationValidationError';
  }
}

/**
 * Notification not found error
 */
export class NotificationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotificationNotFoundError';
  }
}

/**
 * Parameters for creating a new message notification
 */
export interface NotifyNewMessageParams {
  recipientId: string;
  senderName: string;
  messagePreview: string;
  projectTitle?: string;
  conversationUrl: string;
}

/**
 * Parameters for creating a project sold notification
 */
export interface NotifyProjectSoldParams {
  sellerId: string;
  buyerName: string;
  projectTitle: string;
  projectId: string;
  transactionId: string;
}

/**
 * Parameters for creating a new review notification
 */
export interface NotifyNewReviewParams {
  sellerId: string;
  buyerName: string;
  projectTitle: string;
  rating: number;
  reviewUrl: string;
}

/**
 * Parameters for creating a project featured notification
 */
export interface NotifyProjectFeaturedParams {
  sellerId: string;
  projectTitle: string;
  projectId: string;
}

/**
 * Response shape for getNotifications
 */
export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

export class NotificationService {
  constructor(private notificationRepository: NotificationRepository) {
    console.log('[NotificationService] Initialized');
  }

  /**
   * Create a notification
   *
   * @param data - Notification creation data
   * @returns Created notification
   * @throws NotificationValidationError if validation fails
   */
  async createNotification(data: CreateNotificationInput): Promise<Notification> {
    console.log('[NotificationService] Creating notification:', {
      userId: data.userId,
      type: data.type,
    });

    this.validateCreateInput(data);

    const notification = await this.notificationRepository.create(data);

    console.log('[NotificationService] Notification created:', notification.id);
    return notification;
  }

  /**
   * Get notifications for a user with unread count
   *
   * @param userId - User ID
   * @param options - Query options
   * @returns Notifications and unread count
   */
  async getNotifications(
    userId: string,
    options: NotificationQueryOptions = {}
  ): Promise<NotificationsResponse> {
    console.log('[NotificationService] Getting notifications for:', userId);

    if (!userId) {
      throw new NotificationValidationError('User ID is required', 'userId');
    }

    const { limit = 20, offset = 0, unreadOnly = false } = options;

    const [notifications, unreadCount] = await Promise.all([
      this.notificationRepository.findByUserId(userId, {
        limit,
        offset,
        unreadOnly,
      }),
      this.notificationRepository.getUnreadCount(userId),
    ]);

    console.log(
      '[NotificationService] Found',
      notifications.length,
      'notifications,',
      unreadCount,
      'unread'
    );

    return { notifications, unreadCount };
  }

  /**
   * Get unread notification count (lightweight for polling)
   *
   * @param userId - User ID
   * @returns Unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    if (!userId) {
      throw new NotificationValidationError('User ID is required', 'userId');
    }

    return this.notificationRepository.getUnreadCount(userId);
  }

  /**
   * Mark specific notifications as read
   *
   * @param userId - User ID (for ownership validation)
   * @param notificationIds - Array of notification IDs
   * @returns Number of updated notifications
   */
  async markAsRead(userId: string, notificationIds: string[]): Promise<number> {
    console.log(
      '[NotificationService] Marking as read:',
      notificationIds.length,
      'for user:',
      userId
    );

    if (!userId) {
      throw new NotificationValidationError('User ID is required', 'userId');
    }

    if (!notificationIds.length) {
      throw new NotificationValidationError(
        'At least one notification ID is required',
        'notificationIds'
      );
    }

    return this.notificationRepository.markAsRead(notificationIds, userId);
  }

  /**
   * Mark all notifications as read for a user
   *
   * @param userId - User ID
   * @returns Number of updated notifications
   */
  async markAllAsRead(userId: string): Promise<number> {
    console.log('[NotificationService] Marking all as read for:', userId);

    if (!userId) {
      throw new NotificationValidationError('User ID is required', 'userId');
    }

    return this.notificationRepository.markAllAsRead(userId);
  }

  // ========================================
  // Convenience factory methods
  // ========================================

  /**
   * Create a notification for a new message
   */
  async notifyNewMessage(params: NotifyNewMessageParams): Promise<Notification> {
    console.log('[NotificationService] notifyNewMessage:', {
      recipientId: params.recipientId,
      senderName: params.senderName,
    });

    const preview = this.truncatePreview(params.messagePreview, 100);
    const messageBody = params.projectTitle
      ? `Re: ${params.projectTitle} — "${preview}"`
      : `"${preview}"`;

    return this.createNotification({
      userId: params.recipientId,
      type: 'new_message',
      title: `New message from ${params.senderName}`,
      message: messageBody,
      actionUrl: params.conversationUrl,
      relatedEntityType: 'message',
    });
  }

  /**
   * Create a notification for a project sale
   */
  async notifyProjectSold(params: NotifyProjectSoldParams): Promise<Notification> {
    console.log('[NotificationService] notifyProjectSold:', {
      sellerId: params.sellerId,
      projectTitle: params.projectTitle,
    });

    return this.createNotification({
      userId: params.sellerId,
      type: 'project_sold',
      title: 'Project sold!',
      message: `${params.buyerName} purchased "${params.projectTitle}"`,
      actionUrl: '/seller/projects',
      relatedEntityType: 'transaction',
      relatedEntityId: params.transactionId,
    });
  }

  /**
   * Create a notification for a new review
   */
  async notifyNewReview(params: NotifyNewReviewParams): Promise<Notification> {
    console.log('[NotificationService] notifyNewReview:', {
      sellerId: params.sellerId,
      rating: params.rating,
    });

    return this.createNotification({
      userId: params.sellerId,
      type: 'new_review',
      title: `New ${params.rating}-star review!`,
      message: `${params.buyerName} left a ${params.rating}-star review on "${params.projectTitle}"`,
      actionUrl: params.reviewUrl,
      relatedEntityType: 'review',
    });
  }

  /**
   * Create a notification for a featured project
   */
  async notifyProjectFeatured(
    params: NotifyProjectFeaturedParams
  ): Promise<Notification> {
    console.log('[NotificationService] notifyProjectFeatured:', {
      sellerId: params.sellerId,
      projectId: params.projectId,
    });

    return this.createNotification({
      userId: params.sellerId,
      type: 'project_featured',
      title: 'Your project is featured!',
      message: `"${params.projectTitle}" is now featured on the homepage`,
      actionUrl: `/projects/${params.projectId}`,
      relatedEntityType: 'project',
      relatedEntityId: params.projectId,
    });
  }

  // ========================================
  // Private helpers
  // ========================================

  private validateCreateInput(data: CreateNotificationInput): void {
    if (!data.userId) {
      throw new NotificationValidationError('User ID is required', 'userId');
    }
    if (!data.type) {
      throw new NotificationValidationError('Notification type is required', 'type');
    }
    if (!data.title) {
      throw new NotificationValidationError('Title is required', 'title');
    }
    if (!data.message) {
      throw new NotificationValidationError('Message is required', 'message');
    }
  }

  private truncatePreview(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  }
}
