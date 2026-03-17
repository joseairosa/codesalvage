/**
 * Stripe Service
 *
 * Responsibilities:
 * - Create payment intents for purchases
 * - Refund payments
 *
 * Architecture:
 * - Uses Stripe API via lib/stripe
 * - Handles errors gracefully
 */

import { stripe } from '@/lib/stripe';
import type Stripe from 'stripe';

const componentName = 'StripeService';

/**
 * Stripe Service
 *
 * Handles Stripe Payment Intent and refund operations for the marketplace.
 */
export class StripeService {
  constructor() {
    console.log(`[${componentName}] Initialized`);
  }

  /**
   * Create Payment Intent for project purchase
   *
   * @param amountCents - Amount in cents
   * @param metadata - Additional metadata
   * @returns Payment Intent
   */
  async createPaymentIntent(
    amountCents: number,
    metadata: {
      projectId: string;
      sellerId: string;
      buyerId: string;
      transactionId: string;
    }
  ): Promise<Stripe.PaymentIntent> {
    console.log(`[${componentName}] Creating payment intent:`, {
      amount: amountCents,
      projectId: metadata.projectId,
    });

    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
        metadata,
      });

      console.log(`[${componentName}] Payment intent created:`, paymentIntent.id);

      return paymentIntent;
    } catch (error) {
      console.error(`[${componentName}] Failed to create payment intent:`, error);
      throw new Error('Failed to create payment intent');
    }
  }

  /**
   * Refund payment intent (if within escrow period)
   *
   * @param paymentIntentId - Payment Intent ID
   * @param reason - Refund reason
   * @returns Stripe refund
   */
  async refundPayment(paymentIntentId: string, reason?: string): Promise<Stripe.Refund> {
    console.log(`[${componentName}] Refunding payment:`, {
      paymentIntentId,
      reason,
    });

    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        reason: 'requested_by_customer',
        metadata: {
          refundReason: reason || 'Buyer requested refund',
        },
      });

      console.log(`[${componentName}] Refund completed:`, refund.id);

      return refund;
    } catch (error) {
      console.error(`[${componentName}] Failed to refund payment:`, error);
      throw new Error('Failed to refund payment');
    }
  }
}

/**
 * Singleton instance
 */
export const stripeService = new StripeService();
