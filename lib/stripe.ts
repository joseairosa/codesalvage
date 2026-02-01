/**
 * Stripe Configuration
 *
 * Responsibilities:
 * - Initialize Stripe client for server-side operations
 * - Provide type-safe Stripe operations
 * - Configure Stripe Connect for marketplace
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
 * Calculate seller payout amount (after platform fee and Stripe fees)
 *
 * @param amountCents - Total amount in cents
 * @returns Seller receives in cents
 *
 * @example
 * calculateSellerPayout(100000) // $1000 → returns 82070 ($820.70)
 * // Breakdown: $1000 - $150 (15% platform) - $29.30 (Stripe 2.9% + $0.30)
 */
export function calculateSellerPayout(amountCents: number): number {
  // Platform fee (15%)
  const platformFee = calculatePlatformFee(amountCents);

  // Stripe fee (2.9% + $0.30)
  const stripeFee = Math.round(amountCents * 0.029 + 30);

  // Seller receives: total - platform fee - Stripe fee
  return amountCents - platformFee - stripeFee;
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

/**
 * Stripe Connect configuration
 *
 * Uses the `controller` parameter instead of `type` to support
 * platforms in countries with loss-liability restrictions (e.g. Malaysia).
 * With controller, Stripe is set as loss-liable instead of the platform.
 */
export const STRIPE_CONNECT_CONFIG = {
  /**
   * Controller configuration for Connect accounts
   *
   * Express dashboard requires platform to be loss-liable, but MY-based
   * platforms cannot be loss-liable. Solution: use 'full' dashboard type
   * where Stripe handles losses and the connected account gets a full dashboard.
   *
   * - losses.payments: 'stripe' — Stripe is loss-liable (required for MY-based platforms)
   * - fees.payer: 'account' — Connected account pays Stripe fees
   * - stripe_dashboard.type: 'full' — Seller gets full Stripe dashboard
   * - requirement_collection: 'stripe' — Stripe collects identity/verification requirements
   */
  controller: {
    losses: { payments: 'stripe' as const },
    fees: { payer: 'account' as const },
    stripe_dashboard: { type: 'full' as const },
    requirement_collection: 'stripe' as const,
  },

  /**
   * Capabilities required for seller accounts
   */
  capabilities: {
    transfers: { requested: true },
  },

  /**
   * Business type for sellers
   */
  businessType: 'individual' as const,
};
