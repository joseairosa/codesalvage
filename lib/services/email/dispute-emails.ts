/**
 * Dispute Email Templates
 */

import { renderEmailTemplate } from './template';
import type { SendEmailFn } from './sender';
import type {
  EmailRecipient,
  DisputeOpenedEmailData,
  DisputeResolvedEmailData,
} from './types';

const DISPUTE_REASONS: Record<string, string> = {
  description_mismatch: "Project doesn't match description",
  code_not_functional: 'Code is not functional as described',
  missing_features: 'Features promised in listing are missing',
  access_issues: 'Cannot access the code / repository',
  other: 'Other reason',
};

const RESOLUTION_LABELS: Record<string, string> = {
  resolved_refund: 'Full refund issued to buyer',
  resolved_no_refund: 'Resolved in seller favour — no refund',
  resolved_partial: 'Partial resolution',
};

export async function sendDisputeOpenedSellerNotification(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: DisputeOpenedEmailData
): Promise<void> {
  const reasonLabel = DISPUTE_REASONS[data.reason] ?? data.reason;
  const html = renderEmailTemplate(
    {
      preheader: `A buyer has opened a dispute on ${data.projectTitle}`,
      heading: 'A buyer has opened a dispute',
      body: `
        <p>Hi ${data.sellerName},</p>
        <p><strong>${data.buyerName}</strong> has filed a dispute on the purchase of <strong>${data.projectTitle}</strong>.</p>
        <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:16px 20px;margin:20px 0;">
          <p style="margin:0 0 6px;"><strong>Reason:</strong> ${reasonLabel}</p>
          <p style="margin:0;white-space:pre-wrap;word-break:break-word;"><strong>Details:</strong> ${data.description}</p>
        </div>
        <p>Our team will review the dispute and reach out to both parties within 2–3 business days. Escrow funds are paused until the dispute is resolved.</p>
        <p>You may be contacted by our team for additional information.</p>
      `,
      ctaText: 'View Dashboard',
      ctaUrl: `${appUrl}/dashboard`,
    },
    appUrl
  );
  await send(recipient, `Dispute filed on your project: ${data.projectTitle}`, html);
}

export async function sendDisputeOpenedAdminNotification(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: DisputeOpenedEmailData
): Promise<void> {
  const reasonLabel = DISPUTE_REASONS[data.reason] ?? data.reason;
  const html = renderEmailTemplate(
    {
      preheader: `New dispute requires review — ${data.projectTitle}`,
      heading: 'New dispute requires review',
      body: `
        <p>A buyer has filed a dispute that requires admin review.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;margin:20px 0;">
          <p style="margin:4px 0;"><strong>Dispute ID:</strong> <code>${data.disputeId}</code></p>
          <p style="margin:4px 0;"><strong>Transaction ID:</strong> <code>${data.transactionId}</code></p>
          <p style="margin:4px 0;"><strong>Project:</strong> ${data.projectTitle}</p>
          <p style="margin:4px 0;"><strong>Buyer:</strong> ${data.buyerName}</p>
          <p style="margin:4px 0;"><strong>Seller:</strong> ${data.sellerName}</p>
          <p style="margin:4px 0;"><strong>Reason:</strong> ${reasonLabel}</p>
          <p style="margin:8px 0 0;white-space:pre-wrap;word-break:break-word;"><strong>Description:</strong> ${data.description}</p>
        </div>
      `,
      ctaText: 'Review in Admin Panel',
      ctaUrl: `${appUrl}/admin/disputes`,
    },
    appUrl
  );
  await send(
    recipient,
    `[Admin] New dispute: ${data.projectTitle} (${data.disputeId})`,
    html
  );
}

export async function sendDisputeResolvedNotification(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: DisputeResolvedEmailData
): Promise<void> {
  const resolutionLabel = RESOLUTION_LABELS[data.resolution] ?? data.resolution;
  const html = renderEmailTemplate(
    {
      preheader: `Your dispute for ${data.projectTitle} has been resolved`,
      heading: 'Dispute resolved',
      body: `
        <p>Hi ${data.recipientName},</p>
        <p>The dispute for <strong>${data.projectTitle}</strong> has been resolved.</p>
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:16px 20px;margin:20px 0;">
          <p style="margin:0 0 6px;"><strong>Resolution:</strong> ${resolutionLabel}</p>
          ${data.resolutionNote ? `<p style="margin:0;white-space:pre-wrap;word-break:break-word;"><strong>Notes:</strong> ${data.resolutionNote}</p>` : ''}
        </div>
        <p>If you have any questions about this resolution, please contact our support team.</p>
      `,
      ctaText: 'View Dashboard',
      ctaUrl: `${appUrl}/dashboard`,
    },
    appUrl
  );
  await send(recipient, `Your dispute has been resolved: ${data.projectTitle}`, html);
}
