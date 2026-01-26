/**
 * Email Service
 *
 * Handles all email notifications via SendGrid.
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

import sgMail from '@sendgrid/mail';
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

export class EmailService {
  private fromEmail: string;
  private fromName: string;
  private isInitialized = false;

  constructor() {
    // Read from process.env directly to support test environment variable injection
    this.fromEmail =
      process.env.SENDGRID_FROM_EMAIL || env.SENDGRID_FROM_EMAIL || 'noreply@projectfinish.com';
    this.fromName = 'ProjectFinish';
  }

  /**
   * Initialize SendGrid (lazy initialization)
   * This is called on first email send to support testing
   *
   * NOTE: Reads from process.env directly (not cached env object) to support testing
   */
  private initializeSendGrid(): void {
    if (this.isInitialized) {
      return;
    }

    // Read from process.env directly to support test environment variable injection
    const apiKey = process.env.SENDGRID_API_KEY || env.SENDGRID_API_KEY;

    if (apiKey) {
      sgMail.setApiKey(apiKey);
      console.log(`[${componentName}] SendGrid initialized`);
    } else {
      console.warn(
        `[${componentName}] SendGrid API key not configured - emails will be logged only`
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

    console.log(`[${componentName}] Purchase confirmation sent to buyer:`, recipient.email);
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

    console.log(`[${componentName}] Purchase notification sent to seller:`, recipient.email);
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
  async sendReviewReminder(recipient: EmailRecipient, data: ReviewEmailData): Promise<void> {
    const subject = `How was your experience with ${data.projectTitle}?`;
    const html = this.getReviewReminderHTML(data);
    const text = this.getReviewReminderText(data);

    await this.sendEmail(recipient, subject, html, text);

    console.log(`[${componentName}] Review reminder sent:`, recipient.email);
  }

  /**
   * Internal method to send email via SendGrid
   */
  private async sendEmail(
    recipient: EmailRecipient,
    subject: string,
    html: string,
    text: string
  ): Promise<void> {
    // Initialize SendGrid on first use (lazy initialization for testing)
    this.initializeSendGrid();

    // Check for API key (read from process.env to support testing)
    const apiKey = process.env.SENDGRID_API_KEY || env.SENDGRID_API_KEY;

    if (!apiKey) {
      console.log(`[${componentName}] Email would be sent (dev mode):`, {
        to: recipient.email,
        subject,
        textPreview: text.slice(0, 100),
      });
      return;
    }

    try {
      await sgMail.send({
        to: {
          email: recipient.email,
          name: recipient.name,
        },
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject,
        html,
        text,
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
    ProjectFinish - Marketplace for Incomplete Software Projects<br>
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

ProjectFinish - Marketplace for Incomplete Software Projects
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
    ProjectFinish - Marketplace for Incomplete Software Projects<br>
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

ProjectFinish - Marketplace for Incomplete Software Projects
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
    ProjectFinish - Marketplace for Incomplete Software Projects<br>
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

ProjectFinish - Marketplace for Incomplete Software Projects
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
    Thank you for being part of the ProjectFinish community!
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

Thank you for being part of the ProjectFinish community!
    `.trim();
  }
}

// Export singleton instance
export const emailService = new EmailService();
