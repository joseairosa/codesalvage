import { renderEmailTemplate } from './template';
import { fmtCents, type SendEmailFn } from './sender';
import type { EmailRecipient, OfferEmailData } from './types';

export async function sendNewOfferNotification(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: OfferEmailData
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: `${data.otherPartyName} offered ${fmtCents(data.offeredPriceCents)} on ${data.projectTitle}.`,
      heading: 'New Offer Received',
      body: `
        <p>Hi ${data.recipientName},</p>
        <p><strong>${data.otherPartyName}</strong> has made an offer on
        <strong>${data.projectTitle}</strong>.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;margin:24px 0;">
          <p style="margin:4px 0;"><strong>Offer:</strong> ${fmtCents(data.offeredPriceCents)}</p>
          <p style="margin:4px 0;"><strong>Listing price:</strong> ${fmtCents(data.listingPriceCents)}</p>
        </div>
        <p>You can accept, reject, or counter the offer from your seller dashboard.</p>
      `,
      ctaText: 'View Offer',
      ctaUrl: `${appUrl}${data.offerUrl}`,
    },
    appUrl
  );
  await send(recipient, `New Offer – ${data.projectTitle}`, html);
}

export async function sendOfferCounteredNotification(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: OfferEmailData
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: `${data.otherPartyName} countered your offer on ${data.projectTitle}.`,
      heading: 'Counter-Offer Received',
      body: `
        <p>Hi ${data.recipientName},</p>
        <p><strong>${data.otherPartyName}</strong> sent a counter-offer on
        <strong>${data.projectTitle}</strong>.</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px 24px;margin:24px 0;">
          <p style="margin:4px 0;"><strong>Counter-offer:</strong> ${fmtCents(data.offeredPriceCents)}</p>
          <p style="margin:4px 0;"><strong>Original listing:</strong> ${fmtCents(data.listingPriceCents)}</p>
        </div>
        <p>Head to your dashboard to accept, reject, or counter again.</p>
      `,
      ctaText: 'View Offer',
      ctaUrl: `${appUrl}${data.offerUrl}`,
    },
    appUrl
  );
  await send(recipient, `Counter-Offer on ${data.projectTitle}`, html);
}

export async function sendOfferAcceptedNotification(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: OfferEmailData
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: `Your offer on ${data.projectTitle} was accepted!`,
      heading: 'Offer Accepted!',
      body: `
        <p>Hi ${data.recipientName},</p>
        <p>Great news — <strong>${data.otherPartyName}</strong> accepted the offer of
        <strong>${fmtCents(data.offeredPriceCents)}</strong> for
        <strong>${data.projectTitle}</strong>.</p>
        ${
          data.checkoutUrl
            ? `<p>You can now proceed to checkout to complete your purchase.</p>`
            : `<p>The buyer has been notified and will complete the purchase shortly.</p>`
        }
      `,
      ctaText: data.checkoutUrl ? 'Complete Purchase' : 'View Dashboard',
      ctaUrl: data.checkoutUrl
        ? `${appUrl}${data.checkoutUrl}`
        : `${appUrl}${data.offerUrl}`,
    },
    appUrl
  );
  await send(recipient, `Offer Accepted – ${data.projectTitle}`, html);
}

export async function sendOfferRejectedNotification(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: OfferEmailData
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: `Your offer on ${data.projectTitle} was not accepted.`,
      heading: 'Offer Not Accepted',
      body: `
        <p>Hi ${data.recipientName},</p>
        <p><strong>${data.otherPartyName}</strong> did not accept your offer of
        <strong>${fmtCents(data.offeredPriceCents)}</strong> for
        <strong>${data.projectTitle}</strong>.</p>
        <p>You can browse other projects or make a new offer at the listing price of
        <strong>${fmtCents(data.listingPriceCents)}</strong>.</p>
      `,
      ctaText: 'Browse Projects',
      ctaUrl: `${appUrl}/projects`,
    },
    appUrl
  );
  await send(recipient, `Offer Update – ${data.projectTitle}`, html);
}

export async function sendOfferExpiredNotification(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: OfferEmailData
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: `Your offer on ${data.projectTitle} has expired.`,
      heading: 'Offer Expired',
      body: `
        <p>Hi ${data.recipientName},</p>
        <p>Your offer of <strong>${fmtCents(data.offeredPriceCents)}</strong> on
        <strong>${data.projectTitle}</strong> has expired without a response.</p>
        <p>You're welcome to make a new offer at any time.</p>
      `,
      ctaText: 'View Project',
      ctaUrl: `${appUrl}/projects/${data.projectId}`,
    },
    appUrl
  );
  await send(recipient, `Offer Expired – ${data.projectTitle}`, html);
}
