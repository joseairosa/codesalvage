/**
 * Email Service
 *
 * Handles all email notifications via Postmark.
 * Provides type-safe methods for sending transactional emails.
 *
 * Email Types:
 * - Purchase confirmation (buyer + seller)
 * - Code download link (buyer)
 * - Escrow release notification (seller)
 * - New message notification
 * - Review submitted notification (seller)
 * - Review reminder (buyer)
 *
 * @example
 * await emailService.sendPurchaseConfirmation(transaction, buyer, seller);
 */

import * as postmark from 'postmark';
import { env } from '@/config/env';

const componentName = 'EmailService';

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface PurchaseEmailData {
  buyerName: string;
  sellerName: string;
  projectTitle: string;
  projectId: string;
  transactionId: string;
  amount: number; // in cents
  downloadUrl: string;
  purchaseDate: string;
}

export interface EscrowReleaseEmailData {
  sellerName: string;
  projectTitle: string;
  amount: number; // in cents
  releaseDate: string;
  transactionId: string;
}

export interface MessageEmailData {
  recipientName: string;
  senderName: string;
  messagePreview: string;
  projectTitle?: string;
  conversationUrl: string;
}

export interface ReviewEmailData {
  sellerName: string;
  buyerName: string;
  projectTitle: string;
  rating: number;
  comment?: string;
  reviewUrl: string;
}

export interface FeaturedListingEmailData {
  sellerName: string;
  projectTitle: string;
  projectId: string;
  durationDays: number;
  costCents: number;
  featuredUntil: string;
  projectUrl: string;
}

export interface UserBannedEmailData {
  username: string;
  reason: string;
  bannedAt: string;
  supportEmail: string;
}

export interface UserUnbannedEmailData {
  username: string;
  unbannedAt: string;
}

export class EmailService {
  private fromEmail: string;
  private fromName: string;
  private client: postmark.ServerClient | null = null;
  private isInitialized = false;

  constructor() {
    // Read from process.env directly to support test environment variable injection
    this.fromEmail =
      process.env['POSTMARK_FROM_EMAIL'] ||
      env.POSTMARK_FROM_EMAIL ||
      'noreply@codesalvage.com';
    this.fromName = 'CodeSalvage';
  }

  /**
   * Initialize Postmark (lazy initialization)
   * This is called on first email send to support testing
   *
   * NOTE: Reads from process.env directly (not cached env object) to support testing
   */
  private initializePostmark(): void {
    if (this.isInitialized) {
      return;
    }

    // Read from process.env directly to support test environment variable injection
    const apiKey = process.env['POSTMARK_SERVER_TOKEN'] || env.POSTMARK_SERVER_TOKEN;

    if (apiKey) {
      this.client = new postmark.ServerClient(apiKey);
      console.log(`[${componentName}] Postmark initialized`);
    } else {
      console.warn(
        `[${componentName}] Postmark API key not configured - emails will be logged only`
      );
    }

    this.isInitialized = true;
  }

  /**
   * Send purchase confirmation to buyer
   */
  async sendBuyerPurchaseConfirmation(
    recipient: EmailRecipient,
    data: PurchaseEmailData
  ): Promise<void> {
    const subject = `Purchase Confirmation - ${data.projectTitle}`;
    const html = this.getBuyerPurchaseConfirmationHTML(data);
    const text = this.getBuyerPurchaseConfirmationText(data);

    await this.sendEmail(recipient, subject, html, text);

    console.log(
      `[${componentName}] Purchase confirmation sent to buyer:`,
      recipient.email
    );
  }

  /**
   * Send purchase notification to seller
   */
  async sendSellerPurchaseNotification(
    recipient: EmailRecipient,
    data: PurchaseEmailData
  ): Promise<void> {
    const subject = `New Sale - ${data.projectTitle}`;
    const html = this.getSellerPurchaseNotificationHTML(data);
    const text = this.getSellerPurchaseNotificationText(data);

    await this.sendEmail(recipient, subject, html, text);

    console.log(
      `[${componentName}] Purchase notification sent to seller:`,
      recipient.email
    );
  }

  /**
   * Send escrow release notification to seller
   */
  async sendEscrowReleaseNotification(
    recipient: EmailRecipient,
    data: EscrowReleaseEmailData
  ): Promise<void> {
    const subject = `Payment Released - ${data.projectTitle}`;
    const html = this.getEscrowReleaseHTML(data);
    const text = this.getEscrowReleaseText(data);

    await this.sendEmail(recipient, subject, html, text);

    console.log(`[${componentName}] Escrow release notification sent:`, recipient.email);
  }

  /**
   * Send new message notification
   */
  async sendNewMessageNotification(
    recipient: EmailRecipient,
    data: MessageEmailData
  ): Promise<void> {
    const subject = `New Message from ${data.senderName}`;
    const html = this.getNewMessageHTML(data);
    const text = this.getNewMessageText(data);

    await this.sendEmail(recipient, subject, html, text);

    console.log(`[${componentName}] Message notification sent:`, recipient.email);
  }

  /**
   * Send review submitted notification to seller
   */
  async sendReviewNotification(
    recipient: EmailRecipient,
    data: ReviewEmailData
  ): Promise<void> {
    const subject = `New Review Received - ${data.projectTitle}`;
    const html = this.getReviewNotificationHTML(data);
    const text = this.getReviewNotificationText(data);

    await this.sendEmail(recipient, subject, html, text);

    console.log(`[${componentName}] Review notification sent:`, recipient.email);
  }

  /**
   * Send review reminder to buyer
   */
  async sendReviewReminder(
    recipient: EmailRecipient,
    data: ReviewEmailData
  ): Promise<void> {
    const subject = `How was your experience with ${data.projectTitle}?`;
    const html = this.getReviewReminderHTML(data);
    const text = this.getReviewReminderText(data);

    await this.sendEmail(recipient, subject, html, text);

    console.log(`[${componentName}] Review reminder sent:`, recipient.email);
  }

  /**
   * Send featured listing purchase confirmation to seller
   */
  async sendFeaturedListingConfirmation(
    recipient: EmailRecipient,
    data: FeaturedListingEmailData
  ): Promise<void> {
    const subject = `Featured Listing Confirmed - ${data.projectTitle}`;
    const html = this.getFeaturedListingConfirmationHTML(data);
    const text = this.getFeaturedListingConfirmationText(data);

    await this.sendEmail(recipient, subject, html, text);

    console.log(
      `[${componentName}] Featured listing confirmation sent to seller:`,
      recipient.email
    );
  }

  /**
   * Send featured listing expiration warning (3 days before expiry)
   */
  async sendFeaturedListingExpirationWarning(
    recipient: EmailRecipient,
    data: FeaturedListingEmailData
  ): Promise<void> {
    const subject = `Featured Listing Expiring Soon - ${data.projectTitle}`;
    const html = this.getFeaturedListingExpirationWarningHTML(data);
    const text = this.getFeaturedListingExpirationWarningText(data);

    await this.sendEmail(recipient, subject, html, text);

    console.log(
      `[${componentName}] Featured listing expiration warning sent to seller:`,
      recipient.email
    );
  }

  /**
   * Send featured listing expired notification
   */
  async sendFeaturedListingExpired(
    recipient: EmailRecipient,
    data: FeaturedListingEmailData
  ): Promise<void> {
    const subject = `Featured Listing Expired - ${data.projectTitle}`;
    const html = this.getFeaturedListingExpiredHTML(data);
    const text = this.getFeaturedListingExpiredText(data);

    await this.sendEmail(recipient, subject, html, text);

    console.log(
      `[${componentName}] Featured listing expired notification sent:`,
      recipient.email
    );
  }

  /**
   * Internal method to send email via Postmark
   */
  private async sendEmail(
    recipient: EmailRecipient,
    subject: string,
    html: string,
    text: string
  ): Promise<void> {
    // Initialize Postmark on first use (lazy initialization for testing)
    this.initializePostmark();

    // Check for API key (read from process.env to support testing)
    const apiKey = process.env['POSTMARK_SERVER_TOKEN'] || env.POSTMARK_SERVER_TOKEN;

    if (!apiKey || !this.client) {
      console.log(`[${componentName}] Email would be sent (dev mode):`, {
        to: recipient.email,
        subject,
        textPreview: text.slice(0, 100),
      });
      return;
    }

    try {
      await this.client.sendEmail({
        From: `${this.fromName} <${this.fromEmail}>`,
        To: recipient.name
          ? `${recipient.name} <${recipient.email}>`
          : recipient.email,
        Subject: subject,
        HtmlBody: html,
        TextBody: text,
        MessageStream: 'outbound',
      });

      console.log(`[${componentName}] Email sent successfully to:`, recipient.email);
    } catch (error) {
      console.error(`[${componentName}] Failed to send email:`, error);
      throw error;
    }
  }

  /**
   * Format price in cents to USD
   */
  private formatPrice(cents: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }

  /**
   * Email Templates - Buyer Purchase Confirmation
   */
  private getBuyerPurchaseConfirmationHTML(data: PurchaseEmailData): string {
    const appUrl = env.NEXT_PUBLIC_APP_URL;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
    Purchase Confirmed!
  </h1>

  <p>Hi ${data.buyerName},</p>

  <p>Thank you for your purchase! Your order has been confirmed.</p>

  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h2 style="margin-top: 0;">Order Details</h2>
    <p><strong>Project:</strong> ${data.projectTitle}</p>
    <p><strong>Amount:</strong> ${this.formatPrice(data.amount)}</p>
    <p><strong>Order ID:</strong> ${data.transactionId}</p>
    <p><strong>Date:</strong> ${new Date(data.purchaseDate).toLocaleDateString()}</p>
  </div>

  <h3>Download Your Code</h3>
  <p>Your project code is ready to download:</p>

  <a href="${data.downloadUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">
    Download Code
  </a>

  <p style="font-size: 14px; color: #666;">
    This link will expire in 7 days. You can generate a new download link anytime from your <a href="${appUrl}/buyer/purchases">purchases page</a>.
  </p>

  <h3>Escrow Protection</h3>
  <p>Your payment is held in escrow for 7 days. During this time, you can:</p>
  <ul>
    <li>Download and review the code</li>
    <li>Contact the seller if you have questions</li>
    <li>Request a refund if the project doesn't match the description</li>
  </ul>

  <p>After 7 days, the payment will be automatically released to the seller.</p>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

  <p style="font-size: 14px; color: #666;">
    Questions? <a href="${appUrl}/messages/${data.transactionId}">Contact the seller</a> or reach out to our support team.
  </p>

  <p style="font-size: 12px; color: #999;">
    CodeSalvage - Marketplace for Incomplete Software Projects<br>
    <a href="${appUrl}">Visit our website</a>
  </p>
</body>
</html>
    `.trim();
  }

  private getBuyerPurchaseConfirmationText(data: PurchaseEmailData): string {
    const appUrl = env.NEXT_PUBLIC_APP_URL;

    return `
Purchase Confirmed!

Hi ${data.buyerName},

Thank you for your purchase! Your order has been confirmed.

ORDER DETAILS
Project: ${data.projectTitle}
Amount: ${this.formatPrice(data.amount)}
Order ID: ${data.transactionId}
Date: ${new Date(data.purchaseDate).toLocaleDateString()}

DOWNLOAD YOUR CODE
Your project code is ready to download:
${data.downloadUrl}

This link will expire in 7 days. You can generate a new download link anytime from your purchases page:
${appUrl}/buyer/purchases

ESCROW PROTECTION
Your payment is held in escrow for 7 days. During this time, you can:
- Download and review the code
- Contact the seller if you have questions
- Request a refund if the project doesn't match the description

After 7 days, the payment will be automatically released to the seller.

Questions? Contact the seller or reach out to our support team.

CodeSalvage - Marketplace for Incomplete Software Projects
${appUrl}
    `.trim();
  }

  /**
   * Email Templates - Seller Purchase Notification
   */
  private getSellerPurchaseNotificationHTML(data: PurchaseEmailData): string {
    const appUrl = env.NEXT_PUBLIC_APP_URL;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px;">
    Congratulations! You Made a Sale! 🎉
  </h1>

  <p>Hi ${data.sellerName},</p>

  <p>Great news! Your project has been purchased.</p>

  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h2 style="margin-top: 0;">Sale Details</h2>
    <p><strong>Project:</strong> ${data.projectTitle}</p>
    <p><strong>Sale Amount:</strong> ${this.formatPrice(data.amount)}</p>
    <p><strong>Buyer:</strong> ${data.buyerName}</p>
    <p><strong>Date:</strong> ${new Date(data.purchaseDate).toLocaleDateString()}</p>
  </div>

  <h3>Payment Schedule</h3>
  <p>The payment will be held in escrow for 7 days to protect both you and the buyer. After this period, the funds will be automatically transferred to your Stripe account.</p>

  <h3>Next Steps</h3>
  <ul>
    <li>Be available to answer buyer questions via messaging</li>
    <li>Provide support if the buyer encounters issues</li>
    <li>Encourage the buyer to leave a review after completing the project</li>
  </ul>

  <a href="${appUrl}/seller/dashboard" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">
    View Dashboard
  </a>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

  <p style="font-size: 14px; color: #666;">
    Keep up the great work! 🚀
  </p>

  <p style="font-size: 12px; color: #999;">
    CodeSalvage - Marketplace for Incomplete Software Projects<br>
    <a href="${appUrl}">Visit our website</a>
  </p>
</body>
</html>
    `.trim();
  }

  private getSellerPurchaseNotificationText(data: PurchaseEmailData): string {
    const appUrl = env.NEXT_PUBLIC_APP_URL;

    return `
Congratulations! You Made a Sale!

Hi ${data.sellerName},

Great news! Your project has been purchased.

SALE DETAILS
Project: ${data.projectTitle}
Sale Amount: ${this.formatPrice(data.amount)}
Buyer: ${data.buyerName}
Date: ${new Date(data.purchaseDate).toLocaleDateString()}

PAYMENT SCHEDULE
The payment will be held in escrow for 7 days to protect both you and the buyer. After this period, the funds will be automatically transferred to your Stripe account.

NEXT STEPS
- Be available to answer buyer questions via messaging
- Provide support if the buyer encounters issues
- Encourage the buyer to leave a review after completing the project

View your dashboard: ${appUrl}/seller/dashboard

Keep up the great work!

CodeSalvage - Marketplace for Incomplete Software Projects
${appUrl}
    `.trim();
  }

  /**
   * Email Templates - Escrow Release
   */
  private getEscrowReleaseHTML(data: EscrowReleaseEmailData): string {
    const appUrl = env.NEXT_PUBLIC_APP_URL;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px;">
    Payment Released! 💰
  </h1>

  <p>Hi ${data.sellerName},</p>

  <p>Good news! The escrow period has ended and your payment has been released.</p>

  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h2 style="margin-top: 0;">Payment Details</h2>
    <p><strong>Project:</strong> ${data.projectTitle}</p>
    <p><strong>Amount Released:</strong> ${this.formatPrice(data.amount)}</p>
    <p><strong>Release Date:</strong> ${new Date(data.releaseDate).toLocaleDateString()}</p>
  </div>

  <p>The funds have been transferred to your Stripe account and should appear in your bank account within 2-3 business days.</p>

  <a href="${appUrl}/seller/dashboard" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">
    View Dashboard
  </a>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

  <p style="font-size: 12px; color: #999;">
    CodeSalvage - Marketplace for Incomplete Software Projects<br>
    <a href="${appUrl}">Visit our website</a>
  </p>
</body>
</html>
    `.trim();
  }

  private getEscrowReleaseText(data: EscrowReleaseEmailData): string {
    const appUrl = env.NEXT_PUBLIC_APP_URL;

    return `
Payment Released!

Hi ${data.sellerName},

Good news! The escrow period has ended and your payment has been released.

PAYMENT DETAILS
Project: ${data.projectTitle}
Amount Released: ${this.formatPrice(data.amount)}
Release Date: ${new Date(data.releaseDate).toLocaleDateString()}

The funds have been transferred to your Stripe account and should appear in your bank account within 2-3 business days.

View your dashboard: ${appUrl}/seller/dashboard

CodeSalvage - Marketplace for Incomplete Software Projects
${appUrl}
    `.trim();
  }

  /**
   * Email Templates - New Message
   */
  private getNewMessageHTML(data: MessageEmailData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
    New Message from ${data.senderName}
  </h1>

  <p>Hi ${data.recipientName},</p>

  <p>You have a new message${data.projectTitle ? ` about <strong>${data.projectTitle}</strong>` : ''}:</p>

  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="font-style: italic; margin: 0;">"${data.messagePreview}"</p>
  </div>

  <a href="${data.conversationUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">
    Reply to Message
  </a>

  <p style="font-size: 14px; color: #666; margin-top: 20px;">
    Quick responses help build trust and lead to more successful transactions!
  </p>
</body>
</html>
    `.trim();
  }

  private getNewMessageText(data: MessageEmailData): string {
    return `
New Message from ${data.senderName}

Hi ${data.recipientName},

You have a new message${data.projectTitle ? ` about ${data.projectTitle}` : ''}:

"${data.messagePreview}"

Reply here: ${data.conversationUrl}

Quick responses help build trust and lead to more successful transactions!
    `.trim();
  }

  /**
   * Email Templates - Review Notification
   */
  private getReviewNotificationHTML(data: ReviewEmailData): string {
    const stars = '⭐'.repeat(data.rating);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px;">
    New Review Received! ⭐
  </h1>

  <p>Hi ${data.sellerName},</p>

  <p>${data.buyerName} left a review for <strong>${data.projectTitle}</strong>:</p>

  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="font-size: 24px; margin: 0 0 10px 0;">${stars}</p>
    <p><strong>Rating:</strong> ${data.rating}/5 stars</p>
    ${data.comment ? `<p style="font-style: italic;">"${data.comment}"</p>` : ''}
  </div>

  <a href="${data.reviewUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">
    View Review
  </a>

  <p style="font-size: 14px; color: #666; margin-top: 20px;">
    Reviews help build your reputation and attract more buyers. Keep up the excellent work!
  </p>
</body>
</html>
    `.trim();
  }

  private getReviewNotificationText(data: ReviewEmailData): string {
    const stars = '⭐'.repeat(data.rating);

    return `
New Review Received!

Hi ${data.sellerName},

${data.buyerName} left a review for ${data.projectTitle}:

${stars} ${data.rating}/5 stars

${data.comment ? `"${data.comment}"` : ''}

View the review: ${data.reviewUrl}

Reviews help build your reputation and attract more buyers. Keep up the excellent work!
    `.trim();
  }

  /**
   * Email Templates - Review Reminder
   */
  private getReviewReminderHTML(data: ReviewEmailData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">
    How was your experience?
  </h1>

  <p>Hi ${data.buyerName},</p>

  <p>We hope you've had a chance to work with the code from <strong>${data.projectTitle}</strong>.</p>

  <p>Your feedback helps other buyers make informed decisions and helps sellers improve their projects. Would you take a minute to share your experience?</p>

  <a href="${data.reviewUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">
    Leave a Review
  </a>

  <p style="font-size: 14px; color: #666; margin-top: 20px;">
    Thank you for being part of the CodeSalvage community!
  </p>
</body>
</html>
    `.trim();
  }

  private getReviewReminderText(data: ReviewEmailData): string {
    return `
How was your experience?

Hi ${data.buyerName},

We hope you've had a chance to work with the code from ${data.projectTitle}.

Your feedback helps other buyers make informed decisions and helps sellers improve their projects. Would you take a minute to share your experience?

Leave a review: ${data.reviewUrl}

Thank you for being part of the CodeSalvage community!
    `.trim();
  }

  /**
   * Email Templates - Featured Listing Confirmation
   */
  private getFeaturedListingConfirmationHTML(data: FeaturedListingEmailData): string {
    const appUrl = env.NEXT_PUBLIC_APP_URL;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #8b5cf6; border-bottom: 2px solid #8b5cf6; padding-bottom: 10px;">
    Featured Listing Confirmed! ⭐
  </h1>

  <p>Hi ${data.sellerName},</p>

  <p>Great news! Your project is now featured on CodeSalvage.</p>

  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h2 style="margin-top: 0;">Featured Listing Details</h2>
    <p><strong>Project:</strong> ${data.projectTitle}</p>
    <p><strong>Duration:</strong> ${data.durationDays} days</p>
    <p><strong>Amount Paid:</strong> ${this.formatPrice(data.costCents)}</p>
    <p><strong>Featured Until:</strong> ${new Date(data.featuredUntil).toLocaleDateString()} at ${new Date(data.featuredUntil).toLocaleTimeString()}</p>
  </div>

  <h3>What This Means</h3>
  <p>Your project will receive premium placement on our platform, including:</p>
  <ul>
    <li><strong>Homepage Carousel</strong> - Displayed prominently to all visitors</li>
    <li><strong>Featured Badge</strong> - Stands out in search results</li>
    <li><strong>Priority Sorting</strong> - Appears above non-featured projects</li>
    <li><strong>Increased Visibility</strong> - Up to 5x more views on average</li>
  </ul>

  <a href="${data.projectUrl}" style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">
    View Your Featured Project
  </a>

  <h3>Maximize Your Featured Period</h3>
  <p>To get the most out of your featured listing:</p>
  <ul>
    <li>Respond quickly to buyer inquiries</li>
    <li>Keep your project description up-to-date</li>
    <li>Add high-quality screenshots if you haven't already</li>
    <li>Share your featured project on social media</li>
  </ul>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

  <p style="font-size: 14px; color: #666;">
    Want to feature another project? Visit your <a href="${appUrl}/seller/dashboard">seller dashboard</a>.
  </p>

  <p style="font-size: 12px; color: #999;">
    CodeSalvage - Marketplace for Incomplete Software Projects<br>
    <a href="${appUrl}">Visit our website</a>
  </p>
</body>
</html>
    `.trim();
  }

  private getFeaturedListingConfirmationText(data: FeaturedListingEmailData): string {
    const appUrl = env.NEXT_PUBLIC_APP_URL;

    return `
Featured Listing Confirmed!

Hi ${data.sellerName},

Great news! Your project is now featured on CodeSalvage.

FEATURED LISTING DETAILS
Project: ${data.projectTitle}
Duration: ${data.durationDays} days
Amount Paid: ${this.formatPrice(data.costCents)}
Featured Until: ${new Date(data.featuredUntil).toLocaleDateString()} at ${new Date(data.featuredUntil).toLocaleTimeString()}

WHAT THIS MEANS
Your project will receive premium placement on our platform, including:
- Homepage Carousel - Displayed prominently to all visitors
- Featured Badge - Stands out in search results
- Priority Sorting - Appears above non-featured projects
- Increased Visibility - Up to 5x more views on average

View your featured project: ${data.projectUrl}

MAXIMIZE YOUR FEATURED PERIOD
To get the most out of your featured listing:
- Respond quickly to buyer inquiries
- Keep your project description up-to-date
- Add high-quality screenshots if you haven't already
- Share your featured project on social media

Want to feature another project? Visit your seller dashboard:
${appUrl}/seller/dashboard

CodeSalvage - Marketplace for Incomplete Software Projects
${appUrl}
    `.trim();
  }

  /**
   * Email Templates - Featured Listing Expiration Warning
   */
  private getFeaturedListingExpirationWarningHTML(
    data: FeaturedListingEmailData
  ): string {
    const appUrl = env.NEXT_PUBLIC_APP_URL;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">
    Featured Listing Expiring Soon ⏰
  </h1>

  <p>Hi ${data.sellerName},</p>

  <p>Your featured listing for <strong>${data.projectTitle}</strong> will expire in 3 days.</p>

  <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Expires On:</strong> ${new Date(data.featuredUntil).toLocaleDateString()} at ${new Date(data.featuredUntil).toLocaleTimeString()}</p>
  </div>

  <h3>Want to Stay Featured?</h3>
  <p>Don't lose your premium placement! Extend your featured period to continue receiving increased visibility and more buyer interest.</p>

  <a href="${data.projectUrl}" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">
    Extend Featured Period
  </a>

  <h3>What Happens After Expiration</h3>
  <p>After your featured period ends:</p>
  <ul>
    <li>Your project will no longer appear in the featured carousel</li>
    <li>The featured badge will be removed</li>
    <li>Your project will return to standard search results</li>
  </ul>

  <p>You can renew your featured listing anytime from your seller dashboard.</p>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

  <p style="font-size: 12px; color: #999;">
    CodeSalvage - Marketplace for Incomplete Software Projects<br>
    <a href="${appUrl}">Visit our website</a>
  </p>
</body>
</html>
    `.trim();
  }

  private getFeaturedListingExpirationWarningText(
    data: FeaturedListingEmailData
  ): string {
    const appUrl = env.NEXT_PUBLIC_APP_URL;

    return `
Featured Listing Expiring Soon

Hi ${data.sellerName},

Your featured listing for ${data.projectTitle} will expire in 3 days.

EXPIRES ON: ${new Date(data.featuredUntil).toLocaleDateString()} at ${new Date(data.featuredUntil).toLocaleTimeString()}

WANT TO STAY FEATURED?
Don't lose your premium placement! Extend your featured period to continue receiving increased visibility and more buyer interest.

Extend featured period: ${data.projectUrl}

WHAT HAPPENS AFTER EXPIRATION
After your featured period ends:
- Your project will no longer appear in the featured carousel
- The featured badge will be removed
- Your project will return to standard search results

You can renew your featured listing anytime from your seller dashboard.

CodeSalvage - Marketplace for Incomplete Software Projects
${appUrl}
    `.trim();
  }

  /**
   * Email Templates - Featured Listing Expired
   */
  private getFeaturedListingExpiredHTML(data: FeaturedListingEmailData): string {
    const appUrl = env.NEXT_PUBLIC_APP_URL;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #6b7280; border-bottom: 2px solid #6b7280; padding-bottom: 10px;">
    Featured Listing Expired
  </h1>

  <p>Hi ${data.sellerName},</p>

  <p>Your featured listing for <strong>${data.projectTitle}</strong> has expired.</p>

  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p><strong>Project:</strong> ${data.projectTitle}</p>
    <p><strong>Featured Period:</strong> ${data.durationDays} days</p>
    <p><strong>Expired On:</strong> ${new Date(data.featuredUntil).toLocaleDateString()}</p>
  </div>

  <p>Your project is still active and visible in search results, but it no longer has featured status.</p>

  <h3>Feature Again?</h3>
  <p>Ready to boost your project's visibility again? Feature your project to:</p>
  <ul>
    <li>Appear in the homepage carousel</li>
    <li>Get priority in search results</li>
    <li>Reach more potential buyers</li>
    <li>Increase your chances of a sale</li>
  </ul>

  <a href="${data.projectUrl}" style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">
    Feature This Project Again
  </a>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

  <p style="font-size: 14px; color: #666;">
    Questions? Visit your <a href="${appUrl}/seller/dashboard">seller dashboard</a> or contact support.
  </p>

  <p style="font-size: 12px; color: #999;">
    CodeSalvage - Marketplace for Incomplete Software Projects<br>
    <a href="${appUrl}">Visit our website</a>
  </p>
</body>
</html>
    `.trim();
  }

  private getFeaturedListingExpiredText(data: FeaturedListingEmailData): string {
    const appUrl = env.NEXT_PUBLIC_APP_URL;

    return `
Featured Listing Expired

Hi ${data.sellerName},

Your featured listing for ${data.projectTitle} has expired.

PROJECT DETAILS
Project: ${data.projectTitle}
Featured Period: ${data.durationDays} days
Expired On: ${new Date(data.featuredUntil).toLocaleDateString()}

Your project is still active and visible in search results, but it no longer has featured status.

FEATURE AGAIN?
Ready to boost your project's visibility again? Feature your project to:
- Appear in the homepage carousel
- Get priority in search results
- Reach more potential buyers
- Increase your chances of a sale

Feature this project again: ${data.projectUrl}

Questions? Visit your seller dashboard or contact support:
${appUrl}/seller/dashboard

CodeSalvage - Marketplace for Incomplete Software Projects
${appUrl}
    `.trim();
  }

  /**
   * Send user banned notification
   */
  async sendUserBannedNotification(
    recipient: EmailRecipient,
    data: UserBannedEmailData
  ): Promise<void> {
    const subject = 'Your CodeSalvage account has been suspended';
    const html = this.getUserBannedHTML(data);
    const text = this.getUserBannedText(data);

    await this.sendEmail(recipient, subject, html, text);

    console.log(`[${componentName}] User banned notification sent:`, recipient.email);
  }

  /**
   * Send user unbanned notification
   */
  async sendUserUnbannedNotification(
    recipient: EmailRecipient,
    data: UserUnbannedEmailData
  ): Promise<void> {
    const subject = 'Your CodeSalvage account has been reactivated';
    const html = this.getUserUnbannedHTML(data);
    const text = this.getUserUnbannedText(data);

    await this.sendEmail(recipient, subject, html, text);

    console.log(`[${componentName}] User unbanned notification sent:`, recipient.email);
  }

  /**
   * Email Templates - User Banned
   */
  private getUserBannedHTML(data: UserBannedEmailData): string {
    const appUrl = env.NEXT_PUBLIC_APP_URL;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #ef4444; border-bottom: 2px solid #ef4444; padding-bottom: 10px;">
    Account Suspended
  </h1>

  <p>Hi ${data.username},</p>

  <p>Your CodeSalvage account has been suspended due to a violation of our Terms of Service.</p>

  <div style="background: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
    <h2 style="margin-top: 0; color: #991b1b;">Suspension Reason</h2>
    <p style="margin: 0;">${data.reason}</p>
  </div>

  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <h2 style="margin-top: 0;">What This Means</h2>
    <ul style="margin: 10px 0;">
      <li>You cannot access your dashboard</li>
      <li>Your projects are no longer visible on the marketplace</li>
      <li>You cannot purchase or sell projects</li>
      <li>Your messaging capabilities are disabled</li>
    </ul>
  </div>

  <h2>Think This Was a Mistake?</h2>
  <p>If you believe this suspension was made in error, please contact our support team:</p>
  <p><a href="mailto:${data.supportEmail}" style="color: #10b981;">${data.supportEmail}</a></p>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

  <p style="font-size: 12px; color: #6b7280;">
    Suspended: ${new Date(data.bannedAt).toLocaleString()}<br>
    CodeSalvage - Marketplace for Incomplete Software Projects<br>
    <a href="${appUrl}" style="color: #10b981;">${appUrl}</a>
  </p>
</body>
</html>
    `.trim();
  }

  private getUserBannedText(data: UserBannedEmailData): string {
    const appUrl = env.NEXT_PUBLIC_APP_URL;

    return `
ACCOUNT SUSPENDED

Hi ${data.username},

Your CodeSalvage account has been suspended due to a violation of our Terms of Service.

SUSPENSION REASON
${data.reason}

WHAT THIS MEANS
- You cannot access your dashboard
- Your projects are no longer visible on the marketplace
- You cannot purchase or sell projects
- Your messaging capabilities are disabled

THINK THIS WAS A MISTAKE?
If you believe this suspension was made in error, please contact our support team:
${data.supportEmail}

Suspended: ${new Date(data.bannedAt).toLocaleString()}

CodeSalvage - Marketplace for Incomplete Software Projects
${appUrl}
    `.trim();
  }

  /**
   * Email Templates - User Unbanned
   */
  private getUserUnbannedHTML(data: UserUnbannedEmailData): string {
    const appUrl = env.NEXT_PUBLIC_APP_URL;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px;">
    Account Reactivated! 🎉
  </h1>

  <p>Hi ${data.username},</p>

  <p>Good news! Your CodeSalvage account has been reactivated and you now have full access to the platform.</p>

  <div style="background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
    <h2 style="margin-top: 0; color: #065f46;">Your Access Has Been Restored</h2>
    <p style="margin: 0;">You can now:</p>
    <ul style="margin: 10px 0;">
      <li>Access your dashboard</li>
      <li>Browse and purchase projects</li>
      <li>List your own projects (if seller)</li>
      <li>Send and receive messages</li>
      <li>Participate fully in the marketplace</li>
    </ul>
  </div>

  <h2>Welcome Back!</h2>
  <p>We're glad to have you back. Please review our <a href="${appUrl}/terms" style="color: #10b981;">Terms of Service</a> to ensure future compliance.</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${appUrl}/dashboard" style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Go to Dashboard
    </a>
  </div>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

  <p style="font-size: 12px; color: #6b7280;">
    Reactivated: ${new Date(data.unbannedAt).toLocaleString()}<br>
    CodeSalvage - Marketplace for Incomplete Software Projects<br>
    <a href="${appUrl}" style="color: #10b981;">${appUrl}</a>
  </p>
</body>
</html>
    `.trim();
  }

  private getUserUnbannedText(data: UserUnbannedEmailData): string {
    const appUrl = env.NEXT_PUBLIC_APP_URL;

    return `
ACCOUNT REACTIVATED! 🎉

Hi ${data.username},

Good news! Your CodeSalvage account has been reactivated and you now have full access to the platform.

YOUR ACCESS HAS BEEN RESTORED
You can now:
- Access your dashboard
- Browse and purchase projects
- List your own projects (if seller)
- Send and receive messages
- Participate fully in the marketplace

WELCOME BACK!
We're glad to have you back. Please review our Terms of Service to ensure future compliance:
${appUrl}/terms

Go to your dashboard: ${appUrl}/dashboard

Reactivated: ${new Date(data.unbannedAt).toLocaleString()}

CodeSalvage - Marketplace for Incomplete Software Projects
${appUrl}
    `.trim();
  }
}

// Export singleton instance
export const emailService = new EmailService();
