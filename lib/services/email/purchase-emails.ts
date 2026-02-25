import { renderEmailTemplate } from './template';
import { fmtCents, fmtDate, type SendEmailFn } from './sender';
import type { EmailRecipient, PurchaseEmailData, EscrowReleaseEmailData } from './types';
import type { MessageWithRelations } from '@/lib/repositories/MessageRepository';

export async function sendBuyerPurchaseConfirmation(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: PurchaseEmailData
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: `Your purchase of ${data.projectTitle} is confirmed.`,
      heading: 'Purchase Confirmed!',
      body: `
        <p>Hi ${data.buyerName},</p>
        <p>Thank you for your purchase — your order is confirmed and your code is ready to download.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;margin:24px 0;">
          <p style="margin:0 0 8px;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Order Details</p>
          <p style="margin:4px 0;"><strong>Project:</strong> ${data.projectTitle}</p>
          <p style="margin:4px 0;"><strong>Amount:</strong> ${fmtCents(data.amount)}</p>
          <p style="margin:4px 0;"><strong>Order ID:</strong> <code>${data.transactionId}</code></p>
          <p style="margin:4px 0;"><strong>Date:</strong> ${fmtDate(data.purchaseDate)}</p>
        </div>
        <p><strong>Escrow protection:</strong> your payment is held in escrow for 7 days.
        During this time you can download and review the code, contact the seller, or request a
        refund if the project doesn't match the description. After 7 days the payment is
        automatically released to the seller.</p>
        <p style="font-size:13px;color:#64748b;margin-top:24px;">
          Download link expires in 7 days. Generate a new one any time from your
          <a href="${appUrl}/dashboard/purchases" style="color:#06b6d4;">purchases page</a>.
        </p>
      `,
      ctaText: 'Download Code',
      ctaUrl: data.downloadUrl,
    },
    appUrl
  );
  await send(recipient, `Purchase Confirmed – ${data.projectTitle}`, html);
}

export async function sendSellerPurchaseNotification(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: PurchaseEmailData
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: `${data.buyerName} just purchased ${data.projectTitle}.`,
      heading: 'You made a sale!',
      body: `
        <p>Hi ${data.sellerName},</p>
        <p>Great news — <strong>${data.buyerName}</strong> has purchased your project
        <strong>${data.projectTitle}</strong>.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;margin:24px 0;">
          <p style="margin:0 0 8px;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Sale Details</p>
          <p style="margin:4px 0;"><strong>Project:</strong> ${data.projectTitle}</p>
          <p style="margin:4px 0;"><strong>Amount:</strong> ${fmtCents(data.amount)}</p>
          <p style="margin:4px 0;"><strong>Date:</strong> ${fmtDate(data.purchaseDate)}</p>
        </div>
        <p>The payment is held in escrow for 7 days. Once the review period ends,
        funds will be transferred to your Stripe account automatically.</p>
      `,
      ctaText: 'View Sale',
      ctaUrl: `${appUrl}/seller/transactions/${data.transactionId}`,
    },
    appUrl
  );
  await send(recipient, `New Sale – ${data.projectTitle}`, html);
}

export async function sendEscrowReleaseNotification(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: EscrowReleaseEmailData
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: `Your payment of ${fmtCents(data.amount)} has been released.`,
      heading: 'Payment Released to Your Account',
      body: `
        <p>Hi ${data.sellerName},</p>
        <p>The escrow period for <strong>${data.projectTitle}</strong> has ended and your
        payment has been transferred to your Stripe account.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;margin:24px 0;">
          <p style="margin:4px 0;"><strong>Project:</strong> ${data.projectTitle}</p>
          <p style="margin:4px 0;"><strong>Amount:</strong> ${fmtCents(data.amount)}</p>
          <p style="margin:4px 0;"><strong>Released:</strong> ${fmtDate(data.releaseDate)}</p>
        </div>
        <p>Funds typically arrive within 2–7 business days depending on your Stripe payout schedule.</p>
      `,
      ctaText: 'View Seller Dashboard',
      ctaUrl: `${appUrl}/seller/dashboard`,
    },
    appUrl
  );
  await send(recipient, `Payment Released – ${data.projectTitle}`, html);
}

export async function sendEscrowReleasedBuyerCopy(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: EscrowReleaseEmailData & { buyerName: string }
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: `Your 7-day review period for ${data.projectTitle} has ended.`,
      heading: 'Review Period Complete',
      body: `
        <p>Hi ${data.buyerName},</p>
        <p>Your 7-day review period for <strong>${data.projectTitle}</strong> has ended.
        The payment has been released to the seller.</p>
        <p>If you have a moment, leaving a review helps other buyers make informed decisions.</p>
      `,
      ctaText: 'Leave a Review',
      ctaUrl: `${appUrl}/dashboard/purchases`,
    },
    appUrl
  );
  await send(recipient, `Review Period Complete – ${data.projectTitle}`, html);
}

export async function sendNewMessageNotification(
  send: SendEmailFn,
  appUrl: string,
  message: MessageWithRelations
): Promise<void> {
  const recipientEmail = (message.recipient as { email?: string | null }).email;
  if (!recipientEmail) {
    console.warn('[purchase-emails] No recipient email — skipping message notification');
    return;
  }

  const recipientName = message.recipient.fullName || message.recipient.username;
  const senderName = message.sender.fullName || message.sender.username;
  const preview = message.content.slice(0, 140);

  const html = renderEmailTemplate(
    {
      preheader: `${senderName}: ${preview}`,
      heading: `New message from ${senderName}`,
      body: `
        <p>Hi ${recipientName},</p>
        <p><strong>${senderName}</strong> sent you a message${message.project ? ` about <strong>${message.project.title}</strong>` : ''}:</p>
        <div style="background:#f8fafc;border-left:4px solid #06b6d4;padding:16px 20px;margin:20px 0;border-radius:0 6px 6px 0;color:#374151;font-style:italic;">
          "${preview}${message.content.length > 140 ? '…' : ''}"
        </div>
      `,
      ctaText: 'Reply',
      ctaUrl: `${appUrl}/messages/${message.senderId}`,
    },
    appUrl
  );
  await send(
    { email: recipientEmail, name: recipientName },
    `New message from ${senderName}`,
    html
  );
}

export async function sendCodeDownloadedNotification(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: {
    sellerName: string;
    buyerName: string;
    projectTitle: string;
    transactionId: string;
  }
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: `${data.buyerName} has downloaded the code for ${data.projectTitle}.`,
      heading: 'Your Code Was Downloaded',
      body: `
        <p>Hi ${data.sellerName},</p>
        <p><strong>${data.buyerName}</strong> has downloaded the code for
        <strong>${data.projectTitle}</strong>. The 7-day review clock is now running.</p>
        <p>Be responsive if the buyer reaches out — it helps ensure a smooth transaction
        and a great review.</p>
      `,
      ctaText: 'View Transaction',
      ctaUrl: `${appUrl}/seller/transactions/${data.transactionId}`,
    },
    appUrl
  );
  await send(recipient, `Code Downloaded – ${data.projectTitle}`, html);
}
