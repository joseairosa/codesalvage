/**
 * SubscriptionService
 *
 * Business logic for Premium Seller subscriptions.
 * Handles Stripe subscription creation, management, and benefit checks.
 *
 * Responsibilities:
 * - Create subscriptions via Stripe API
 * - Cancel/update subscriptions
 * - Check subscription status and benefits
 * - Create Stripe Customer Portal sessions
 * - Validate subscription permissions
 *
 * Architecture:
 * - Business logic layer (orchestrates repositories + Stripe)
 * - Depends on SubscriptionRepository, UserRepository, Stripe client
 * - Returns formatted data for API consumption
 */

import type { SubscriptionRepository } from '../repositories/SubscriptionRepository';
import type { UserRepository } from '../repositories/UserRepository';
import { stripe } from '../stripe';
import Stripe from 'stripe';

/**
 * Custom error for subscription validation issues
 */
export class SubscriptionValidationError extends Error {
  public field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'SubscriptionValidationError';
    if (field !== undefined) {
      this.field = field;
    }
  }
}

/**
 * Custom error for subscription permission issues
 */
export class SubscriptionPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubscriptionPermissionError';
  }
}

/**
 * Custom error for subscription not found
 */
export class SubscriptionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SubscriptionNotFoundError';
  }
}

/**
 * Request format for creating subscription
 */
export interface CreateSubscriptionRequest {
  plan: 'pro'; // Currently only 'pro' plan, can extend later
  paymentMethodId?: string; // Optional: if not provided, will use default
}

/**
 * Response format for subscription creation
 */
export interface CreateSubscriptionResponse {
  subscriptionId: string;
  clientSecret?: string; // If payment requires action (3D Secure, etc.)
  status: string;
  currentPeriodEnd: string; // ISO date string
}

/**
 * Subscription status response
 */
export interface SubscriptionStatusResponse {
  subscriptionId: string | null;
  plan: string; // 'free' | 'pro'
  status: string | null; // 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing'
  currentPeriodEnd: string | null; // ISO date string
  cancelAtPeriodEnd: boolean;
  benefits: {
    unlimitedListings: boolean;
    advancedAnalytics: boolean;
    featuredListingDiscount: number; // Percentage discount (e.g., 20 = 20%)
    verificationBadge: boolean;
  };
}

/**
 * Subscription pricing configuration
 */
const SUBSCRIPTION_PRICING = {
  pro: {
    priceId: process.env['STRIPE_PRO_PRICE_ID'] || 'price_pro_monthly', // From Stripe dashboard
    costCents: 999, // $9.99/month
    benefits: {
      unlimitedListings: true,
      advancedAnalytics: true,
      featuredListingDiscount: 20, // 20% off featured listings
      verificationBadge: true,
    },
  },
} as const;

/**
 * Free plan benefits (default for all users)
 */
const FREE_PLAN_BENEFITS = {
  unlimitedListings: false, // Limited to 3 listings
  advancedAnalytics: false,
  featuredListingDiscount: 0,
  verificationBadge: false,
};

export class SubscriptionService {
  constructor(
    private subscriptionRepository: SubscriptionRepository,
    private userRepository: UserRepository
  ) {
    console.log('[SubscriptionService] Initialized');
  }

  /**
   * Create a new subscription via Stripe
   *
   * @param userId - User ID
   * @param data - Subscription creation request
   * @returns Subscription creation response
   * @throws SubscriptionValidationError if validation fails
   * @throws SubscriptionPermissionError if user is not a seller
   * @throws Error if Stripe operation fails
   *
   * @example
   * const result = await subscriptionService.createSubscription('user123', {
   *   plan: 'pro',
   *   paymentMethodId: 'pm_xxx'
   * });
   */
  async createSubscription(
    userId: string,
    data: CreateSubscriptionRequest
  ): Promise<CreateSubscriptionResponse> {
    console.log('[SubscriptionService] Creating subscription:', {
      userId,
      plan: data.plan,
    });

    // Validate user is a seller
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new SubscriptionNotFoundError('[SubscriptionService] User not found');
    }
    if (!user.isSeller) {
      throw new SubscriptionPermissionError(
        '[SubscriptionService] Only sellers can subscribe to Pro plan'
      );
    }

    // Check if user already has active subscription
    const existingSubscription = await this.subscriptionRepository.findByUserId(userId);
    if (existingSubscription && existingSubscription.status === 'active') {
      throw new SubscriptionValidationError(
        '[SubscriptionService] User already has an active subscription',
        'subscription'
      );
    }

    // Get pricing for plan
    const pricing = SUBSCRIPTION_PRICING[data.plan];
    if (!pricing) {
      throw new SubscriptionValidationError(
        `[SubscriptionService] Invalid plan: ${data.plan}`,
        'plan'
      );
    }

    try {
      // Create or get Stripe customer
      let stripeCustomerId = user.stripeAccountId; // Note: might need separate stripeCustomerId field
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            userId: user.id,
            username: user.username,
          },
        });
        stripeCustomerId = customer.id;

        // Update user with Stripe customer ID
        await this.userRepository.updateStripeAccount(userId, stripeCustomerId);
      }

      // Attach payment method if provided
      if (data.paymentMethodId) {
        await stripe.paymentMethods.attach(data.paymentMethodId, {
          customer: stripeCustomerId,
        });

        // Set as default payment method
        await stripe.customers.update(stripeCustomerId, {
          invoice_settings: {
            default_payment_method: data.paymentMethodId,
          },
        });
      }

      // Create Stripe subscription
      const stripeSubscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: pricing.priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          userId,
          plan: data.plan,
        },
      });

      // Store subscription in database
      await this.subscriptionRepository.create({
        userId,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId,
        stripePriceId: pricing.priceId,
        plan: data.plan,
        status: stripeSubscription.status,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      });

      console.log('[SubscriptionService] Subscription created:', stripeSubscription.id);

      // Extract payment intent details if payment requires action
      const latestInvoice = stripeSubscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = latestInvoice?.payment_intent as
        | Stripe.PaymentIntent
        | undefined;

      const response: {
        subscriptionId: string;
        clientSecret?: string;
        status: Stripe.Subscription.Status;
        currentPeriodEnd: string;
      } = {
        subscriptionId: stripeSubscription.id,
        status: stripeSubscription.status,
        currentPeriodEnd: new Date(
          stripeSubscription.current_period_end * 1000
        ).toISOString(),
      };

      if (paymentIntent?.client_secret) {
        response.clientSecret = paymentIntent.client_secret;
      }

      return response;
    } catch (error) {
      console.error('[SubscriptionService] createSubscription failed:', error);
      if (
        error instanceof Stripe.errors.StripeError ||
        (error as any)?.type?.includes('Stripe')
      ) {
        throw new SubscriptionValidationError(
          `[SubscriptionService] Stripe error: ${(error as Error).message}`,
          'stripe'
        );
      }
      throw error;
    }
  }

  /**
   * Cancel subscription at end of billing period
   *
   * @param userId - User ID
   * @returns Updated subscription
   * @throws SubscriptionNotFoundError if subscription not found
   * @throws Error if Stripe operation fails
   *
   * @example
   * const subscription = await subscriptionService.cancelSubscription('user123');
   */
  async cancelSubscription(userId: string) {
    console.log('[SubscriptionService] Canceling subscription:', userId);

    const subscription = await this.subscriptionRepository.findByUserId(userId);
    if (!subscription) {
      throw new SubscriptionNotFoundError('[SubscriptionService] Subscription not found');
    }

    try {
      // Cancel subscription at end of period in Stripe
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      // Update local database
      const updatedSubscription = await this.subscriptionRepository.update(userId, {
        cancelAtPeriodEnd: true,
      });

      console.log('[SubscriptionService] Subscription canceled:', subscription.id);

      return {
        subscriptionId: updatedSubscription.id,
        status: updatedSubscription.status,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: updatedSubscription.currentPeriodEnd.toISOString(),
      };
    } catch (error) {
      console.error('[SubscriptionService] cancelSubscription failed:', error);
      if (
        error instanceof Stripe.errors.StripeError ||
        (error as any)?.type?.includes('Stripe')
      ) {
        throw new SubscriptionValidationError(
          `[SubscriptionService] Stripe error: ${(error as Error).message}`,
          'stripe'
        );
      }
      throw error;
    }
  }

  /**
   * Resume a canceled subscription (before period ends)
   *
   * @param userId - User ID
   * @returns Updated subscription
   * @throws SubscriptionNotFoundError if subscription not found
   * @throws Error if Stripe operation fails
   *
   * @example
   * const subscription = await subscriptionService.resumeSubscription('user123');
   */
  async resumeSubscription(userId: string) {
    console.log('[SubscriptionService] Resuming subscription:', userId);

    const subscription = await this.subscriptionRepository.findByUserId(userId);
    if (!subscription) {
      throw new SubscriptionNotFoundError('[SubscriptionService] Subscription not found');
    }

    try {
      // Resume subscription in Stripe
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });

      // Update local database
      const updatedSubscription = await this.subscriptionRepository.update(userId, {
        cancelAtPeriodEnd: false,
      });

      console.log('[SubscriptionService] Subscription resumed:', subscription.id);

      return {
        subscriptionId: updatedSubscription.id,
        status: updatedSubscription.status,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: updatedSubscription.currentPeriodEnd.toISOString(),
      };
    } catch (error) {
      console.error('[SubscriptionService] resumeSubscription failed:', error);
      if (
        error instanceof Stripe.errors.StripeError ||
        (error as any)?.type?.includes('Stripe')
      ) {
        throw new SubscriptionValidationError(
          `[SubscriptionService] Stripe error: ${(error as Error).message}`,
          'stripe'
        );
      }
      throw error;
    }
  }

  /**
   * Get subscription status for a user
   *
   * @param userId - User ID
   * @returns Subscription status with benefits
   *
   * @example
   * const status = await subscriptionService.getSubscriptionStatus('user123');
   */
  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatusResponse> {
    console.log('[SubscriptionService] Getting subscription status:', userId);

    let subscription;
    try {
      subscription = await this.subscriptionRepository.findByUserId(userId);
    } catch (error) {
      // Gracefully fall back to free plan if subscription lookup fails
      // (e.g. table not yet migrated, database error)
      console.warn(
        '[SubscriptionService] Subscription lookup failed, defaulting to free plan:',
        error
      );
      return {
        subscriptionId: null,
        plan: 'free',
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        benefits: FREE_PLAN_BENEFITS,
      };
    }

    if (!subscription) {
      // User is on free plan
      return {
        subscriptionId: null,
        plan: 'free',
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        benefits: FREE_PLAN_BENEFITS,
      };
    }

    const benefits =
      subscription.plan === 'pro' && subscription.status === 'active'
        ? SUBSCRIPTION_PRICING.pro.benefits
        : FREE_PLAN_BENEFITS;

    return {
      subscriptionId: subscription.id,
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      benefits,
    };
  }

  /**
   * Create Stripe Customer Portal session for subscription management
   *
   * @param userId - User ID
   * @param returnUrl - URL to return to after portal session
   * @returns Portal session URL
   * @throws SubscriptionNotFoundError if subscription not found
   * @throws Error if Stripe operation fails
   *
   * @example
   * const portalUrl = await subscriptionService.createPortalSession('user123', 'https://app.com/settings');
   */
  async createPortalSession(userId: string, returnUrl: string): Promise<string> {
    console.log('[SubscriptionService] Creating portal session:', userId);

    const subscription = await this.subscriptionRepository.findByUserId(userId);
    if (!subscription) {
      throw new SubscriptionNotFoundError('[SubscriptionService] Subscription not found');
    }

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: returnUrl,
      });

      console.log('[SubscriptionService] Portal session created:', session.id);

      return session.url;
    } catch (error) {
      console.error('[SubscriptionService] createPortalSession failed:', error);
      if (
        error instanceof Stripe.errors.StripeError ||
        (error as any)?.type?.includes('Stripe')
      ) {
        throw new SubscriptionValidationError(
          `[SubscriptionService] Stripe error: ${(error as Error).message}`,
          'stripe'
        );
      }
      throw error;
    }
  }

  /**
   * Check if user has active subscription
   *
   * @param userId - User ID
   * @returns True if user has active subscription
   *
   * @example
   * const isActive = await subscriptionService.isActiveSubscriber('user123');
   */
  async isActiveSubscriber(userId: string): Promise<boolean> {
    console.log('[SubscriptionService] Checking active subscriber:', userId);

    return await this.subscriptionRepository.isActive(userId);
  }

  /**
   * Get subscription pricing information
   *
   * @returns Pricing information for all plans
   *
   * @example
   * const pricing = subscriptionService.getPricing();
   */
  getPricing() {
    console.log('[SubscriptionService] Getting pricing');

    return {
      free: {
        plan: 'free',
        costCents: 0,
        benefits: FREE_PLAN_BENEFITS,
      },
      pro: {
        plan: 'pro',
        costCents: SUBSCRIPTION_PRICING.pro.costCents,
        priceId: SUBSCRIPTION_PRICING.pro.priceId,
        benefits: SUBSCRIPTION_PRICING.pro.benefits,
      },
    };
  }

  /**
   * Update subscription from Stripe webhook event
   *
   * @param stripeSubscriptionId - Stripe subscription ID
   * @param status - New subscription status
   * @param currentPeriodStart - New period start
   * @param currentPeriodEnd - New period end
   * @returns Updated subscription
   * @throws SubscriptionNotFoundError if subscription not found
   *
   * @example
   * await subscriptionService.updateFromWebhook('sub_xxx', 'active', new Date(), new Date());
   */
  async updateFromWebhook(
    stripeSubscriptionId: string,
    status: string,
    currentPeriodStart: Date,
    currentPeriodEnd: Date
  ) {
    console.log(
      '[SubscriptionService] Updating subscription from webhook:',
      stripeSubscriptionId
    );

    const subscription =
      await this.subscriptionRepository.findByStripeSubscriptionId(stripeSubscriptionId);
    if (!subscription) {
      throw new SubscriptionNotFoundError(
        '[SubscriptionService] Subscription not found for webhook update'
      );
    }

    const updatedSubscription = await this.subscriptionRepository.updateByStripeId(
      stripeSubscriptionId,
      {
        status,
        currentPeriodStart,
        currentPeriodEnd,
      }
    );

    console.log(
      '[SubscriptionService] Subscription updated from webhook:',
      updatedSubscription.id
    );

    return updatedSubscription;
  }

  /**
   * Cancel subscription immediately (from webhook when payment fails)
   *
   * @param stripeSubscriptionId - Stripe subscription ID
   * @returns Updated subscription
   * @throws SubscriptionNotFoundError if subscription not found
   *
   * @example
   * await subscriptionService.cancelImmediately('sub_xxx');
   */
  async cancelImmediately(stripeSubscriptionId: string) {
    console.log(
      '[SubscriptionService] Canceling subscription immediately:',
      stripeSubscriptionId
    );

    const subscription =
      await this.subscriptionRepository.findByStripeSubscriptionId(stripeSubscriptionId);
    if (!subscription) {
      throw new SubscriptionNotFoundError(
        '[SubscriptionService] Subscription not found for immediate cancellation'
      );
    }

    const updatedSubscription = await this.subscriptionRepository.updateByStripeId(
      stripeSubscriptionId,
      {
        status: 'canceled',
        canceledAt: new Date(),
      }
    );

    console.log(
      '[SubscriptionService] Subscription canceled immediately:',
      updatedSubscription.id
    );

    return updatedSubscription;
  }
}
