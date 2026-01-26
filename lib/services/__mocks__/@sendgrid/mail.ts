/**
 * Manual Mock for @sendgrid/mail
 *
 * Provides a mock implementation of SendGrid for testing.
 */

import { vi } from 'vitest';

export const send = vi.fn();
export const setApiKey = vi.fn();

const sgMail = {
  send,
  setApiKey,
};

export default sgMail;
