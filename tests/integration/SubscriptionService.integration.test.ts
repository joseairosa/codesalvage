/**
 * SubscriptionService Integration Tests
 *
 * Tests subscription business logic with real database operations.
 * Stripe API calls are mocked to avoid external dependencies.
 *
 * Prerequisites:
 * - Test database must be running: `npm run test:db:setup`
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
} from '@/tests/helpers/db';
import { createTestUser } from '@/tests/helpers/fixtures';
import {
  SubscriptionService,
  SubscriptionValidationError,
  SubscriptionPermissionError,
  SubscriptionNotFoundError,
} from '@/lib/services/SubscriptionService';
import { SubscriptionRepository } from '@/lib/repositories/SubscriptionRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { prisma } from '@/lib/prisma';

// Mock Stripe
vi.mock('@/lib/stripe', () => ({
  stripe: {
    customers: {
      create: vi.fn().mockResolvedValue({ id: 'cus_test123' }),
      update: vi.fn().mockResolvedValue({}),
    },
    paymentMethods: {
      attach: vi.fn().mockResolvedValue({}),
    },
    subscriptions: {
      create: vi.fn().mockResolvedValue({
        id: 'sub_test123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
        latest_invoice: {
          payment_intent: {
            client_secret: 'pi_secret_test',
          },
        },
      }),
      update: vi.fn().mockResolvedValue({
        id: 'sub_test123',
        status: 'active',
        cancel_at_period_end: false,
      }),
    },
    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: 'bps_test123',
          url: 'https://billing.stripe.com/session/test',
        }),
      },
    },
  },
}));

describe('SubscriptionService (Integration)', () => {
  let subscriptionService: SubscriptionService;
  let subscriptionRepository: SubscriptionRepository;
  let userRepository: UserRepository;

  beforeAll(async () => {
    await setupTestDatabase();
    subscriptionRepository = new SubscriptionRepository(prisma);
    userRepository = new UserRepository(prisma);
    subscriptionService = new SubscriptionService(subscriptionRepository, userRepository);
  });

  beforeEach(async () => {
    await cleanDatabase();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  // ============================================
  // CREATE SUBSCRIPTION TESTS
  // ============================================

  describe('createSubscription', () => {
    it('should create subscription successfully for seller', async () => {
      // Create seller user
      const seller = await createTestUser({
        username: 'pro-seller',
        isSeller: true,
      });

      // Create subscription
      const result = await subscriptionService.createSubscription(seller.id, {
        plan: 'pro',
        paymentMethodId: 'pm_test123',
      });

      // Verify result
      expect(result).toMatchObject({
        subscriptionId: 'sub_test123',
        status: 'active',
      });
      expect(result.clientSecret).toBeDefined();
      expect(result.currentPeriodEnd).toBeDefined();

      // Verify subscription stored in database
      const dbSubscription = await subscriptionRepository.findByUserId(seller.id);
      expect(dbSubscription).toBeDefined();
      expect(dbSubscription?.plan).toBe('pro');
      expect(dbSubscription?.status).toBe('active');
      expect(dbSubscription?.stripeSubscriptionId).toBe('sub_test123');
    });

    it('should throw error when user is not a seller', async () => {
      // Create buyer user
      const buyer = await createTestUser({
        username: 'buyer-only',
        isSeller: false,
      });

      // Attempt to create subscription
      await expect(
        subscriptionService.createSubscription(buyer.id, { plan: 'pro' })
      ).rejects.toThrow(SubscriptionPermissionError);
    });

    it('should throw error when user already has active subscription', async () => {
      // Create seller with subscription
      const seller = await createTestUser({
        username: 'subscribed-seller',
        isSeller: true,
      });

      // Create first subscription
      await subscriptionService.createSubscription(seller.id, {
        plan: 'pro',
      });

      // Attempt to create second subscription
      await expect(
        subscriptionService.createSubscription(seller.id, { plan: 'pro' })
      ).rejects.toThrow(SubscriptionValidationError);
    });

    it('should reuse existing Stripe customer ID', async () => {
      const { stripe } = await import('@/lib/stripe');

      // Create seller with existing Stripe account ID
      const seller = await createTestUser({
        username: 'existing-customer',
        isSeller: true,
        stripeAccountId: 'cus_existing456',
      });

      // Create subscription
      await subscriptionService.createSubscription(seller.id, { plan: 'pro' });

      // Verify Stripe customer create was NOT called
      expect(stripe.customers.create).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // CANCEL SUBSCRIPTION TESTS
  // ============================================

  describe('cancelSubscription', () => {
    it('should cancel subscription at end of period', async () => {
      // Create seller with subscription
      const seller = await createTestUser({
        username: 'cancel-seller',
        isSeller: true,
      });
      await subscriptionService.createSubscription(seller.id, { plan: 'pro' });

      // Cancel subscription
      const result = await subscriptionService.cancelSubscription(seller.id);

      // Verify result
      expect(result).toMatchObject({
        status: 'active',
        cancelAtPeriodEnd: true,
      });

      // Verify subscription updated in database
      const dbSubscription = await subscriptionRepository.findByUserId(seller.id);
      expect(dbSubscription?.cancelAtPeriodEnd).toBe(true);
    });

    it('should throw error when subscription not found', async () => {
      // Create seller without subscription
      const seller = await createTestUser({
        username: 'no-sub-seller',
        isSeller: true,
      });

      // Attempt to cancel subscription
      await expect(subscriptionService.cancelSubscription(seller.id)).rejects.toThrow(
        SubscriptionNotFoundError
      );
    });
  });

  // ============================================
  // RESUME SUBSCRIPTION TESTS
  // ============================================

  describe('resumeSubscription', () => {
    it('should resume canceled subscription', async () => {
      // Create seller with subscription
      const seller = await createTestUser({
        username: 'resume-seller',
        isSeller: true,
      });
      await subscriptionService.createSubscription(seller.id, { plan: 'pro' });

      // Cancel subscription
      await subscriptionService.cancelSubscription(seller.id);

      // Resume subscription
      const result = await subscriptionService.resumeSubscription(seller.id);

      // Verify result
      expect(result).toMatchObject({
        status: 'active',
        cancelAtPeriodEnd: false,
      });

      // Verify subscription updated in database
      const dbSubscription = await subscriptionRepository.findByUserId(seller.id);
      expect(dbSubscription?.cancelAtPeriodEnd).toBe(false);
    });

    it('should throw error when subscription not found', async () => {
      // Create seller without subscription
      const seller = await createTestUser({
        username: 'no-resume-seller',
        isSeller: true,
      });

      // Attempt to resume subscription
      await expect(subscriptionService.resumeSubscription(seller.id)).rejects.toThrow(
        SubscriptionNotFoundError
      );
    });
  });

  // ============================================
  // GET SUBSCRIPTION STATUS TESTS
  // ============================================

  describe('getSubscriptionStatus', () => {
    it('should return active subscription status with pro benefits', async () => {
      // Create seller with subscription
      const seller = await createTestUser({
        username: 'status-seller',
        isSeller: true,
      });
      await subscriptionService.createSubscription(seller.id, { plan: 'pro' });

      // Get subscription status
      const status = await subscriptionService.getSubscriptionStatus(seller.id);

      // Verify status
      expect(status).toMatchObject({
        plan: 'pro',
        status: 'active',
        cancelAtPeriodEnd: false,
        benefits: {
          unlimitedListings: true,
          advancedAnalytics: true,
          featuredListingDiscount: 20,
          verificationBadge: true,
        },
      });
      expect(status.subscriptionId).toBeDefined();
      expect(status.currentPeriodEnd).toBeDefined();
    });

    it('should return free plan when no subscription', async () => {
      // Create seller without subscription
      const seller = await createTestUser({
        username: 'free-seller',
        isSeller: true,
      });

      // Get subscription status
      const status = await subscriptionService.getSubscriptionStatus(seller.id);

      // Verify status
      expect(status).toMatchObject({
        subscriptionId: null,
        plan: 'free',
        status: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        benefits: {
          unlimitedListings: false,
          advancedAnalytics: false,
          featuredListingDiscount: 0,
          verificationBadge: false,
        },
      });
    });

    it('should return free plan benefits when subscription is canceled', async () => {
      // Create subscription and immediately cancel it
      const seller = await createTestUser({
        username: 'canceled-seller',
        isSeller: true,
      });
      await subscriptionService.createSubscription(seller.id, { plan: 'pro' });

      // Manually update subscription to canceled status
      await subscriptionRepository.update(seller.id, {
        status: 'canceled',
        canceledAt: new Date(),
      });

      // Get subscription status
      const status = await subscriptionService.getSubscriptionStatus(seller.id);

      // Verify free plan benefits (subscription inactive)
      expect(status.plan).toBe('pro'); // Plan is still pro
      expect(status.status).toBe('canceled');
      expect(status.benefits).toEqual({
        unlimitedListings: false,
        advancedAnalytics: false,
        featuredListingDiscount: 0,
        verificationBadge: false,
      });
    });
  });

  // ============================================
  // IS ACTIVE SUBSCRIBER TESTS
  // ============================================

  describe('isActiveSubscriber', () => {
    it('should return true for active subscription', async () => {
      // Create seller with subscription
      const seller = await createTestUser({
        username: 'active-sub-seller',
        isSeller: true,
      });
      await subscriptionService.createSubscription(seller.id, { plan: 'pro' });

      // Check if active subscriber
      const isActive = await subscriptionService.isActiveSubscriber(seller.id);

      expect(isActive).toBe(true);
    });

    it('should return false when no subscription', async () => {
      // Create seller without subscription
      const seller = await createTestUser({
        username: 'inactive-seller',
        isSeller: true,
      });

      // Check if active subscriber
      const isActive = await subscriptionService.isActiveSubscriber(seller.id);

      expect(isActive).toBe(false);
    });

    it('should return false when subscription is canceled', async () => {
      // Create seller with canceled subscription
      const seller = await createTestUser({
        username: 'canceled-sub-seller',
        isSeller: true,
      });
      await subscriptionService.createSubscription(seller.id, { plan: 'pro' });

      // Cancel subscription
      await subscriptionRepository.update(seller.id, {
        status: 'canceled',
        canceledAt: new Date(),
      });

      // Check if active subscriber
      const isActive = await subscriptionService.isActiveSubscriber(seller.id);

      expect(isActive).toBe(false);
    });
  });

  // ============================================
  // GET PRICING TESTS
  // ============================================

  describe('getPricing', () => {
    it('should return pricing for all plans', () => {
      const pricing = subscriptionService.getPricing();

      expect(pricing).toEqual({
        free: {
          plan: 'free',
          costCents: 0,
          benefits: {
            unlimitedListings: false,
            advancedAnalytics: false,
            featuredListingDiscount: 0,
            verificationBadge: false,
          },
        },
        pro: {
          plan: 'pro',
          costCents: 999,
          priceId: expect.any(String),
          benefits: {
            unlimitedListings: true,
            advancedAnalytics: true,
            featuredListingDiscount: 20,
            verificationBadge: true,
          },
        },
      });
    });
  });

  // ============================================
  // UPDATE FROM WEBHOOK TESTS
  // ============================================

  describe('updateFromWebhook', () => {
    it('should update subscription from webhook event', async () => {
      // Create seller with subscription
      const seller = await createTestUser({
        username: 'webhook-seller',
        isSeller: true,
      });
      await subscriptionService.createSubscription(seller.id, { plan: 'pro' });

      const subscription = await subscriptionRepository.findByUserId(seller.id);
      expect(subscription).toBeDefined();

      // Simulate webhook update
      const newPeriodStart = new Date('2026-02-01T00:00:00Z');
      const newPeriodEnd = new Date('2026-03-01T00:00:00Z');

      const result = await subscriptionService.updateFromWebhook(
        subscription!.stripeSubscriptionId,
        'past_due',
        newPeriodStart,
        newPeriodEnd
      );

      // Verify update
      expect(result.status).toBe('past_due');
      expect(result.currentPeriodStart).toEqual(newPeriodStart);
      expect(result.currentPeriodEnd).toEqual(newPeriodEnd);

      // Verify database updated
      const updatedSubscription = await subscriptionRepository.findByUserId(seller.id);
      expect(updatedSubscription?.status).toBe('past_due');
    });

    it('should throw error when subscription not found', async () => {
      await expect(
        subscriptionService.updateFromWebhook(
          'sub_nonexistent',
          'active',
          new Date(),
          new Date()
        )
      ).rejects.toThrow(SubscriptionNotFoundError);
    });
  });

  // ============================================
  // CANCEL IMMEDIATELY TESTS
  // ============================================

  describe('cancelImmediately', () => {
    it('should cancel subscription immediately', async () => {
      // Create seller with subscription
      const seller = await createTestUser({
        username: 'immediate-cancel-seller',
        isSeller: true,
      });
      await subscriptionService.createSubscription(seller.id, { plan: 'pro' });

      const subscription = await subscriptionRepository.findByUserId(seller.id);
      expect(subscription).toBeDefined();

      // Cancel immediately via webhook
      const result = await subscriptionService.cancelImmediately(
        subscription!.stripeSubscriptionId
      );

      // Verify cancellation
      expect(result.status).toBe('canceled');
      expect(result.canceledAt).toBeDefined();

      // Verify database updated
      const canceledSubscription = await subscriptionRepository.findByUserId(seller.id);
      expect(canceledSubscription?.status).toBe('canceled');
      expect(canceledSubscription?.canceledAt).toBeDefined();
    });

    it('should throw error when subscription not found', async () => {
      await expect(subscriptionService.cancelImmediately('sub_nonexistent')).rejects.toThrow(
        SubscriptionNotFoundError
      );
    });
  });
});
