/**
 * SubscriptionRepository - Data Access Layer for Subscriptions
 *
 * Responsibilities:
 * - CRUD operations for user subscriptions
 * - Query subscription by user ID or Stripe subscription ID
 * - Update subscription status and billing cycle
 * - Check subscription status and plan
 *
 * Architecture:
 * - Repository Pattern: Abstracts database operations
 * - Single Responsibility: Only handles data access
 * - Type-safe: Returns properly typed Prisma models
 * - Error handling: Catches and wraps database errors
 *
 * @example
 * const subscriptionRepo = new SubscriptionRepository(prisma);
 * const subscription = await subscriptionRepo.findByUserId('user123');
 */

import type { PrismaClient, Subscription } from '@prisma/client';
import { Prisma } from '@prisma/client';

/**
 * Subscription with user details
 */
export interface SubscriptionWithUser extends Subscription {
  user: {
    id: string;
    email: string;
    username: string;
    fullName: string | null;
    isSeller: boolean;
  };
}

/**
 * Input data for creating a subscription
 */
export interface CreateSubscriptionInput {
  userId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  plan: string; // 'free' | 'pro'
  status: string; // 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing'
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

/**
 * Input data for updating a subscription
 */
export interface UpdateSubscriptionInput {
  status?: string;
  plan?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
}

export class SubscriptionRepository {
  constructor(private prisma: PrismaClient) {
    console.log('[SubscriptionRepository] Initialized');
  }

  /**
   * Create a new subscription
   *
   * @param data - Subscription data
   * @returns Created subscription
   * @throws Error if database operation fails
   *
   * @example
   * const subscription = await subscriptionRepo.create({
   *   userId: 'user123',
   *   stripeSubscriptionId: 'sub_xxx',
   *   stripeCustomerId: 'cus_xxx',
   *   stripePriceId: 'price_xxx',
   *   plan: 'pro',
   *   status: 'active',
   *   currentPeriodStart: new Date(),
   *   currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
   * });
   */
  async create(data: CreateSubscriptionInput): Promise<Subscription> {
    console.log('[SubscriptionRepository] Creating subscription:', {
      userId: data.userId,
      plan: data.plan,
    });

    try {
      const subscription = await this.prisma.subscription.create({
        data: {
          userId: data.userId,
          stripeSubscriptionId: data.stripeSubscriptionId,
          stripeCustomerId: data.stripeCustomerId,
          stripePriceId: data.stripePriceId,
          plan: data.plan,
          status: data.status,
          currentPeriodStart: data.currentPeriodStart,
          currentPeriodEnd: data.currentPeriodEnd,
        },
      });

      console.log('[SubscriptionRepository] Subscription created:', subscription.id);
      return subscription;
    } catch (error) {
      console.error('[SubscriptionRepository] create failed:', error);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new Error(
            '[SubscriptionRepository] Subscription already exists for this user or Stripe subscription ID'
          );
        }
      }
      throw new Error('[SubscriptionRepository] Failed to create subscription');
    }
  }

  /**
   * Find subscription by user ID
   *
   * @param userId - User ID
   * @returns Subscription or null if not found
   *
   * @example
   * const subscription = await subscriptionRepo.findByUserId('user123');
   */
  async findByUserId(userId: string): Promise<Subscription | null> {
    console.log('[SubscriptionRepository] Finding subscription by user ID:', userId);

    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      if (subscription) {
        console.log('[SubscriptionRepository] Subscription found:', subscription.id);
      } else {
        console.log('[SubscriptionRepository] Subscription not found for user:', userId);
      }

      return subscription;
    } catch (error) {
      console.error('[SubscriptionRepository] findByUserId failed:', error);
      throw new Error('[SubscriptionRepository] Failed to find subscription by user ID');
    }
  }

  /**
   * Find subscription by Stripe subscription ID
   *
   * @param stripeSubscriptionId - Stripe subscription ID
   * @returns Subscription or null if not found
   *
   * @example
   * const subscription = await subscriptionRepo.findByStripeSubscriptionId('sub_xxx');
   */
  async findByStripeSubscriptionId(
    stripeSubscriptionId: string
  ): Promise<Subscription | null> {
    console.log(
      '[SubscriptionRepository] Finding subscription by Stripe ID:',
      stripeSubscriptionId
    );

    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { stripeSubscriptionId },
      });

      if (subscription) {
        console.log('[SubscriptionRepository] Subscription found:', subscription.id);
      } else {
        console.log(
          '[SubscriptionRepository] Subscription not found for Stripe ID:',
          stripeSubscriptionId
        );
      }

      return subscription;
    } catch (error) {
      console.error('[SubscriptionRepository] findByStripeSubscriptionId failed:', error);
      throw new Error(
        '[SubscriptionRepository] Failed to find subscription by Stripe subscription ID'
      );
    }
  }

  /**
   * Find subscription by ID with user details
   *
   * @param id - Subscription ID
   * @returns Subscription with user details or null if not found
   *
   * @example
   * const subscription = await subscriptionRepo.findByIdWithUser('sub123');
   */
  async findByIdWithUser(id: string): Promise<SubscriptionWithUser | null> {
    console.log('[SubscriptionRepository] Finding subscription by ID with user:', id);

    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              fullName: true,
              isSeller: true,
            },
          },
        },
      });

      if (subscription) {
        console.log(
          '[SubscriptionRepository] Subscription with user found:',
          subscription.id
        );
      } else {
        console.log('[SubscriptionRepository] Subscription not found:', id);
      }

      return subscription;
    } catch (error) {
      console.error('[SubscriptionRepository] findByIdWithUser failed:', error);
      throw new Error('[SubscriptionRepository] Failed to find subscription with user');
    }
  }

  /**
   * Update subscription
   *
   * @param userId - User ID
   * @param data - Subscription update data
   * @returns Updated subscription
   * @throws Error if subscription not found or database operation fails
   *
   * @example
   * const subscription = await subscriptionRepo.update('user123', {
   *   status: 'canceled',
   *   canceledAt: new Date()
   * });
   */
  async update(userId: string, data: UpdateSubscriptionInput): Promise<Subscription> {
    console.log('[SubscriptionRepository] Updating subscription:', { userId, data });

    try {
      const subscription = await this.prisma.subscription.update({
        where: { userId },
        data,
      });

      console.log('[SubscriptionRepository] Subscription updated:', subscription.id);
      return subscription;
    } catch (error) {
      console.error('[SubscriptionRepository] update failed:', error);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('[SubscriptionRepository] Subscription not found');
        }
      }
      throw new Error('[SubscriptionRepository] Failed to update subscription');
    }
  }

  /**
   * Update subscription by Stripe subscription ID
   *
   * @param stripeSubscriptionId - Stripe subscription ID
   * @param data - Subscription update data
   * @returns Updated subscription
   * @throws Error if subscription not found or database operation fails
   *
   * @example
   * const subscription = await subscriptionRepo.updateByStripeId('sub_xxx', {
   *   status: 'past_due'
   * });
   */
  async updateByStripeId(
    stripeSubscriptionId: string,
    data: UpdateSubscriptionInput
  ): Promise<Subscription> {
    console.log('[SubscriptionRepository] Updating subscription by Stripe ID:', {
      stripeSubscriptionId,
      data,
    });

    try {
      const subscription = await this.prisma.subscription.update({
        where: { stripeSubscriptionId },
        data,
      });

      console.log('[SubscriptionRepository] Subscription updated:', subscription.id);
      return subscription;
    } catch (error) {
      console.error('[SubscriptionRepository] updateByStripeId failed:', error);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('[SubscriptionRepository] Subscription not found');
        }
      }
      throw new Error(
        '[SubscriptionRepository] Failed to update subscription by Stripe ID'
      );
    }
  }

  /**
   * Delete subscription
   *
   * @param userId - User ID
   * @returns Deleted subscription
   * @throws Error if subscription not found or database operation fails
   *
   * @example
   * const subscription = await subscriptionRepo.delete('user123');
   */
  async delete(userId: string): Promise<Subscription> {
    console.log('[SubscriptionRepository] Deleting subscription:', userId);

    try {
      const subscription = await this.prisma.subscription.delete({
        where: { userId },
      });

      console.log('[SubscriptionRepository] Subscription deleted:', subscription.id);
      return subscription;
    } catch (error) {
      console.error('[SubscriptionRepository] delete failed:', error);
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new Error('[SubscriptionRepository] Subscription not found');
        }
      }
      throw new Error('[SubscriptionRepository] Failed to delete subscription');
    }
  }

  /**
   * Check if user has active subscription
   *
   * @param userId - User ID
   * @returns True if user has active subscription
   *
   * @example
   * const isActive = await subscriptionRepo.isActive('user123');
   */
  async isActive(userId: string): Promise<boolean> {
    console.log('[SubscriptionRepository] Checking if subscription is active:', userId);

    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
        select: { status: true },
      });

      const isActive =
        subscription?.status === 'active' || subscription?.status === 'trialing';
      console.log('[SubscriptionRepository] Subscription active status:', isActive);

      return isActive;
    } catch (error) {
      console.error('[SubscriptionRepository] isActive failed:', error);
      throw new Error('[SubscriptionRepository] Failed to check subscription status');
    }
  }

  /**
   * Get all active subscriptions
   *
   * @returns Array of active subscriptions
   *
   * @example
   * const activeSubscriptions = await subscriptionRepo.findAllActive();
   */
  async findAllActive(): Promise<Subscription[]> {
    console.log('[SubscriptionRepository] Finding all active subscriptions');

    try {
      const subscriptions = await this.prisma.subscription.findMany({
        where: {
          OR: [{ status: 'active' }, { status: 'trialing' }],
        },
      });

      console.log(
        '[SubscriptionRepository] Found active subscriptions:',
        subscriptions.length
      );
      return subscriptions;
    } catch (error) {
      console.error('[SubscriptionRepository] findAllActive failed:', error);
      throw new Error('[SubscriptionRepository] Failed to find active subscriptions');
    }
  }

  /**
   * Get all subscriptions with status
   *
   * @param status - Subscription status
   * @returns Array of subscriptions with given status
   *
   * @example
   * const pastDueSubscriptions = await subscriptionRepo.findByStatus('past_due');
   */
  async findByStatus(status: string): Promise<Subscription[]> {
    console.log('[SubscriptionRepository] Finding subscriptions by status:', status);

    try {
      const subscriptions = await this.prisma.subscription.findMany({
        where: { status },
      });

      console.log(
        '[SubscriptionRepository] Found subscriptions with status:',
        subscriptions.length
      );
      return subscriptions;
    } catch (error) {
      console.error('[SubscriptionRepository] findByStatus failed:', error);
      throw new Error('[SubscriptionRepository] Failed to find subscriptions by status');
    }
  }
}
