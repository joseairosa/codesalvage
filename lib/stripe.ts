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

if (!env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not configured');
}

/**
 * Stripe client instance (singleton)
 *
 * Configured with:
 * - API version: 2024-12-18.acacia (latest stable)
 * - TypeScript: Enabled
 * - App info: ProjectFinish metadata
 */
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
  typescript: true,
  appInfo: {
    name: 'ProjectFinish',
    version: '1.0.0',
    url: 'https://projectfinish.com',
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
 */
export const STRIPE_CONNECT_CONFIG = {
  /**
   * Type of Stripe Connect account
   * Express: Fast onboarding, Stripe handles compliance
   */
  accountType: 'express' as const,

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
