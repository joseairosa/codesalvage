/**
 * PayPal Payouts Configuration
 *
 * Responsibilities:
 * - Initialize PayPal environment (Sandbox/Live)
 * - Create PayPal HTTP client for Payouts API
 *
 * Architecture:
 * - Singleton PayPal client
 * - Server-side only (uses client secret)
 * - Used by PayoutService for batch payouts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const paypal = require('@paypal/payouts-sdk');
import { env } from '@/config/env';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;

/**
 * Get PayPal HTTP client (singleton, lazy initialization)
 *
 * @throws Error if PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is not configured
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPayPalClient(): any {
  if (!_client) {
    if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
      throw new Error(
        'PayPal credentials are not configured (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)'
      );
    }

    const environment =
      env.PAYPAL_MODE === 'live'
        ? new paypal.core.LiveEnvironment(env.PAYPAL_CLIENT_ID, env.PAYPAL_CLIENT_SECRET)
        : new paypal.core.SandboxEnvironment(
            env.PAYPAL_CLIENT_ID,
            env.PAYPAL_CLIENT_SECRET
          );

    _client = new paypal.core.PayPalHttpClient(environment);
  }

  return _client;
}

export { paypal };
