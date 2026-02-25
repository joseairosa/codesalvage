/**
 * Email sender — Resend client wrapper.
 *
 * createEmailSender returns a send function pre-configured with:
 *  - Resend API client (lazy-initialised)
 *  - EMAIL_TEST_OVERRIDE: when set, ALL emails go to that address instead
 *  - Dev fallback: logs email details when no API key is configured
 */

import { Resend } from 'resend';
import type { EmailRecipient } from './types';

const FROM_ADDRESS = 'noreply@mail.codesalvage.com';
const FROM_NAME = 'CodeSalvage';

export type SendEmailFn = (
  recipient: EmailRecipient,
  subject: string,
  html: string
) => Promise<void>;

export function createEmailSender(apiKey?: string, testOverride?: string): SendEmailFn {
  let client: Resend | null = null;

  if (apiKey) {
    client = new Resend(apiKey);
    console.log('[EmailSender] Resend client initialised');
  } else {
    console.warn('[EmailSender] RESEND_API_KEY not set — emails logged only');
  }

  return async function sendEmail(
    recipient: EmailRecipient,
    subject: string,
    html: string
  ): Promise<void> {
    const to = testOverride ? { email: testOverride, name: recipient.name } : recipient;

    if (!client) {
      console.log(`[EmailSender] [dev] Would send "${subject}" → ${to.email}`);
      return;
    }

    const { error } = await client.emails.send({
      from: `${FROM_NAME} <${FROM_ADDRESS}>`,
      to: to.name ? `${to.name} <${to.email}>` : to.email,
      subject,
      html,
    });

    if (error) {
      console.error('[EmailSender] Send failed:', error);
      throw new Error(`Failed to send email: ${JSON.stringify(error)}`);
    }

    const dest = testOverride ? `${to.email} (override)` : to.email;
    console.log(`[EmailSender] Sent "${subject}" → ${dest}`);
  };
}

/** Shared formatters used by email modules */
export function fmtCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    cents / 100
  );
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
