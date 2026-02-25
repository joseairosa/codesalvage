/**
 * EmailService
 *
 * Thin facade over the email sub-modules. All sending logic lives in
 * lib/services/email/. This class wires up the Resend sender and delegates
 * to the appropriate module function.
 *
 * EMAIL_TEST_OVERRIDE — when set, every email is redirected to that address.
 */

import { env } from '@/config/env';
import { createEmailSender, type SendEmailFn } from './email/sender';
import * as purchase from './email/purchase-emails';
import * as offers from './email/offer-emails';
import * as reviews from './email/review-message-emails';
import * as listings from './email/listing-emails';
import * as account from './email/account-emails';
import type { MessageWithRelations } from '@/lib/repositories/MessageRepository';
import type { ReviewWithRelations } from '@/lib/repositories/ReviewRepository';

export type {
  EmailRecipient,
  PurchaseEmailData,
  EscrowReleaseEmailData,
  MessageEmailData,
  ReviewEmailData,
  FeaturedListingEmailData,
  OfferEmailData,
  UserBannedEmailData,
  UserUnbannedEmailData,
  RefundEmailData,
  WelcomeEmailData,
  PaymentFailedEmailData,
  RepoTransferEmailData,
  StripeConnectConfirmedEmailData,
} from './email/types';

import type {
  EmailRecipient,
  PurchaseEmailData,
  EscrowReleaseEmailData,
  ReviewEmailData,
  FeaturedListingEmailData,
  OfferEmailData,
  UserBannedEmailData,
  UserUnbannedEmailData,
  RefundEmailData,
  WelcomeEmailData,
  PaymentFailedEmailData,
  RepoTransferEmailData,
  StripeConnectConfirmedEmailData,
} from './email/types';

export class EmailService {
  private send: SendEmailFn;

  constructor() {
    this.send = createEmailSender(env.RESEND_API_KEY, env.EMAIL_TEST_OVERRIDE);
  }

  private get appUrl(): string {
    return env.NEXT_PUBLIC_APP_URL || 'http://localhost:3011';
  }

  sendWelcomeEmail(r: EmailRecipient, d: WelcomeEmailData): Promise<void> {
    return account.sendWelcomeEmail(this.send, this.appUrl, r, d);
  }

  sendBuyerPurchaseConfirmation(r: EmailRecipient, d: PurchaseEmailData): Promise<void> {
    return purchase.sendBuyerPurchaseConfirmation(this.send, this.appUrl, r, d);
  }

  sendSellerPurchaseNotification(r: EmailRecipient, d: PurchaseEmailData): Promise<void> {
    return purchase.sendSellerPurchaseNotification(this.send, this.appUrl, r, d);
  }

  sendEscrowReleaseNotification(
    r: EmailRecipient,
    d: EscrowReleaseEmailData
  ): Promise<void> {
    return purchase.sendEscrowReleaseNotification(this.send, this.appUrl, r, d);
  }

  sendEscrowReleasedBuyerCopy(
    r: EmailRecipient,
    d: EscrowReleaseEmailData & { buyerName: string }
  ): Promise<void> {
    return purchase.sendEscrowReleasedBuyerCopy(this.send, this.appUrl, r, d);
  }

  sendCodeDownloadedNotification(
    r: EmailRecipient,
    d: {
      sellerName: string;
      buyerName: string;
      projectTitle: string;
      transactionId: string;
    }
  ): Promise<void> {
    return purchase.sendCodeDownloadedNotification(this.send, this.appUrl, r, d);
  }

  sendNewMessageNotification(message: MessageWithRelations): Promise<void> {
    return purchase.sendNewMessageNotification(this.send, this.appUrl, message);
  }

  sendNewReviewNotification(
    review: ReviewWithRelations,
    seller: { email: string; fullName?: string | null; username: string }
  ): Promise<void> {
    return reviews.sendNewReviewNotification(this.send, this.appUrl, review, seller);
  }

  sendReviewReminder(r: EmailRecipient, d: ReviewEmailData): Promise<void> {
    return reviews.sendReviewReminder(this.send, this.appUrl, r, d);
  }

  sendNewOfferNotification(r: EmailRecipient, d: OfferEmailData): Promise<void> {
    return offers.sendNewOfferNotification(this.send, this.appUrl, r, d);
  }

  sendOfferCounteredNotification(r: EmailRecipient, d: OfferEmailData): Promise<void> {
    return offers.sendOfferCounteredNotification(this.send, this.appUrl, r, d);
  }

  sendOfferAcceptedNotification(r: EmailRecipient, d: OfferEmailData): Promise<void> {
    return offers.sendOfferAcceptedNotification(this.send, this.appUrl, r, d);
  }

  sendOfferRejectedNotification(r: EmailRecipient, d: OfferEmailData): Promise<void> {
    return offers.sendOfferRejectedNotification(this.send, this.appUrl, r, d);
  }

  sendOfferExpiredNotification(r: EmailRecipient, d: OfferEmailData): Promise<void> {
    return offers.sendOfferExpiredNotification(this.send, this.appUrl, r, d);
  }

  sendFeaturedListingConfirmation(
    r: EmailRecipient,
    d: FeaturedListingEmailData
  ): Promise<void> {
    return listings.sendFeaturedListingConfirmation(this.send, this.appUrl, r, d);
  }

  sendFeaturedListingExpirationWarning(
    r: EmailRecipient,
    d: FeaturedListingEmailData
  ): Promise<void> {
    return listings.sendFeaturedListingExpirationWarning(this.send, this.appUrl, r, d);
  }

  sendFeaturedListingExpired(
    r: EmailRecipient,
    d: FeaturedListingEmailData
  ): Promise<void> {
    return listings.sendFeaturedListingExpired(this.send, this.appUrl, r, d);
  }

  sendUserBannedNotification(r: EmailRecipient, d: UserBannedEmailData): Promise<void> {
    return account.sendUserBannedNotification(this.send, this.appUrl, r, d);
  }

  sendUserUnbannedNotification(
    r: EmailRecipient,
    d: UserUnbannedEmailData
  ): Promise<void> {
    return account.sendUserUnbannedNotification(this.send, this.appUrl, r, d);
  }

  sendRefundNotification(r: EmailRecipient, d: RefundEmailData): Promise<void> {
    return account.sendRefundNotification(this.send, this.appUrl, r, d);
  }

  sendPaymentFailedNotification(
    r: EmailRecipient,
    d: PaymentFailedEmailData
  ): Promise<void> {
    return account.sendPaymentFailedNotification(this.send, this.appUrl, r, d);
  }

  sendRepoTransferCompleteNotification(
    r: EmailRecipient,
    d: RepoTransferEmailData
  ): Promise<void> {
    return account.sendRepoTransferCompleteNotification(this.send, this.appUrl, r, d);
  }

  sendStripeConnectConfirmedNotification(
    r: EmailRecipient,
    d: StripeConnectConfirmedEmailData
  ): Promise<void> {
    return account.sendStripeConnectConfirmedNotification(this.send, this.appUrl, r, d);
  }
}

export const emailService = new EmailService();
