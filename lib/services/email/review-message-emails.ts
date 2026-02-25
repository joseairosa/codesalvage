import { renderEmailTemplate } from './template';
import { type SendEmailFn } from './sender';
import type { EmailRecipient, ReviewEmailData } from './types';
import type { ReviewWithRelations } from '@/lib/repositories/ReviewRepository';

export async function sendNewReviewNotification(
  send: SendEmailFn,
  appUrl: string,
  review: ReviewWithRelations,
  seller: { email: string; fullName?: string | null; username: string }
): Promise<void> {
  const sellerName = seller.fullName || seller.username;
  const buyerName = review.buyer.fullName || review.buyer.username;
  const projectTitle = review.transaction.project.title;
  const stars = '★'.repeat(review.overallRating) + '☆'.repeat(5 - review.overallRating);

  const html = renderEmailTemplate(
    {
      preheader: `${buyerName} left you a ${review.overallRating}-star review.`,
      heading: 'You Have a New Review',
      body: `
        <p>Hi ${sellerName},</p>
        <p><strong>${buyerName}</strong> left a review for <strong>${projectTitle}</strong>.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;margin:24px 0;">
          <p style="margin:0 0 8px;font-size:22px;color:#f59e0b;letter-spacing:2px;">${stars}</p>
          <p style="margin:0;font-size:15px;color:#374151;font-weight:600;">${review.overallRating} / 5</p>
          ${review.comment ? `<p style="margin:12px 0 0;color:#374151;font-style:italic;">"${review.comment}"</p>` : ''}
        </div>
      `,
      ctaText: 'View Review',
      ctaUrl: `${appUrl}/seller/dashboard`,
    },
    appUrl
  );
  await send(
    { email: seller.email, name: sellerName },
    `New Review – ${projectTitle}`,
    html
  );
}

export async function sendReviewReminder(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: ReviewEmailData
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: `How was ${data.projectTitle}? Share your experience.`,
      heading: `How was ${data.projectTitle}?`,
      body: `
        <p>Hi ${data.buyerName},</p>
        <p>You recently purchased <strong>${data.projectTitle}</strong> from
        <strong>${data.sellerName}</strong>. Your review helps other developers
        make informed decisions — it only takes a minute!</p>
      `,
      ctaText: 'Leave a Review',
      ctaUrl: data.reviewUrl,
    },
    appUrl
  );
  await send(recipient, `How was your experience with ${data.projectTitle}?`, html);
}
