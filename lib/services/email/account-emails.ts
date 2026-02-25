import { renderEmailTemplate } from './template';
import { fmtCents, fmtDate, type SendEmailFn } from './sender';
import type {
  EmailRecipient,
  WelcomeEmailData,
  UserBannedEmailData,
  UserUnbannedEmailData,
  RefundEmailData,
  PaymentFailedEmailData,
  RepoTransferEmailData,
  StripeConnectConfirmedEmailData,
} from './types';

const SUPPORT_EMAIL = 'support@codesalvage.com';

export async function sendWelcomeEmail(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: WelcomeEmailData
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: 'Welcome to CodeSalvage! Your account is ready.',
      heading: `Welcome to CodeSalvage, ${data.username}!`,
      body: `
        <p>We're glad you're here.</p>
        <p>CodeSalvage is a marketplace for incomplete software projects — buy unfinished
        codebases at a fair price and bring them to life, or sell your side-projects to
        developers who'll finish what you started.</p>
        <p>Here's how to get started:</p>
        <ul style="padding-left:20px;line-height:2;">
          <li>Browse <a href="${appUrl}/projects" style="color:#06b6d4;">available projects</a></li>
          <li>List your own incomplete project for sale</li>
          <li>Make or accept offers directly with other developers</li>
        </ul>
        <p>If you have any questions, visit our
        <a href="${appUrl}/support" style="color:#06b6d4;">support page</a>.</p>
      `,
      ctaText: 'Explore Projects',
      ctaUrl: `${appUrl}/projects`,
    },
    appUrl
  );
  await send(recipient, 'Welcome to CodeSalvage!', html);
}

export async function sendUserBannedNotification(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: UserBannedEmailData
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: 'Your CodeSalvage account has been suspended.',
      heading: 'Account Suspended',
      body: `
        <p>Hi ${data.username},</p>
        <p>Your CodeSalvage account has been suspended.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px 24px;margin:24px 0;">
          <p style="margin:0 0 4px;font-weight:600;color:#991b1b;">Reason</p>
          <p style="margin:0;color:#374151;">${data.reason}</p>
        </div>
        <p>If you believe this is a mistake, please contact us at
        <a href="mailto:${data.supportEmail}" style="color:#06b6d4;">${data.supportEmail}</a>.</p>
      `,
    },
    appUrl
  );
  await send(recipient, 'Your CodeSalvage account has been suspended', html);
}

export async function sendUserUnbannedNotification(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: UserUnbannedEmailData
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: 'Your CodeSalvage account has been reactivated.',
      heading: 'Account Reactivated',
      body: `
        <p>Hi ${data.username},</p>
        <p>Good news — your CodeSalvage account has been reactivated. You can now log in
        and use the platform as normal.</p>
        <p>If you have any questions, reach out to us at
        <a href="mailto:${SUPPORT_EMAIL}" style="color:#06b6d4;">${SUPPORT_EMAIL}</a>.</p>
      `,
      ctaText: 'Sign In',
      ctaUrl: `${appUrl}/auth/signin`,
    },
    appUrl
  );
  await send(recipient, 'Your CodeSalvage account has been reactivated', html);
}

export async function sendRefundNotification(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: RefundEmailData
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: `Your refund of ${fmtCents(data.amountCents)} has been processed.`,
      heading: 'Refund Processed',
      body: `
        <p>Hi ${data.buyerName},</p>
        <p>Your refund for <strong>${data.projectTitle}</strong> has been processed.</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px 24px;margin:24px 0;">
          <p style="margin:4px 0;"><strong>Amount:</strong> ${fmtCents(data.amountCents)}</p>
          <p style="margin:4px 0;"><strong>Date:</strong> ${fmtDate(data.refundDate)}</p>
          <p style="margin:4px 0;"><strong>Transaction:</strong> <code>${data.transactionId}</code></p>
          ${data.reason ? `<p style="margin:4px 0;"><strong>Reason:</strong> ${data.reason}</p>` : ''}
        </div>
        <p>Funds typically appear in your account within 5–10 business days.</p>
      `,
    },
    appUrl
  );
  await send(recipient, `Refund Processed – ${data.projectTitle}`, html);
}

export async function sendPaymentFailedNotification(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: PaymentFailedEmailData
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: `Your payment for ${data.projectTitle} was unsuccessful.`,
      heading: 'Payment Unsuccessful',
      body: `
        <p>Hi ${data.buyerName},</p>
        <p>Unfortunately your payment of <strong>${fmtCents(data.amountCents)}</strong> for
        <strong>${data.projectTitle}</strong> could not be processed.</p>
        <p>Common reasons:</p>
        <ul style="padding-left:20px;line-height:2;">
          <li>Insufficient funds</li>
          <li>Card declined by your bank</li>
          <li>Incorrect card details</li>
        </ul>
        <p>Please try again with a different payment method or contact your bank.</p>
      `,
      ctaText: 'Try Again',
      ctaUrl: `${appUrl}/dashboard/purchases`,
    },
    appUrl
  );
  await send(recipient, `Payment Unsuccessful – ${data.projectTitle}`, html);
}

export async function sendRepoTransferCompleteNotification(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: RepoTransferEmailData
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: `The repository for ${data.projectTitle} has been transferred to you.`,
      heading: 'Repository Transfer Complete',
      body: `
        <p>Hi ${data.buyerName},</p>
        <p>The GitHub repository for <strong>${data.projectTitle}</strong> has been
        successfully transferred to your GitHub account. You now have full ownership.</p>
        <p>Happy coding! If you run into any issues, reply to this email or contact support.</p>
      `,
      ctaText: 'View Transaction',
      ctaUrl: `${appUrl}/dashboard/purchases/${data.transactionId}`,
    },
    appUrl
  );
  await send(recipient, `Repository Transferred – ${data.projectTitle}`, html);
}

export async function sendStripeConnectConfirmedNotification(
  send: SendEmailFn,
  appUrl: string,
  recipient: EmailRecipient,
  data: StripeConnectConfirmedEmailData
): Promise<void> {
  const html = renderEmailTemplate(
    {
      preheader: 'Your Stripe account is connected — you can now receive payments.',
      heading: 'You Can Now Accept Payments!',
      body: `
        <p>Hi ${data.sellerName},</p>
        <p>Your Stripe account has been successfully connected to CodeSalvage. You can now
        list projects for sale and receive payouts directly to your bank account.</p>
        <p>When a buyer purchases your project, payment is held in escrow for 7 days before
        being automatically transferred to your Stripe account.</p>
      `,
      ctaText: 'Go to Seller Dashboard',
      ctaUrl: `${appUrl}/seller/dashboard`,
    },
    appUrl
  );
  await send(recipient, 'Your Stripe account is connected — start selling!', html);
}
