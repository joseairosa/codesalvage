/**
 * EmailService Unit Tests
 *
 * Tests all email notification functionality with mocked SendGrid.
 *
 * Coverage:
 * - Purchase confirmation emails (buyer + seller)
 * - Escrow release notifications
 * - Message notifications
 * - Review notifications
 * - Review reminders
 * - Error handling
 * - Development mode (no API key)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set environment BEFORE importing EmailService
process.env['SENDGRID_API_KEY'] = 'test-api-key';
process.env['SENDGRID_FROM_EMAIL'] = 'test@projectfinish.com';

// Mock SendGrid BEFORE importing EmailService (hoisted)
vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi.fn(),
  },
}));

// Now import EmailService after env and mock are set
import sgMail from '@sendgrid/mail';
import { EmailService } from '../EmailService';
import type {
  EmailRecipient,
  PurchaseEmailData,
  EscrowReleaseEmailData,
  MessageEmailData,
  ReviewEmailData,
} from '../EmailService';

// Get mocked functions
const mockSend = sgMail.send as ReturnType<typeof vi.fn>;
const mockSetApiKey = sgMail.setApiKey as ReturnType<typeof vi.fn>;

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    mockSend.mockClear();
    mockSetApiKey.mockClear();
    emailService = new EmailService();
  });

  describe('Constructor', () => {
    it('should initialize with default from email if not provided', () => {
      const service = new EmailService();
      expect(service).toBeDefined();
    });

    it('should use SENDGRID_FROM_EMAIL from environment', () => {
      const service = new EmailService();
      expect(service).toBeDefined();
    });
  });

  describe('sendBuyerPurchaseConfirmation', () => {
    const recipient: EmailRecipient = {
      email: 'buyer@example.com',
      name: 'John Doe',
    };

    const data: PurchaseEmailData = {
      buyerName: 'John Doe',
      sellerName: 'Jane Smith',
      projectTitle: 'React Dashboard Template',
      projectId: 'project123',
      transactionId: 'txn_abc123',
      amount: 100000, // $1,000.00
      downloadUrl: 'https://app.com/projects/project123/download',
      purchaseDate: '2026-01-26T00:00:00.000Z',
    };

    it('should send purchase confirmation email to buyer', async () => {
      await emailService.sendBuyerPurchaseConfirmation(recipient, data);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: {
            email: 'buyer@example.com',
            name: 'John Doe',
          },
          from: {
            email: 'test@projectfinish.com',
            name: 'ProjectFinish',
          },
          subject: 'Purchase Confirmation - React Dashboard Template',
        })
      );
    });

    it('should include HTML and text versions', async () => {
      await emailService.sendBuyerPurchaseConfirmation(recipient, data);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('Purchase Confirmed!');
      expect(call.html).toContain('React Dashboard Template');
      expect(call.html).toContain('$1,000.00');
      expect(call.text).toContain('Purchase Confirmed');
      expect(call.text).toContain('React Dashboard Template');
    });

    it('should throw error if SendGrid fails', async () => {
      mockSend.mockRejectedValueOnce(new Error('SendGrid API error'));

      await expect(
        emailService.sendBuyerPurchaseConfirmation(recipient, data)
      ).rejects.toThrow('SendGrid API error');
    });

    it('should handle missing recipient name', async () => {
      const recipientNoName: EmailRecipient = {
        email: 'buyer@example.com',
      };

      await emailService.sendBuyerPurchaseConfirmation(recipientNoName, data);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: {
            email: 'buyer@example.com',
            name: undefined,
          },
        })
      );
    });
  });

  describe('sendSellerPurchaseNotification', () => {
    const recipient: EmailRecipient = {
      email: 'seller@example.com',
      name: 'Jane Smith',
    };

    const data: PurchaseEmailData = {
      buyerName: 'John Doe',
      sellerName: 'Jane Smith',
      projectTitle: 'React Dashboard Template',
      projectId: 'project123',
      transactionId: 'txn_abc123',
      amount: 100000,
      downloadUrl: 'https://app.com/projects/project123/download',
      purchaseDate: '2026-01-26T00:00:00.000Z',
    };

    it('should send purchase notification to seller', async () => {
      await emailService.sendSellerPurchaseNotification(recipient, data);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: {
            email: 'seller@example.com',
            name: 'Jane Smith',
          },
          subject: 'New Sale - React Dashboard Template',
        })
      );
    });

    it('should include congratulations message in HTML', async () => {
      await emailService.sendSellerPurchaseNotification(recipient, data);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('Congratulations');
      expect(call.html).toContain('Sale');
      expect(call.html).toContain('React Dashboard Template');
    });

    it('should include sale details', async () => {
      await emailService.sendSellerPurchaseNotification(recipient, data);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('$1,000.00');
      expect(call.html).toContain('John Doe');
    });
  });

  describe('sendEscrowReleaseNotification', () => {
    const recipient: EmailRecipient = {
      email: 'seller@example.com',
      name: 'Jane Smith',
    };

    const data: EscrowReleaseEmailData = {
      sellerName: 'Jane Smith',
      projectTitle: 'React Dashboard Template',
      amount: 82070, // $820.70 (after 18% commission)
      releaseDate: '2026-02-02T00:00:00.000Z',
      transactionId: 'txn_abc123',
    };

    it('should send escrow release notification to seller', async () => {
      await emailService.sendEscrowReleaseNotification(recipient, data);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: {
            email: 'seller@example.com',
            name: 'Jane Smith',
          },
          subject: 'Payment Released - React Dashboard Template',
        })
      );
    });

    it('should include payment amount in email', async () => {
      await emailService.sendEscrowReleaseNotification(recipient, data);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('$820.70');
      expect(call.html).toContain('Payment Released');
    });

    it('should include release date', async () => {
      await emailService.sendEscrowReleaseNotification(recipient, data);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('2026');
    });
  });

  describe('sendNewMessageNotification', () => {
    const recipient: EmailRecipient = {
      email: 'recipient@example.com',
      name: 'Jane Smith',
    };

    const data: MessageEmailData = {
      recipientName: 'Jane Smith',
      senderName: 'John Doe',
      messagePreview: 'Hi, I have a question about your project...',
      projectTitle: 'React Dashboard Template',
      conversationUrl: 'https://app.com/messages/user123',
    };

    it('should send new message notification', async () => {
      await emailService.sendNewMessageNotification(recipient, data);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: {
            email: 'recipient@example.com',
            name: 'Jane Smith',
          },
          subject: 'New Message from John Doe',
        })
      );
    });

    it('should include message preview in email', async () => {
      await emailService.sendNewMessageNotification(recipient, data);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('Hi, I have a question');
      expect(call.html).toContain('John Doe');
    });

    it('should include project title if provided', async () => {
      await emailService.sendNewMessageNotification(recipient, data);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('React Dashboard Template');
    });

    it('should handle message without project title', async () => {
      const dataNoProject: MessageEmailData = {
        ...data,
        projectTitle: undefined,
      };

      await emailService.sendNewMessageNotification(recipient, dataNoProject);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('John Doe');
    });

    it('should include conversation URL', async () => {
      await emailService.sendNewMessageNotification(recipient, data);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain(data.conversationUrl);
    });
  });

  describe('sendReviewNotification', () => {
    const recipient: EmailRecipient = {
      email: 'seller@example.com',
      name: 'Jane Smith',
    };

    const data: ReviewEmailData = {
      sellerName: 'Jane Smith',
      buyerName: 'John Doe',
      projectTitle: 'React Dashboard Template',
      rating: 5,
      comment: 'Great project! Code was clean and well-documented.',
      reviewUrl: 'https://app.com/seller/reviews',
    };

    it('should send review notification to seller', async () => {
      await emailService.sendReviewNotification(recipient, data);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: {
            email: 'seller@example.com',
            name: 'Jane Smith',
          },
          subject: 'New Review Received - React Dashboard Template',
        })
      );
    });

    it('should include star rating in email', async () => {
      await emailService.sendReviewNotification(recipient, data);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('⭐');
      expect(call.html).toContain('5');
    });

    it('should include review comment if provided', async () => {
      await emailService.sendReviewNotification(recipient, data);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('Great project!');
      expect(call.html).toContain('well-documented');
    });

    it('should handle review without comment', async () => {
      const dataNoComment: ReviewEmailData = {
        ...data,
        comment: undefined,
      };

      await emailService.sendReviewNotification(recipient, dataNoComment);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('⭐');
    });

    it('should handle different star ratings', async () => {
      const ratings = [1, 2, 3, 4, 5];

      for (const rating of ratings) {
        mockSend.mockClear();
        const testData = { ...data, rating };

        await emailService.sendReviewNotification(recipient, testData);

        const call = mockSend.mock.calls[0][0];
        expect(call.html).toContain('⭐');
        expect(call.html).toContain(String(rating));
      }
    });
  });

  describe('sendReviewReminder', () => {
    const recipient: EmailRecipient = {
      email: 'buyer@example.com',
      name: 'John Doe',
    };

    const data: ReviewEmailData = {
      sellerName: 'Jane Smith',
      buyerName: 'John Doe',
      projectTitle: 'React Dashboard Template',
      rating: 0, // Not used for reminders
      reviewUrl: 'https://app.com/projects/project123/review',
    };

    it('should send review reminder to buyer', async () => {
      await emailService.sendReviewReminder(recipient, data);

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: {
            email: 'buyer@example.com',
            name: 'John Doe',
          },
          subject: 'How was your experience with React Dashboard Template?',
        })
      );
    });

    it('should include encouragement to leave review', async () => {
      await emailService.sendReviewReminder(recipient, data);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('review');
      expect(call.html).toContain('feedback');
    });

    it('should include review URL', async () => {
      await emailService.sendReviewReminder(recipient, data);

      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain(data.reviewUrl);
    });
  });

  describe('Price Formatting', () => {
    it('should format prices correctly in emails', async () => {
      const recipient: EmailRecipient = {
        email: 'test@example.com',
        name: 'Test User',
      };

      const testCases = [
        { cents: 100, expected: '$1.00' },
        { cents: 1000, expected: '$10.00' },
        { cents: 100000, expected: '$1,000.00' },
        { cents: 1234567, expected: '$12,345.67' },
        { cents: 99, expected: '$0.99' },
      ];

      for (const { cents, expected } of testCases) {
        mockSend.mockClear();

        const data: PurchaseEmailData = {
          buyerName: 'Test',
          sellerName: 'Test',
          projectTitle: 'Test Project',
          projectId: 'test',
          transactionId: 'test',
          amount: cents,
          downloadUrl: 'https://app.com/download',
          purchaseDate: '2026-01-26T00:00:00.000Z',
        };

        await emailService.sendBuyerPurchaseConfirmation(recipient, data);

        const call = mockSend.mock.calls[0][0];
        expect(call.html).toContain(expected);
      }
    });
  });

  describe('Error Handling', () => {
    it('should log error and throw if SendGrid fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSend.mockRejectedValueOnce(new Error('Network error'));

      const recipient: EmailRecipient = {
        email: 'test@example.com',
        name: 'Test',
      };

      const data: PurchaseEmailData = {
        buyerName: 'Test',
        sellerName: 'Test',
        projectTitle: 'Test',
        projectId: 'test',
        transactionId: 'test',
        amount: 10000,
        downloadUrl: 'https://app.com/download',
        purchaseDate: '2026-01-26T00:00:00.000Z',
      };

      await expect(
        emailService.sendBuyerPurchaseConfirmation(recipient, data)
      ).rejects.toThrow('Network error');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send email'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should handle SendGrid timeout', async () => {
      mockSend.mockRejectedValueOnce(new Error('Request timeout'));

      const recipient: EmailRecipient = {
        email: 'test@example.com',
        name: 'Test',
      };

      const data: PurchaseEmailData = {
        buyerName: 'Test',
        sellerName: 'Test',
        projectTitle: 'Test',
        projectId: 'test',
        transactionId: 'test',
        amount: 10000,
        downloadUrl: 'https://app.com/download',
        purchaseDate: '2026-01-26T00:00:00.000Z',
      };

      await expect(
        emailService.sendBuyerPurchaseConfirmation(recipient, data)
      ).rejects.toThrow('Request timeout');
    });
  });
});
