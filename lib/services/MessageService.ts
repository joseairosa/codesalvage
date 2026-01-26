/**
 * MessageService - Business Logic for Messaging
 *
 * Responsibilities:
 * - Validate message data before database operations
 * - Implement business rules for message sending
 * - Verify user permissions (recipient exists, can't message self)
 * - Handle project/transaction relationship validation
 * - Coordinate email notifications for new messages
 * - Enforce message content constraints
 *
 * Architecture:
 * - Service Pattern: Encapsulates business logic
 * - Single Responsibility: Manages message-related operations
 * - Dependency Injection: Receives repositories via constructor
 * - Error handling: Provides business-level error messages
 *
 * @example
 * const messageService = new MessageService(messageRepo, userRepo, projectRepo, emailService);
 * const message = await messageService.sendMessage(senderId, {
 *   recipientId: 'user456',
 *   content: 'Hello!',
 * });
 */

import {
  MessageRepository,
  CreateMessageInput,
  MessageWithRelations,
  ConversationSummary,
} from '@/lib/repositories/MessageRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';

/**
 * Message send request (from user input)
 */
export interface SendMessageRequest {
  recipientId: string;
  content: string;
  projectId?: string;
  transactionId?: string;
}

/**
 * Conversation response with messages
 */
export interface ConversationResponse {
  messages: MessageWithRelations[];
  participant: {
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
}

/**
 * Message validation errors
 */
export class MessageValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'MessageValidationError';
  }
}

/**
 * Message permission error
 */
export class MessagePermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MessagePermissionError';
  }
}

/**
 * Message not found error
 */
export class MessageNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MessageNotFoundError';
  }
}

/**
 * Message content constraints
 */
export const MIN_CONTENT_LENGTH = 1;
export const MAX_CONTENT_LENGTH = 5000;

/**
 * MessageService
 *
 * Handles all business logic for messaging.
 */
export class MessageService {
  constructor(
    private messageRepository: MessageRepository,
    private userRepository: UserRepository,
    private projectRepository: ProjectRepository,
    private emailService?: any // EmailService type (optional for now)
  ) {
    console.log('[MessageService] Initialized');
  }

  /**
   * Send a new message
   *
   * @param senderId - Sender user ID
   * @param data - Message send data
   * @returns Created message with relations
   *
   * @throws MessageValidationError if validation fails
   * @throws MessagePermissionError if sender/recipient validation fails
   *
   * @example
   * const message = await messageService.sendMessage('user123', {
   *   recipientId: 'user456',
   *   content: 'Hello! Interested in your project.',
   *   projectId: 'proj789',
   * });
   */
  async sendMessage(
    senderId: string,
    data: SendMessageRequest
  ): Promise<MessageWithRelations> {
    console.log('[MessageService] Sending message from:', senderId);

    // Validate input
    await this.validateMessageData(senderId, data);

    // Convert request to repository input
    const createInput: CreateMessageInput = {
      senderId,
      recipientId: data.recipientId,
      content: data.content.trim(),
      projectId: data.projectId || null,
      transactionId: data.transactionId || null,
    };

    // Create message
    const message = await this.messageRepository.create(createInput);

    // Send email notification (async, don't wait)
    if (this.emailService) {
      this.emailService
        .sendNewMessageNotification(message)
        .catch((err: Error) => {
          console.error('[MessageService] Failed to send email notification:', err);
        });
    }

    console.log('[MessageService] Message sent successfully:', message.id);
    return message;
  }

  /**
   * Get conversation between current user and another user
   *
   * @param currentUserId - Current user ID
   * @param otherUserId - Other user ID
   * @param projectId - Optional project filter
   * @returns Conversation with messages and participant info
   *
   * @throws MessagePermissionError if user validation fails
   *
   * @example
   * const conversation = await messageService.getConversation(
   *   'user123',
   *   'user456',
   *   'proj789'
   * );
   */
  async getConversation(
    currentUserId: string,
    otherUserId: string,
    projectId?: string
  ): Promise<ConversationResponse> {
    console.log('[MessageService] Getting conversation:', {
      currentUserId,
      otherUserId,
      projectId,
    });

    // Validate users exist
    const currentUser = await this.userRepository.findById(currentUserId);
    if (!currentUser) {
      throw new MessagePermissionError('Current user not found');
    }

    const otherUser = await this.userRepository.findById(otherUserId);
    if (!otherUser) {
      throw new MessagePermissionError('Other user not found');
    }

    // Get messages
    const messages = await this.messageRepository.getConversation(
      currentUserId,
      otherUserId,
      projectId
    );

    // Get project if specified
    let project = null;
    if (projectId) {
      project = await this.projectRepository.findById(projectId);
    }

    // Auto-mark messages from other user as read
    const unreadMessageIds = messages
      .filter((msg) => msg.senderId === otherUserId && !msg.isRead)
      .map((msg) => msg.id);

    if (unreadMessageIds.length > 0) {
      await this.messageRepository.markAsRead(unreadMessageIds).catch((err) => {
        console.error('[MessageService] Failed to mark messages as read:', err);
      });
    }

    console.log('[MessageService] Found', messages.length, 'messages');

    return {
      messages,
      participant: {
        id: otherUser.id,
        username: otherUser.username!,
        fullName: otherUser.fullName,
        avatarUrl: otherUser.avatarUrl,
      },
      project: project
        ? {
            id: project.id,
            title: project.title,
            thumbnailImageUrl: project.thumbnailImageUrl,
          }
        : null,
    };
  }

  /**
   * Get all conversations for a user
   *
   * @param userId - User ID
   * @param projectId - Optional project filter
   * @returns Array of conversation summaries
   *
   * @example
   * const conversations = await messageService.getConversations('user123');
   */
  async getConversations(
    userId: string,
    projectId?: string
  ): Promise<ConversationSummary[]> {
    console.log('[MessageService] Getting conversations for user:', userId);

    return await this.messageRepository.getConversations(userId, projectId);
  }

  /**
   * Mark conversation as read
   *
   * @param recipientId - Recipient user ID (current user)
   * @param senderId - Sender user ID (partner)
   * @param projectId - Optional project filter
   * @returns Number of messages marked as read
   *
   * @example
   * const count = await messageService.markConversationAsRead(
   *   'user123',
   *   'user456'
   * );
   */
  async markConversationAsRead(
    recipientId: string,
    senderId: string,
    projectId?: string
  ): Promise<number> {
    console.log('[MessageService] Marking conversation as read:', {
      recipientId,
      senderId,
      projectId,
    });

    return await this.messageRepository.markConversationAsRead(
      recipientId,
      senderId,
      projectId
    );
  }

  /**
   * Get unread message count for user
   *
   * @param userId - User ID
   * @returns Unread count
   *
   * @example
   * const unreadCount = await messageService.getUnreadCount('user123');
   */
  async getUnreadCount(userId: string): Promise<number> {
    console.log('[MessageService] Getting unread count for user:', userId);

    return await this.messageRepository.getUnreadCount(userId);
  }

  /**
   * Validate message data
   *
   * @param senderId - Sender user ID
   * @param data - Message data
   * @throws MessageValidationError if validation fails
   * @throws MessagePermissionError if permission validation fails
   *
   * @private
   */
  private async validateMessageData(
    senderId: string,
    data: SendMessageRequest
  ): Promise<void> {
    // Content validation
    if (!data.content || data.content.trim().length === 0) {
      throw new MessageValidationError('Message content is required', 'content');
    }

    const contentLength = data.content.trim().length;
    if (contentLength < MIN_CONTENT_LENGTH) {
      throw new MessageValidationError(
        `Message must be at least ${MIN_CONTENT_LENGTH} character`,
        'content'
      );
    }

    if (contentLength > MAX_CONTENT_LENGTH) {
      throw new MessageValidationError(
        `Message must be less than ${MAX_CONTENT_LENGTH} characters`,
        'content'
      );
    }

    // Recipient validation
    if (!data.recipientId || data.recipientId.trim().length === 0) {
      throw new MessageValidationError('Recipient is required', 'recipientId');
    }

    // Can't message yourself
    if (data.recipientId === senderId) {
      throw new MessageValidationError(
        'You cannot send messages to yourself',
        'recipientId'
      );
    }

    // Verify recipient exists
    const recipient = await this.userRepository.findById(data.recipientId);
    if (!recipient) {
      throw new MessagePermissionError('Recipient user not found');
    }

    // Verify sender exists
    const sender = await this.userRepository.findById(senderId);
    if (!sender) {
      throw new MessagePermissionError('Sender user not found');
    }

    // Project validation (if provided)
    if (data.projectId) {
      const project = await this.projectRepository.findById(data.projectId);
      if (!project) {
        throw new MessageValidationError('Project not found', 'projectId');
      }

      // Verify project is active
      if (project.status !== 'active') {
        throw new MessageValidationError(
          'Can only message about active projects',
          'projectId'
        );
      }
    }

    // Transaction validation (if provided)
    // Note: TransactionRepository doesn't exist yet, skip for now
    // Will be added when TransactionService is implemented
    if (data.transactionId) {
      console.warn(
        '[MessageService] Transaction validation not yet implemented - skipping'
      );
      // TODO: Verify transaction exists and user is buyer OR seller
    }
  }
}
