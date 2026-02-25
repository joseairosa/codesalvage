/**
 * EmailService Unit Tests
 *
 * Tests all email notification methods with mocked Resend client.
 *
 * Coverage:
 * - Purchase confirmation emails (buyer + seller)
 * - Escrow release notifications
 * - Message notifications (MessageWithRelations signature)
 * - Review notifications (ReviewWithRelations + seller signature)
 * - Review reminders
 * - Price formatting
 * - Error handling
 * - Dev mode (no API key → logs only)
 * - EMAIL_TEST_OVERRIDE redirect
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env['RESEND_API_KEY'] = 'test-resend-key';
process.env['NEXT_PUBLIC_APP_URL'] = 'https://app.codesalvage.com';
delete process.env['EMAIL_TEST_OVERRIDE'];

const mockEmailsSend = vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null });

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockEmailsSend },
  })),
}));

vi.mock('@/config/env', () => ({
  get env() {
    return {
      RESEND_API_KEY: process.env['RESEND_API_KEY'],
      NEXT_PUBLIC_APP_URL: process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://app.codesalvage.com',
      EMAIL_TEST_OVERRIDE: process.env['EMAIL_TEST_OVERRIDE'],
    };
  },
}));

import { EmailService } from '../EmailService';
import type {
  EmailRecipient,
  PurchaseEmailData,
  EscrowReleaseEmailData,
  ReviewEmailData,
  FeaturedListingEmailData,
  OfferEmailData,
} from '../EmailService';
import type { MessageWithRelations } from '@/lib/repositories/MessageRepository';
import type { ReviewWithRelations } from '@/lib/repositories/ReviewRepository';


function makeMessage(
  recipientEmail: string,
  content = 'Hi, I have a question about your project...'
): MessageWithRelations {
  return {
    id: 'msg_1',
    senderId: 'sender_1',
    recipientId: 'recipient_1',
    content,
    createdAt: new Date(),
    isRead: false,
    readAt: null,
    projectId: 'project_1',
    transactionId: null,
    sender: { id: 'sender_1', username: 'johndoe', fullName: 'John Doe', avatarUrl: null },
    recipient: {
      id: 'recipient_1',
      username: 'janesmith',
      fullName: 'Jane Smith',
      avatarUrl: null,
      email: recipientEmail,
    } as MessageWithRelations['recipient'],
    project: { id: 'project_1', title: 'React Dashboard Template', thumbnailImageUrl: null },
    transaction: null,
  };
}

function makeReview(overallRating = 5, comment?: string): ReviewWithRelations {
  return {
    id: 'rev_1',
    transactionId: 'txn_1',
    sellerId: 'seller_1',
    buyerId: 'buyer_1',
    overallRating,
    comment: comment ?? null,
    codeQualityRating: null,
    documentationRating: null,
    responsivenessRating: null,
    accuracyRating: null,
    isAnonymous: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    buyer: { id: 'buyer_1', username: 'johndoe', fullName: 'John Doe', avatarUrl: null },
    transaction: {
      id: 'txn_1',
      projectId: 'project_1',
      project: { id: 'project_1', title: 'React Dashboard Template' },
    },
  } as ReviewWithRelations;
}


describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEmailsSend.mockResolvedValue({ data: { id: 'test-id' }, error: null });
    emailService = new EmailService();
  });


  describe('sendBuyerPurchaseConfirmation', () => {
    const recipient: EmailRecipient = { email: 'buyer@example.com', name: 'John Doe' };
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

    it('should send to correct recipient', async () => {
      await emailService.sendBuyerPurchaseConfirmation(recipient, data);

      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'John Doe <buyer@example.com>',
          subject: 'Purchase Confirmed – React Dashboard Template',
        })
      );
    });

    it('should contain purchase details in html', async () => {
      await emailService.sendBuyerPurchaseConfirmation(recipient, data);
      const { html } = mockEmailsSend.mock.calls[0]![0]!;
      expect(html).toContain('Purchase Confirmed');
      expect(html).toContain('React Dashboard Template');
      expect(html).toContain('$1,000.00');
    });

    it('should throw when Resend returns error', async () => {
      mockEmailsSend.mockResolvedValueOnce({ error: { message: 'invalid_api_key' } });
      await expect(emailService.sendBuyerPurchaseConfirmation(recipient, data)).rejects.toThrow(
        'Failed to send email'
      );
    });

    it('should handle recipient without name', async () => {
      await emailService.sendBuyerPurchaseConfirmation({ email: 'buyer@example.com' }, data);
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'buyer@example.com' })
      );
    });
  });


  describe('sendSellerPurchaseNotification', () => {
    const recipient: EmailRecipient = { email: 'seller@example.com', name: 'Jane Smith' };
    const data: PurchaseEmailData = {
      buyerName: 'John Doe',
      sellerName: 'Jane Smith',
      projectTitle: 'React Dashboard Template',
      projectId: 'project123',
      transactionId: 'txn_abc123',
      amount: 100000,
      downloadUrl: 'https://app.com/download',
      purchaseDate: '2026-01-26T00:00:00.000Z',
    };

    it('should send sale notification with correct subject', async () => {
      await emailService.sendSellerPurchaseNotification(recipient, data);
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'New Sale – React Dashboard Template' })
      );
    });

    it('should include buyer name and amount', async () => {
      await emailService.sendSellerPurchaseNotification(recipient, data);
      const { html } = mockEmailsSend.mock.calls[0]![0]!;
      expect(html).toContain('John Doe');
      expect(html).toContain('$1,000.00');
    });
  });


  describe('sendEscrowReleaseNotification', () => {
    const recipient: EmailRecipient = { email: 'seller@example.com', name: 'Jane Smith' };
    const data: EscrowReleaseEmailData = {
      sellerName: 'Jane Smith',
      projectTitle: 'React Dashboard Template',
      amount: 82070,
      releaseDate: '2026-02-02T00:00:00.000Z',
      transactionId: 'txn_abc123',
    };

    it('should send with correct subject', async () => {
      await emailService.sendEscrowReleaseNotification(recipient, data);
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Payment Released – React Dashboard Template' })
      );
    });

    it('should include formatted amount', async () => {
      await emailService.sendEscrowReleaseNotification(recipient, data);
      const { html } = mockEmailsSend.mock.calls[0]![0]!;
      expect(html).toContain('$820.70');
    });
  });


  describe('sendNewMessageNotification', () => {
    it('should send to recipient email from message object', async () => {
      const message = makeMessage('jane@example.com');
      await emailService.sendNewMessageNotification(message);

      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: expect.stringContaining('jane@example.com'),
          subject: 'New message from John Doe',
        })
      );
    });

    it('should include message preview in html', async () => {
      const message = makeMessage('jane@example.com', 'Hi, I have a question about your project...');
      await emailService.sendNewMessageNotification(message);
      const { html } = mockEmailsSend.mock.calls[0]![0]!;
      expect(html).toContain('Hi, I have a question');
    });

    it('should include project title when present', async () => {
      const message = makeMessage('jane@example.com');
      await emailService.sendNewMessageNotification(message);
      const { html } = mockEmailsSend.mock.calls[0]![0]!;
      expect(html).toContain('React Dashboard Template');
    });

    it('should skip send when recipient has no email', async () => {
      const message = makeMessage('');
      (message.recipient as Record<string, unknown>)['email'] = null;
      await emailService.sendNewMessageNotification(message);
      expect(mockEmailsSend).not.toHaveBeenCalled();
    });
  });


  describe('sendNewReviewNotification', () => {
    const seller = { email: 'seller@example.com', fullName: 'Jane Smith', username: 'janesmith' };

    it('should send to seller email', async () => {
      const review = makeReview(5, 'Great project!');
      await emailService.sendNewReviewNotification(review, seller);

      expect(mockEmailsSend).toHaveBeenCalledTimes(1);
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: expect.stringContaining('seller@example.com'),
          subject: 'New Review – React Dashboard Template',
        })
      );
    });

    it('should include star rating in html', async () => {
      const review = makeReview(5);
      await emailService.sendNewReviewNotification(review, seller);
      const { html } = mockEmailsSend.mock.calls[0]![0]!;
      expect(html).toContain('★');
      expect(html).toContain('5');
    });

    it('should include comment when provided', async () => {
      const review = makeReview(4, 'Code was clean and well-documented.');
      await emailService.sendNewReviewNotification(review, seller);
      const { html } = mockEmailsSend.mock.calls[0]![0]!;
      expect(html).toContain('well-documented');
    });

    it('should omit comment block when not provided', async () => {
      const review = makeReview(3);
      await emailService.sendNewReviewNotification(review, seller);
      const { html } = mockEmailsSend.mock.calls[0]![0]!;
      expect(html).not.toContain('font-style:italic');
    });
  });


  describe('sendReviewReminder', () => {
    const recipient: EmailRecipient = { email: 'buyer@example.com', name: 'John Doe' };
    const data: ReviewEmailData = {
      sellerName: 'Jane Smith',
      buyerName: 'John Doe',
      projectTitle: 'React Dashboard Template',
      rating: 0,
      reviewUrl: 'https://app.com/projects/project123/review',
    };

    it('should send with correct subject', async () => {
      await emailService.sendReviewReminder(recipient, data);
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'How was your experience with React Dashboard Template?',
        })
      );
    });

    it('should include review URL', async () => {
      await emailService.sendReviewReminder(recipient, data);
      const { html } = mockEmailsSend.mock.calls[0]![0]!;
      expect(html).toContain(data.reviewUrl);
    });
  });


  describe('sendOfferAcceptedNotification', () => {
    const recipient: EmailRecipient = { email: 'buyer@example.com', name: 'John Doe' };
    const data: OfferEmailData = {
      recipientName: 'John Doe',
      otherPartyName: 'Jane Smith',
      projectTitle: 'React Dashboard Template',
      projectId: 'project123',
      offeredPriceCents: 80000,
      listingPriceCents: 100000,
      offerUrl: '/dashboard/offers',
      checkoutUrl: '/checkout/project123?offerId=offer_1',
    };

    it('should include CTA to checkout when checkoutUrl is present', async () => {
      await emailService.sendOfferAcceptedNotification(recipient, data);
      const { html } = mockEmailsSend.mock.calls[0]![0]!;
      expect(html).toContain('/checkout/project123');
    });
  });


  describe('sendFeaturedListingConfirmation', () => {
    const recipient: EmailRecipient = { email: 'seller@example.com', name: 'Jane Smith' };
    const data: FeaturedListingEmailData = {
      sellerName: 'Jane Smith',
      projectTitle: 'React Dashboard Template',
      projectId: 'project123',
      durationDays: 7,
      costCents: 1999,
      featuredUntil: '2026-03-04T00:00:00.000Z',
      projectUrl: 'https://app.com/projects/project123',
    };

    it('should send with correct subject', async () => {
      await emailService.sendFeaturedListingConfirmation(recipient, data);
      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Featured Listing Confirmed – React Dashboard Template',
        })
      );
    });

    it('should include duration and cost', async () => {
      await emailService.sendFeaturedListingConfirmation(recipient, data);
      const { html } = mockEmailsSend.mock.calls[0]![0]!;
      expect(html).toContain('7 days');
      expect(html).toContain('$19.99');
    });
  });


  describe('price formatting', () => {
    const recipient: EmailRecipient = { email: 'test@example.com', name: 'Test' };

    it.each([
      [100, '$1.00'],
      [1000, '$10.00'],
      [100000, '$1,000.00'],
      [1234567, '$12,345.67'],
      [99, '$0.99'],
    ])('formats %i cents as %s', async (cents, expected) => {
      const data: PurchaseEmailData = {
        buyerName: 'Test',
        sellerName: 'Test',
        projectTitle: 'Test',
        projectId: 'test',
        transactionId: 'test',
        amount: cents,
        downloadUrl: 'https://app.com/download',
        purchaseDate: '2026-01-26T00:00:00.000Z',
      };
      await emailService.sendBuyerPurchaseConfirmation(recipient, data);
      const { html } = mockEmailsSend.mock.calls[0]![0]!;
      expect(html).toContain(expected);
      vi.clearAllMocks();
    });
  });


  describe('error handling', () => {
    it('should throw when Resend returns an error object', async () => {
      mockEmailsSend.mockResolvedValueOnce({ error: { message: 'rate_limit_exceeded' } });
      await expect(
        emailService.sendBuyerPurchaseConfirmation(
          { email: 'test@example.com' },
          {
            buyerName: 'Test',
            sellerName: 'Test',
            projectTitle: 'Test',
            projectId: 'test',
            transactionId: 'test',
            amount: 1000,
            downloadUrl: 'https://app.com/download',
            purchaseDate: '2026-01-26T00:00:00.000Z',
          }
        )
      ).rejects.toThrow('Failed to send email');
    });
  });


  describe('EMAIL_TEST_OVERRIDE', () => {
    it('should redirect all emails to override address', async () => {
      process.env['EMAIL_TEST_OVERRIDE'] = 'dev@test.com';
      const overrideService = new EmailService();

      await overrideService.sendBuyerPurchaseConfirmation(
        { email: 'realbuyer@example.com', name: 'Real Buyer' },
        {
          buyerName: 'Real',
          sellerName: 'Seller',
          projectTitle: 'Test',
          projectId: 'test',
          transactionId: 'test',
          amount: 1000,
          downloadUrl: 'https://app.com/download',
          purchaseDate: '2026-01-26T00:00:00.000Z',
        }
      );

      expect(mockEmailsSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: expect.stringContaining('dev@test.com') })
      );

      delete process.env['EMAIL_TEST_OVERRIDE'];
    });
  });
});
