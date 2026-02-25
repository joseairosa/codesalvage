import { renderEmailTemplate } from './template';
import { fmtCents, fmtDate, type SendEmailFn } from './sender';
import type { EmailRecipient, FeaturedListingEmailData } from './types';

export async function sendFeaturedListingConfirmation(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: FeaturedListingEmailData
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: `${data.projectTitle} is now featured on CodeSalvage.`,
      heading: 'Your Listing Is Now Featured!',
      body: `
        <p>Hi ${data.sellerName},</p>
        <p><strong>${data.projectTitle}</strong> is now featured on CodeSalvage and will
        appear at the top of search results for the next <strong>${data.durationDays} days</strong>.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;margin:24px 0;">
          <p style="margin:4px 0;"><strong>Duration:</strong> ${data.durationDays} days</p>
          <p style="margin:4px 0;"><strong>Featured until:</strong> ${fmtDate(data.featuredUntil)}</p>
          <p style="margin:4px 0;"><strong>Cost:</strong> ${fmtCents(data.costCents)}</p>
        </div>
      `,
      ctaText: 'View Your Listing',
      ctaUrl: data.projectUrl,
    },
    appUrl
  );
  await send(recipient, `Featured Listing Confirmed – ${data.projectTitle}`, html);
}

export async function sendFeaturedListingExpirationWarning(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: FeaturedListingEmailData
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: `Your featured listing for ${data.projectTitle} expires soon.`,
      heading: 'Featured Listing Expiring Soon',
      body: `
        <p>Hi ${data.sellerName},</p>
        <p>Your featured listing for <strong>${data.projectTitle}</strong> will expire on
        <strong>${fmtDate(data.featuredUntil)}</strong>.</p>
        <p>Renew now to keep your project at the top of search results.</p>
      `,
      ctaText: 'Renew Featured Listing',
      ctaUrl: `${appUrl}/projects/${data.projectId}`,
    },
    appUrl
  );
  await send(recipient, `Featured Listing Expiring Soon – ${data.projectTitle}`, html);
}

export async function sendFeaturedListingExpired(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: FeaturedListingEmailData
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: `Your featured listing for ${data.projectTitle} has expired.`,
      heading: 'Featured Listing Expired',
      body: `
        <p>Hi ${data.sellerName},</p>
        <p>Your featured listing for <strong>${data.projectTitle}</strong> has expired.
        Your project is still live on CodeSalvage — it just won't appear in the featured section.</p>
        <p>Want more visibility? Renew your featured slot at any time.</p>
      `,
      ctaText: 'Feature Again',
      ctaUrl: `${appUrl}/projects/${data.projectId}`,
    },
    appUrl
  );
  await send(recipient, `Featured Listing Expired – ${data.projectTitle}`, html);
}
