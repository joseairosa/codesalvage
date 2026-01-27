/**
 * MessageService Integration Tests
 *
 * Tests message/conversation business logic with real database operations.
 *
 * Prerequisites:
 * - Test database must be running: `npm run test:db:setup`
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
} from '@/tests/helpers/db';
import { createTestUser, createTestProject } from '@/tests/helpers/fixtures';
import { MessageService } from '@/lib/services/MessageService';
import { MessageRepository } from '@/lib/repositories/MessageRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import { prisma } from '@/lib/prisma';

// Mock EmailService since we don't need real emails for integration tests
vi.mock('@/lib/services/EmailService', () => ({
  EmailService: class {
    async sendMessageNotification() {
      return true;
    }
  },
  emailService: {
    sendMessageNotification: vi.fn().mockResolvedValue(true),
  },
}));

describe('MessageService (Integration)', () => {
  let messageService: MessageService;
  let messageRepository: MessageRepository;
  let userRepository: UserRepository;
  let projectRepository: ProjectRepository;

  beforeAll(async () => {
    await setupTestDatabase();
    messageRepository = new MessageRepository(prisma);
    userRepository = new UserRepository(prisma);
    projectRepository = new ProjectRepository(prisma);
    messageService = new MessageService(
      messageRepository,
      userRepository,
      projectRepository,
      undefined // emailService mocked
    );
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('sendMessage', () => {
    it('should send message between two users', async () => {
      const sender = await createTestUser({ username: 'sender' });
      const recipient = await createTestUser({ username: 'recipient' });

      const message = await messageService.sendMessage(sender.id, {
        recipientId: recipient.id,
        content: 'Hello! I have a question about your project.',
      });

      expect(message.id).toBeDefined();
      expect(message.senderId).toBe(sender.id);
      expect(message.recipientId).toBe(recipient.id);
      expect(message.content).toBe('Hello! I have a question about your project.');
      expect(message.isRead).toBe(false);

      // Verify in database
      const dbMessage = await prisma.message.findUnique({
        where: { id: message.id },
      });
      expect(dbMessage).toBeTruthy();
      expect(dbMessage?.senderId).toBe(sender.id);
    });

    it('should send message about a project', async () => {
      const seller = await createTestUser({ username: 'seller', isSeller: true });
      const buyer = await createTestUser({ username: 'buyer' });
      const project = await createTestProject({ sellerId: seller.id });

      const message = await messageService.sendMessage(buyer.id, {
        recipientId: seller.id,
        projectId: project.id,
        content: 'Is this project still available?',
      });

      expect(message.projectId).toBe(project.id);
      expect(message.senderId).toBe(buyer.id);
      expect(message.recipientId).toBe(seller.id);

      // Verify in database
      const dbMessage = await prisma.message.findUnique({
        where: { id: message.id },
        include: { project: true },
      });
      expect(dbMessage?.project).toBeTruthy();
      expect(dbMessage?.project?.id).toBe(project.id);
    });

    it('should enforce message length limits', async () => {
      const sender = await createTestUser();
      const recipient = await createTestUser();

      // Content too short (< 1 char)
      await expect(
        messageService.sendMessage(sender.id, {
          recipientId: recipient.id,
          content: '',
        })
      ).rejects.toThrow('Message content must be between 1 and 5000 characters');

      // Content too long (> 5000 chars)
      const longContent = 'a'.repeat(5001);
      await expect(
        messageService.sendMessage(sender.id, {
          recipientId: recipient.id,
          content: longContent,
        })
      ).rejects.toThrow('Message content must be between 1 and 5000 characters');
    });

    it('should prevent user from messaging themselves', async () => {
      const user = await createTestUser();

      await expect(
        messageService.sendMessage(user.id, {
          recipientId: user.id,
          content: 'Message to myself',
        })
      ).rejects.toThrow('Cannot send message to yourself');
    });

    it('should validate recipient exists', async () => {
      const sender = await createTestUser();

      await expect(
        messageService.sendMessage(sender.id, {
          recipientId: 'nonexistent-user-id',
          content: 'Hello!',
        })
      ).rejects.toThrow('Recipient not found');
    });
  });

  describe('getConversation', () => {
    it('should get conversation between two users', async () => {
      const user1 = await createTestUser({ username: 'user1' });
      const user2 = await createTestUser({ username: 'user2' });

      // Send messages in both directions
      await messageService.sendMessage(user1.id, {
        recipientId: user2.id,
        content: 'Message 1',
      });
      await messageService.sendMessage(user2.id, {
        recipientId: user1.id,
        content: 'Message 2',
      });
      await messageService.sendMessage(user1.id, {
        recipientId: user2.id,
        content: 'Message 3',
      });

      const conversation = await messageService.getConversation(user1.id, user2.id);

      expect(conversation.messages).toHaveLength(3);
      expect(conversation.messages[0]!.content).toBe('Message 1');
      expect(conversation.messages[1]!.content).toBe('Message 2');
      expect(conversation.messages[2]!.content).toBe('Message 3');
    });

    it('should auto-mark messages as read when conversation viewed', async () => {
      const sender = await createTestUser({ username: 'sender' });
      const recipient = await createTestUser({ username: 'recipient' });

      // Sender sends message
      await messageService.sendMessage(sender.id, {
        recipientId: recipient.id,
        content: 'Unread message',
      });

      // Verify unread
      let unreadCount = await messageRepository.getUnreadCount(recipient.id);
      expect(unreadCount).toBe(1);

      // Recipient views conversation
      await messageService.getConversation(recipient.id, sender.id);

      // Verify marked as read
      unreadCount = await messageRepository.getUnreadCount(recipient.id);
      expect(unreadCount).toBe(0);
    });
  });

  describe('getConversations', () => {
    it('should list all conversations for a user', async () => {
      const user = await createTestUser({ username: 'mainuser' });
      const partner1 = await createTestUser({ username: 'partner1' });
      const partner2 = await createTestUser({ username: 'partner2' });

      // Create conversations with 2 different users
      await messageService.sendMessage(partner1.id, {
        recipientId: user.id,
        content: 'Message from partner 1',
      });
      await messageService.sendMessage(partner2.id, {
        recipientId: user.id,
        content: 'Message from partner 2',
      });

      const conversations = await messageService.getConversations(user.id);

      expect(conversations).toHaveLength(2);
      expect(conversations[0]!.unreadCount).toBe(1); // Latest conversation first
      expect(conversations[1]!.unreadCount).toBe(1);
    });

    it('should show latest message in each conversation', async () => {
      const user = await createTestUser();
      const partner = await createTestUser();

      await messageService.sendMessage(user.id, {
        recipientId: partner.id,
        content: 'First message',
      });
      await messageService.sendMessage(partner.id, {
        recipientId: user.id,
        content: 'Latest message',
      });

      const conversations = await messageService.getConversations(user.id);

      expect(conversations).toHaveLength(1);
      expect(conversations[0]!.latestMessage.content).toBe('Latest message');
    });
  });

  describe('markConversationAsRead', () => {
    it('should mark all messages in conversation as read', async () => {
      const sender = await createTestUser();
      const recipient = await createTestUser();

      // Send multiple messages
      await messageService.sendMessage(sender.id, {
        recipientId: recipient.id,
        content: 'Message 1',
      });
      await messageService.sendMessage(sender.id, {
        recipientId: recipient.id,
        content: 'Message 2',
      });
      await messageService.sendMessage(sender.id, {
        recipientId: recipient.id,
        content: 'Message 3',
      });

      // Verify unread
      let unreadCount = await messageRepository.getUnreadCount(recipient.id);
      expect(unreadCount).toBe(3);

      // Mark as read
      const markedCount = await messageService.markConversationAsRead(
        recipient.id,
        sender.id
      );
      expect(markedCount).toBe(3);

      // Verify all read
      unreadCount = await messageRepository.getUnreadCount(recipient.id);
      expect(unreadCount).toBe(0);
    });
  });

  describe('getUnreadCount', () => {
    it('should count total unread messages for user', async () => {
      const user = await createTestUser();
      const sender1 = await createTestUser();
      const sender2 = await createTestUser();

      // Send unread messages from multiple senders
      await messageService.sendMessage(sender1.id, {
        recipientId: user.id,
        content: 'Unread 1',
      });
      await messageService.sendMessage(sender1.id, {
        recipientId: user.id,
        content: 'Unread 2',
      });
      await messageService.sendMessage(sender2.id, {
        recipientId: user.id,
        content: 'Unread 3',
      });

      const unreadCount = await messageService.getUnreadCount(user.id);
      expect(unreadCount).toBe(3);
    });
  });
});
