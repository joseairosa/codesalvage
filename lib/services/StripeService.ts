/**
 * Stripe Service
 *
 * Responsibilities:
 * - Manage Stripe Connect accounts for sellers
 * - Create payment intents for purchases
 * - Handle transfers to sellers
 * - Generate onboarding links
 *
 * Architecture:
 * - Uses Stripe API via lib/stripe
 * - Validates account status
 * - Handles errors gracefully
 *
 * @example
 * const stripeService = new StripeService();
 * const accountId = await stripeService.createConnectAccount(user);
 */

import { stripe, STRIPE_CONNECT_CONFIG, calculateSellerPayout } from '@/lib/stripe';
import type Stripe from 'stripe';

const componentName = 'StripeService';

/**
 * User data needed for Stripe Connect
 */
export interface StripeUserData {
  id: string;
  email: string;
  fullName?: string | null;
}

/**
 * Stripe Service
 *
 * Handles all Stripe-related operations for the marketplace.
 */
export class StripeService {
  constructor() {
    console.log(`[${componentName}] Initialized`);
  }

  /**
   * Create Stripe Connect Express account for seller
   *
   * @param user - User data
   * @returns Stripe account ID
   */
  async createConnectAccount(user: StripeUserData): Promise<string> {
    console.log(`[${componentName}] Creating Connect account for user:`, user.id);

    try {
      const country = process.env['STRIPE_CONNECT_COUNTRY'] || 'US';
      const account = await stripe.accounts.create({
        country,
        email: user.email,
        controller: STRIPE_CONNECT_CONFIG.controller,
        capabilities: STRIPE_CONNECT_CONFIG.capabilities as any,
        business_type: STRIPE_CONNECT_CONFIG.businessType,
        metadata: {
          userId: user.id,
        },
      });

      console.log(`[${componentName}] Connect account created:`, account.id);

      return account.id;
    } catch (error) {
      console.error(`[${componentName}] Failed to create Connect account:`, error);
      throw new Error('Failed to create Stripe Connect account');
    }
  }

  /**
   * Create account link for onboarding
   *
   * @param accountId - Stripe account ID
   * @param returnUrl - URL to return after onboarding
   * @param refreshUrl - URL to return if link expires
   * @returns Account link URL
   */
  async createAccountLink(
    accountId: string,
    returnUrl: string,
    refreshUrl: string
  ): Promise<string> {
    console.log(`[${componentName}] Creating account link for:`, accountId);

    try {
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });

      console.log(`[${componentName}] Account link created`);

      return accountLink.url;
    } catch (error) {
      console.error(`[${componentName}] Failed to create account link:`, error);
      throw new Error('Failed to create onboarding link');
    }
  }

  /**
   * Get Connect account details
   *
   * @param accountId - Stripe account ID
   * @returns Stripe account
   */
  async getAccount(accountId: string): Promise<Stripe.Account> {
    console.log(`[${componentName}] Getting account:`, accountId);

    try {
      const account = await stripe.accounts.retrieve(accountId);
      return account;
    } catch (error) {
      console.error(`[${componentName}] Failed to get account:`, error);
      throw new Error('Failed to retrieve Stripe account');
    }
  }

  /**
   * Check if account is fully onboarded and can receive payouts
   *
   * @param accountId - Stripe account ID
   * @returns True if account can receive payouts
   */
  async isAccountOnboarded(accountId: string): Promise<boolean> {
    console.log(`[${componentName}] Checking onboarding status:`, accountId);

    try {
      const account = await this.getAccount(accountId);

      // Check if charges are enabled and details submitted
      const isOnboarded = account.charges_enabled && account.details_submitted;

      console.log(`[${componentName}] Account onboarded:`, isOnboarded);

      return isOnboarded;
    } catch (error) {
      console.error(`[${componentName}] Failed to check onboarding status:`, error);
      return false;
    }
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
   * Transfer funds to seller after escrow period
   *
   * @param accountId - Seller's Stripe Connect account ID
   * @param amountCents - Amount to transfer in cents
   * @param transferGroup - Transfer group ID (transaction ID)
   * @returns Stripe transfer
   */
  async transferToSeller(
    accountId: string,
    amountCents: number,
    transferGroup: string
  ): Promise<Stripe.Transfer> {
    console.log(`[${componentName}] Transferring to seller:`, {
      accountId,
      amount: amountCents,
      transferGroup,
    });

    try {
      // Calculate seller payout (after platform fee and Stripe fees)
      const sellerPayout = calculateSellerPayout(amountCents);

      console.log(`[${componentName}] Seller payout:`, {
        original: amountCents,
        payout: sellerPayout,
        platformFee: amountCents - sellerPayout,
      });

      const transfer = await stripe.transfers.create({
        amount: sellerPayout,
        currency: 'usd',
        destination: accountId,
        transfer_group: transferGroup,
      });

      console.log(`[${componentName}] Transfer completed:`, transfer.id);

      return transfer;
    } catch (error) {
      console.error(`[${componentName}] Failed to transfer to seller:`, error);
      throw new Error('Failed to transfer funds to seller');
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

  /**
   * Create login link for seller to access Stripe Express dashboard
   *
   * @param accountId - Stripe account ID
   * @returns Login link URL
   */
  async createLoginLink(accountId: string): Promise<string> {
    console.log(`[${componentName}] Creating login link for:`, accountId);

    try {
      const loginLink = await stripe.accounts.createLoginLink(accountId);

      console.log(`[${componentName}] Login link created`);

      return loginLink.url;
    } catch (error) {
      console.error(`[${componentName}] Failed to create login link:`, error);
      throw new Error('Failed to create login link');
    }
  }
}

/**
 * Singleton instance
 */
export const stripeService = new StripeService();
