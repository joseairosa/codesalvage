/**
 * Stripe Configuration
 *
 * Responsibilities:
 * - Initialize Stripe client for server-side operations
 * - Provide type-safe Stripe operations
 * - Provide payment breakdown calculations
 *
 * Architecture:
 * - Singleton Stripe instance
 * - Server-side only (uses secret key)
 * - Used by payment services and API routes
 *
 * @example
 * import { stripe } from '@/lib/stripe';
 * const paymentIntent = await stripe.paymentIntents.create({ ... });
 */

import Stripe from 'stripe';
import { env } from '@/config/env';

let _stripe: Stripe | null = null;

/**
 * Get Stripe client instance (singleton, lazy initialization)
 *
 * Configured with:
 * - API version: 2024-12-18.acacia (latest stable)
 * - TypeScript: Enabled
 * - App info: CodeSalvage metadata
 *
 * @throws Error if STRIPE_SECRET_KEY is not configured
 */
function getStripeClient(): Stripe {
  if (!_stripe) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    _stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
      appInfo: {
        name: 'CodeSalvage',
        version: '1.0.0',
        url: 'https://codesalvage.com',
      },
    });
  }

  return _stripe;
}

/**
 * Stripe client instance (lazy-initialized singleton)
 *
 * Use this export for all Stripe operations.
 * Will throw error if STRIPE_SECRET_KEY is not configured.
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripeClient();
    const value = client[prop as keyof Stripe];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

/**
 * Platform Fee Configuration
 */
export const PLATFORM_FEE_PERCENTAGE = 0.15; // 15% platform fee

/**
 * Calculate platform fee from amount in cents
 *
 * @param amountCents - Total amount in cents
 * @returns Platform fee in cents (rounded)
 */
export function calculatePlatformFee(amountCents: number): number {
  return Math.round(amountCents * PLATFORM_FEE_PERCENTAGE);
}

/**
 * Calculate breakdown of payment distribution
 *
 * @param amountCents - Total amount in cents
 * @returns Payment breakdown
 */
export function calculatePaymentBreakdown(amountCents: number): {
  total: number;
  platformFee: number;
  stripeFee: number;
  sellerReceives: number;
} {
  const platformFee = calculatePlatformFee(amountCents);
  const stripeFee = Math.round(amountCents * 0.029 + 30);
  const sellerReceives = amountCents - platformFee - stripeFee;

  return {
    total: amountCents,
    platformFee,
    stripeFee,
    sellerReceives,
  };
}

/**
 * Escrow configuration
 */
export const ESCROW_HOLD_DAYS = 7;
export const ESCROW_HOLD_MS = ESCROW_HOLD_DAYS * 24 * 60 * 60 * 1000;

/**
 * Calculate escrow release date
 *
 * @param paymentDate - Date of payment (defaults to now)
 * @returns Date when escrow should be released
 */
export function calculateEscrowReleaseDate(paymentDate: Date = new Date()): Date {
  return new Date(paymentDate.getTime() + ESCROW_HOLD_MS);
}
