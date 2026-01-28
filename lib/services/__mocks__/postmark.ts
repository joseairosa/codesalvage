/**
 * Manual Mock for postmark
 *
 * Provides a mock implementation of Postmark for testing.
 */

import { vi } from 'vitest';

export const sendEmail = vi.fn();

export class ServerClient {
  sendEmail = sendEmail;

  constructor(apiKey: string) {
    // Mock constructor
  }
}

const postmark = {
  ServerClient,
  sendEmail,
};

export default postmark;
