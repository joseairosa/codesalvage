/**
 * SubscriptionService Unit Tests
 *
 * Tests all business logic for subscriptions including Stripe integration and validation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SubscriptionService,
  SubscriptionValidationError,
  SubscriptionPermissionError,
  SubscriptionNotFoundError,
} from '../SubscriptionService';
import type { SubscriptionRepository } from '@/lib/repositories/SubscriptionRepository';
import type { UserRepository } from '@/lib/repositories/UserRepository';
import type { Subscription } from '@prisma/client';

// Mock Stripe
vi.mock('@/lib/stripe', () => ({
  stripe: {
    customers: {
      create: vi.fn(),
      update: vi.fn(),
    },
    paymentMethods: {
      attach: vi.fn(),
    },
    subscriptions: {
      create: vi.fn(),
      update: vi.fn(),
    },
    billingPortal: {
      sessions: {
        create: vi.fn(),
      },
    },
  },
}));

import { stripe } from '@/lib/stripe';

// Create mock Stripe error class
class MockStripeError extends Error {
  type: string;
  raw: any;

  constructor(message: string) {
    super(message);
    this.name = 'StripeError';
    this.type = 'StripeError';
    this.raw = {};
  }
}

// Make MockStripeError look like Stripe error to instanceof checks
Object.setPrototypeOf(MockStripeError.prototype, Error.prototype);

// Mock repositories
const mockSubscriptionRepository = {
  create: vi.fn(),
  findByUserId: vi.fn(),
  findByStripeSubscriptionId: vi.fn(),
  update: vi.fn(),
  updateByStripeId: vi.fn(),
  delete: vi.fn(),
  isActive: vi.fn(),
} as unknown as SubscriptionRepository;

const mockUserRepository = {
  findById: vi.fn(),
  update: vi.fn(),
} as unknown as UserRepository;

// Mock data helpers
const createMockUser = (overrides = {}) => ({
  id: 'user123',
  email: 'seller@test.com',
  username: 'testseller',
  fullName: 'Test Seller',
  isSeller: true,
  stripeAccountId: null,
  ...overrides,
});

const createMockSubscription = (overrides: Partial<Subscription> = {}): Subscription => ({
  id: 'sub123',
  userId: 'user123',
  stripeSubscriptionId: 'sub_stripe123',
  stripeCustomerId: 'cus_stripe123',
  stripePriceId: 'price_stripe123',
  plan: 'pro',
  status: 'active',
  currentPeriodStart: new Date('2026-01-01T00:00:00Z'),
  currentPeriodEnd: new Date('2026-02-01T00:00:00Z'),
  cancelAtPeriodEnd: false,
  canceledAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const createMockStripeCustomer = (overrides = {}) => ({
  id: 'cus_stripe123',
  email: 'seller@test.com',
  ...overrides,
});

const createMockStripeSubscription = (overrides = {}) => ({
  id: 'sub_stripe123',
  status: 'active',
  current_period_start: 1704067200, // 2026-01-01
  current_period_end: 1706745600, // 2026-02-01
  latest_invoice: {
    payment_intent: {
      client_secret: 'pi_secret_xxx',
    },
  },
  ...overrides,
});

describe('SubscriptionService', () => {
  let subscriptionService: SubscriptionService;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create fresh instance
    subscriptionService = new SubscriptionService(
      mockSubscriptionRepository,
      mockUserRepository
    );
  });

  // ============================================
  // CREATE SUBSCRIPTION TESTS
  // ============================================

  describe('createSubscription', () => {
    it('should create subscription successfully', async () => {
      const mockUser = createMockUser();
      const mockCustomer = createMockStripeCustomer();
      const mockStripeSubscription = createMockStripeSubscription();
      const mockSubscription = createMockSubscription();

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);
      vi.mocked(mockSubscriptionRepository.findByUserId).mockResolvedValue(null);
      vi.mocked(stripe.customers.create).mockResolvedValue(mockCustomer as any);
      vi.mocked(stripe.paymentMethods.attach).mockResolvedValue({} as any);
      vi.mocked(stripe.customers.update).mockResolvedValue({} as any);
      vi.mocked(stripe.subscriptions.create).mockResolvedValue(
        mockStripeSubscription as any
      );
      vi.mocked(mockSubscriptionRepository.create).mockResolvedValue(mockSubscription);

      const result = await subscriptionService.createSubscription('user123', {
        plan: 'pro',
        paymentMethodId: 'pm_test123',
      });

      expect(result).toEqual({
        subscriptionId: 'sub_stripe123',
        clientSecret: 'pi_secret_xxx',
        status: 'active',
        currentPeriodEnd: expect.any(String),
      });

      expect(mockUserRepository.findById).toHaveBeenCalledWith('user123');
      expect(stripe.customers.create).toHaveBeenCalled();
      expect(stripe.paymentMethods.attach).toHaveBeenCalledWith('pm_test123', {
        customer: 'cus_stripe123',
      });
      expect(stripe.subscriptions.create).toHaveBeenCalled();
      expect(mockSubscriptionRepository.create).toHaveBeenCalled();
    });

    it('should throw error when user not found', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      await expect(
        subscriptionService.createSubscription('nonexistent', { plan: 'pro' })
      ).rejects.toThrow(SubscriptionNotFoundError);
    });

    it('should throw error when user is not a seller', async () => {
      const mockUser = createMockUser({ isSeller: false });
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);

      await expect(
        subscriptionService.createSubscription('user123', { plan: 'pro' })
      ).rejects.toThrow(SubscriptionPermissionError);
    });

    it('should throw error when user already has active subscription', async () => {
      const mockUser = createMockUser();
      const mockActiveSubscription = createMockSubscription({ status: 'active' });

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);
      vi.mocked(mockSubscriptionRepository.findByUserId).mockResolvedValue(
        mockActiveSubscription
      );

      await expect(
        subscriptionService.createSubscription('user123', { plan: 'pro' })
      ).rejects.toThrow(SubscriptionValidationError);
    });

    it('should reuse existing Stripe customer if available', async () => {
      const mockUser = createMockUser({ stripeAccountId: 'cus_existing123' });
      const mockStripeSubscription = createMockStripeSubscription();
      const mockSubscription = createMockSubscription();

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);
      vi.mocked(mockSubscriptionRepository.findByUserId).mockResolvedValue(null);
      vi.mocked(stripe.subscriptions.create).mockResolvedValue(
        mockStripeSubscription as any
      );
      vi.mocked(mockSubscriptionRepository.create).mockResolvedValue(mockSubscription);

      await subscriptionService.createSubscription('user123', { plan: 'pro' });

      expect(stripe.customers.create).not.toHaveBeenCalled();
      expect(stripe.subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_existing123',
        })
      );
    });

    it('should handle Stripe errors', async () => {
      const mockUser = createMockUser();
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);
      vi.mocked(mockSubscriptionRepository.findByUserId).mockResolvedValue(null);
      vi.mocked(stripe.customers.create).mockRejectedValue(
        new MockStripeError('Card declined')
      );

      await expect(
        subscriptionService.createSubscription('user123', { plan: 'pro' })
      ).rejects.toThrow(SubscriptionValidationError);
    });
  });

  // ============================================
  // CANCEL SUBSCRIPTION TESTS
  // ============================================

  describe('cancelSubscription', () => {
    it('should cancel subscription at end of period', async () => {
      const mockSubscription = createMockSubscription();
      const mockStripeSubscription = { ...createMockStripeSubscription() };
      const mockUpdatedSubscription = createMockSubscription({ cancelAtPeriodEnd: true });

      vi.mocked(mockSubscriptionRepository.findByUserId).mockResolvedValue(
        mockSubscription
      );
      vi.mocked(stripe.subscriptions.update).mockResolvedValue(
        mockStripeSubscription as any
      );
      vi.mocked(mockSubscriptionRepository.update).mockResolvedValue(
        mockUpdatedSubscription
      );

      const result = await subscriptionService.cancelSubscription('user123');

      expect(result).toEqual({
        subscriptionId: 'sub123',
        status: 'active',
        cancelAtPeriodEnd: true,
        currentPeriodEnd: expect.any(String),
      });

      expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_stripe123', {
        cancel_at_period_end: true,
      });
      expect(mockSubscriptionRepository.update).toHaveBeenCalledWith('user123', {
        cancelAtPeriodEnd: true,
      });
    });

    it('should throw error when subscription not found', async () => {
      vi.mocked(mockSubscriptionRepository.findByUserId).mockResolvedValue(null);

      await expect(subscriptionService.cancelSubscription('user123')).rejects.toThrow(
        SubscriptionNotFoundError
      );
    });

    it('should handle Stripe errors', async () => {
      const mockSubscription = createMockSubscription();
      vi.mocked(mockSubscriptionRepository.findByUserId).mockResolvedValue(
        mockSubscription
      );
      vi.mocked(stripe.subscriptions.update).mockRejectedValue(
        new MockStripeError('Invalid subscription')
      );

      await expect(subscriptionService.cancelSubscription('user123')).rejects.toThrow(
        SubscriptionValidationError
      );
    });
  });

  // ============================================
  // RESUME SUBSCRIPTION TESTS
  // ============================================

  describe('resumeSubscription', () => {
    it('should resume canceled subscription', async () => {
      const mockSubscription = createMockSubscription({ cancelAtPeriodEnd: true });
      const mockStripeSubscription = { ...createMockStripeSubscription() };
      const mockUpdatedSubscription = createMockSubscription({
        cancelAtPeriodEnd: false,
      });

      vi.mocked(mockSubscriptionRepository.findByUserId).mockResolvedValue(
        mockSubscription
      );
      vi.mocked(stripe.subscriptions.update).mockResolvedValue(
        mockStripeSubscription as any
      );
      vi.mocked(mockSubscriptionRepository.update).mockResolvedValue(
        mockUpdatedSubscription
      );

      const result = await subscriptionService.resumeSubscription('user123');

      expect(result).toEqual({
        subscriptionId: 'sub123',
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: expect.any(String),
      });

      expect(stripe.subscriptions.update).toHaveBeenCalledWith('sub_stripe123', {
        cancel_at_period_end: false,
      });
    });

    it('should throw error when subscription not found', async () => {
      vi.mocked(mockSubscriptionRepository.findByUserId).mockResolvedValue(null);

      await expect(subscriptionService.resumeSubscription('user123')).rejects.toThrow(
        SubscriptionNotFoundError
      );
    });
  });

  // ============================================
  // GET SUBSCRIPTION STATUS TESTS
  // ============================================

  describe('getSubscriptionStatus', () => {
    it('should return active subscription status with pro benefits', async () => {
      const mockSubscription = createMockSubscription();
      vi.mocked(mockSubscriptionRepository.findByUserId).mockResolvedValue(
        mockSubscription
      );

      const result = await subscriptionService.getSubscriptionStatus('user123');

      expect(result).toEqual({
        subscriptionId: 'sub123',
        plan: 'pro',
        status: 'active',
        currentPeriodEnd: expect.any(String),
        cancelAtPeriodEnd: false,
        benefits: {
          unlimitedListings: true,
          advancedAnalytics: true,
          featuredListingDiscount: 20,
          verificationBadge: true,
        },
      });
    });

    it('should return free plan when no subscription', async () => {
      vi.mocked(mockSubscriptionRepository.findByUserId).mockResolvedValue(null);

      const result = await subscriptionService.getSubscriptionStatus('user123');

      expect(result).toEqual({
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

    it('should return free plan benefits when subscription is not active', async () => {
      const mockSubscription = createMockSubscription({ status: 'canceled' });
      vi.mocked(mockSubscriptionRepository.findByUserId).mockResolvedValue(
        mockSubscription
      );

      const result = await subscriptionService.getSubscriptionStatus('user123');

      expect(result.benefits).toEqual({
        unlimitedListings: false,
        advancedAnalytics: false,
        featuredListingDiscount: 0,
        verificationBadge: false,
      });
    });
  });

  // ============================================
  // CREATE PORTAL SESSION TESTS
  // ============================================

  describe('createPortalSession', () => {
    it('should create Stripe Customer Portal session', async () => {
      const mockSubscription = createMockSubscription();
      const mockPortalSession = {
        id: 'bps_xxx',
        url: 'https://billing.stripe.com/session/xxx',
      };

      vi.mocked(mockSubscriptionRepository.findByUserId).mockResolvedValue(
        mockSubscription
      );
      vi.mocked(stripe.billingPortal.sessions.create).mockResolvedValue(
        mockPortalSession as any
      );

      const result = await subscriptionService.createPortalSession(
        'user123',
        'https://app.com/settings'
      );

      expect(result).toBe('https://billing.stripe.com/session/xxx');
      expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_stripe123',
        return_url: 'https://app.com/settings',
      });
    });

    it('should throw error when subscription not found', async () => {
      vi.mocked(mockSubscriptionRepository.findByUserId).mockResolvedValue(null);

      await expect(
        subscriptionService.createPortalSession('user123', 'https://app.com/settings')
      ).rejects.toThrow(SubscriptionNotFoundError);
    });

    it('should handle Stripe errors', async () => {
      const mockSubscription = createMockSubscription();
      vi.mocked(mockSubscriptionRepository.findByUserId).mockResolvedValue(
        mockSubscription
      );
      vi.mocked(stripe.billingPortal.sessions.create).mockRejectedValue(
        new MockStripeError('API Error')
      );

      await expect(
        subscriptionService.createPortalSession('user123', 'https://app.com/settings')
      ).rejects.toThrow(SubscriptionValidationError);
    });
  });

  // ============================================
  // IS ACTIVE SUBSCRIBER TESTS
  // ============================================

  describe('isActiveSubscriber', () => {
    it('should return true when user has active subscription', async () => {
      vi.mocked(mockSubscriptionRepository.isActive).mockResolvedValue(true);

      const result = await subscriptionService.isActiveSubscriber('user123');

      expect(result).toBe(true);
      expect(mockSubscriptionRepository.isActive).toHaveBeenCalledWith('user123');
    });

    it('should return false when user does not have active subscription', async () => {
      vi.mocked(mockSubscriptionRepository.isActive).mockResolvedValue(false);

      const result = await subscriptionService.isActiveSubscriber('user123');

      expect(result).toBe(false);
    });
  });

  // ============================================
  // GET PRICING TESTS
  // ============================================

  describe('getPricing', () => {
    it('should return pricing information for all plans', () => {
      const result = subscriptionService.getPricing();

      expect(result).toEqual({
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
      const mockSubscription = createMockSubscription();
      const mockUpdatedSubscription = createMockSubscription({
        status: 'past_due',
        currentPeriodStart: new Date('2026-02-01T00:00:00Z'),
        currentPeriodEnd: new Date('2026-03-01T00:00:00Z'),
      });

      vi.mocked(mockSubscriptionRepository.findByStripeSubscriptionId).mockResolvedValue(
        mockSubscription
      );
      vi.mocked(mockSubscriptionRepository.updateByStripeId).mockResolvedValue(
        mockUpdatedSubscription
      );

      const result = await subscriptionService.updateFromWebhook(
        'sub_stripe123',
        'past_due',
        new Date('2026-02-01T00:00:00Z'),
        new Date('2026-03-01T00:00:00Z')
      );

      expect(result).toEqual(mockUpdatedSubscription);
      expect(mockSubscriptionRepository.updateByStripeId).toHaveBeenCalledWith(
        'sub_stripe123',
        {
          status: 'past_due',
          currentPeriodStart: new Date('2026-02-01T00:00:00Z'),
          currentPeriodEnd: new Date('2026-03-01T00:00:00Z'),
        }
      );
    });

    it('should throw error when subscription not found', async () => {
      vi.mocked(mockSubscriptionRepository.findByStripeSubscriptionId).mockResolvedValue(
        null
      );

      await expect(
        subscriptionService.updateFromWebhook(
          'nonexistent',
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
      const mockSubscription = createMockSubscription();
      const mockCanceledSubscription = createMockSubscription({
        status: 'canceled',
        canceledAt: new Date('2026-01-20T00:00:00Z'),
      });

      vi.mocked(mockSubscriptionRepository.findByStripeSubscriptionId).mockResolvedValue(
        mockSubscription
      );
      vi.mocked(mockSubscriptionRepository.updateByStripeId).mockResolvedValue(
        mockCanceledSubscription
      );

      const result = await subscriptionService.cancelImmediately('sub_stripe123');

      expect(result).toEqual(mockCanceledSubscription);
      expect(mockSubscriptionRepository.updateByStripeId).toHaveBeenCalledWith(
        'sub_stripe123',
        {
          status: 'canceled',
          canceledAt: expect.any(Date),
        }
      );
    });

    it('should throw error when subscription not found', async () => {
      vi.mocked(mockSubscriptionRepository.findByStripeSubscriptionId).mockResolvedValue(
        null
      );

      await expect(subscriptionService.cancelImmediately('nonexistent')).rejects.toThrow(
        SubscriptionNotFoundError
      );
    });
  });
});
