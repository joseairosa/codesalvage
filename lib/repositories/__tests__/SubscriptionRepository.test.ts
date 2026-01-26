/**
 * SubscriptionRepository Unit Tests
 *
 * Tests all CRUD operations and query methods for subscriptions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubscriptionRepository } from '../SubscriptionRepository';
import type { PrismaClient, Subscription } from '@prisma/client';
import { Prisma } from '@prisma/client';

// Mock Prisma Client
const mockPrismaClient = {
  subscription: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
} as unknown as PrismaClient;

// Mock data helpers
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

const createMockSubscriptionWithUser = (overrides = {}) => ({
  ...createMockSubscription(overrides),
  user: {
    id: 'user123',
    email: 'user@example.com',
    username: 'testuser',
    fullName: 'Test User',
    isSeller: true,
  },
});

describe('SubscriptionRepository', () => {
  let subscriptionRepository: SubscriptionRepository;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create fresh instance
    subscriptionRepository = new SubscriptionRepository(mockPrismaClient);
  });

  // ============================================
  // CREATE TESTS
  // ============================================

  describe('create', () => {
    it('should create subscription', async () => {
      const mockSubscription = createMockSubscription();
      vi.mocked(mockPrismaClient.subscription.create).mockResolvedValue(mockSubscription);

      const result = await subscriptionRepository.create({
        userId: 'user123',
        stripeSubscriptionId: 'sub_stripe123',
        stripeCustomerId: 'cus_stripe123',
        stripePriceId: 'price_stripe123',
        plan: 'pro',
        status: 'active',
        currentPeriodStart: new Date('2026-01-01T00:00:00Z'),
        currentPeriodEnd: new Date('2026-02-01T00:00:00Z'),
      });

      expect(result).toEqual(mockSubscription);
      expect(mockPrismaClient.subscription.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          stripeSubscriptionId: 'sub_stripe123',
          stripeCustomerId: 'cus_stripe123',
          stripePriceId: 'price_stripe123',
          plan: 'pro',
          status: 'active',
          currentPeriodStart: new Date('2026-01-01T00:00:00Z'),
          currentPeriodEnd: new Date('2026-02-01T00:00:00Z'),
        },
      });
    });

    it('should throw error when duplicate subscription (unique constraint)', async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '5.0.0' }
      );
      vi.mocked(mockPrismaClient.subscription.create).mockRejectedValue(error);

      await expect(
        subscriptionRepository.create({
          userId: 'user123',
          stripeSubscriptionId: 'sub_stripe123',
          stripeCustomerId: 'cus_stripe123',
          stripePriceId: 'price_stripe123',
          plan: 'pro',
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
        })
      ).rejects.toThrow(
        '[SubscriptionRepository] Subscription already exists for this user or Stripe subscription ID'
      );
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.subscription.create).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(
        subscriptionRepository.create({
          userId: 'user123',
          stripeSubscriptionId: 'sub_stripe123',
          stripeCustomerId: 'cus_stripe123',
          stripePriceId: 'price_stripe123',
          plan: 'pro',
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
        })
      ).rejects.toThrow('[SubscriptionRepository] Failed to create subscription');
    });
  });

  // ============================================
  // FIND BY USER ID TESTS
  // ============================================

  describe('findByUserId', () => {
    it('should find subscription by user ID', async () => {
      const mockSubscription = createMockSubscription();
      vi.mocked(mockPrismaClient.subscription.findUnique).mockResolvedValue(mockSubscription);

      const result = await subscriptionRepository.findByUserId('user123');

      expect(result).toEqual(mockSubscription);
      expect(mockPrismaClient.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user123' },
      });
    });

    it('should return null when subscription not found', async () => {
      vi.mocked(mockPrismaClient.subscription.findUnique).mockResolvedValue(null);

      const result = await subscriptionRepository.findByUserId('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.subscription.findUnique).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(subscriptionRepository.findByUserId('user123')).rejects.toThrow(
        '[SubscriptionRepository] Failed to find subscription by user ID'
      );
    });
  });

  // ============================================
  // FIND BY STRIPE SUBSCRIPTION ID TESTS
  // ============================================

  describe('findByStripeSubscriptionId', () => {
    it('should find subscription by Stripe subscription ID', async () => {
      const mockSubscription = createMockSubscription();
      vi.mocked(mockPrismaClient.subscription.findUnique).mockResolvedValue(mockSubscription);

      const result = await subscriptionRepository.findByStripeSubscriptionId('sub_stripe123');

      expect(result).toEqual(mockSubscription);
      expect(mockPrismaClient.subscription.findUnique).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_stripe123' },
      });
    });

    it('should return null when subscription not found', async () => {
      vi.mocked(mockPrismaClient.subscription.findUnique).mockResolvedValue(null);

      const result = await subscriptionRepository.findByStripeSubscriptionId('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.subscription.findUnique).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(
        subscriptionRepository.findByStripeSubscriptionId('sub_stripe123')
      ).rejects.toThrow(
        '[SubscriptionRepository] Failed to find subscription by Stripe subscription ID'
      );
    });
  });

  // ============================================
  // FIND BY ID WITH USER TESTS
  // ============================================

  describe('findByIdWithUser', () => {
    it('should find subscription by ID with user details', async () => {
      const mockSubscriptionWithUser = createMockSubscriptionWithUser();
      vi.mocked(mockPrismaClient.subscription.findUnique).mockResolvedValue(
        mockSubscriptionWithUser
      );

      const result = await subscriptionRepository.findByIdWithUser('sub123');

      expect(result).toEqual(mockSubscriptionWithUser);
      expect(mockPrismaClient.subscription.findUnique).toHaveBeenCalledWith({
        where: { id: 'sub123' },
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
    });

    it('should return null when subscription not found', async () => {
      vi.mocked(mockPrismaClient.subscription.findUnique).mockResolvedValue(null);

      const result = await subscriptionRepository.findByIdWithUser('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.subscription.findUnique).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(subscriptionRepository.findByIdWithUser('sub123')).rejects.toThrow(
        '[SubscriptionRepository] Failed to find subscription with user'
      );
    });
  });

  // ============================================
  // UPDATE TESTS
  // ============================================

  describe('update', () => {
    it('should update subscription', async () => {
      const mockUpdatedSubscription = createMockSubscription({ status: 'canceled' });
      vi.mocked(mockPrismaClient.subscription.update).mockResolvedValue(
        mockUpdatedSubscription
      );

      const result = await subscriptionRepository.update('user123', {
        status: 'canceled',
        canceledAt: new Date('2026-01-20T00:00:00Z'),
      });

      expect(result).toEqual(mockUpdatedSubscription);
      expect(mockPrismaClient.subscription.update).toHaveBeenCalledWith({
        where: { userId: 'user123' },
        data: {
          status: 'canceled',
          canceledAt: new Date('2026-01-20T00:00:00Z'),
        },
      });
    });

    it('should throw error when subscription not found', async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '5.0.0' }
      );
      vi.mocked(mockPrismaClient.subscription.update).mockRejectedValue(error);

      await expect(
        subscriptionRepository.update('nonexistent', { status: 'canceled' })
      ).rejects.toThrow('[SubscriptionRepository] Subscription not found');
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.subscription.update).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(
        subscriptionRepository.update('user123', { status: 'canceled' })
      ).rejects.toThrow('[SubscriptionRepository] Failed to update subscription');
    });
  });

  // ============================================
  // UPDATE BY STRIPE ID TESTS
  // ============================================

  describe('updateByStripeId', () => {
    it('should update subscription by Stripe subscription ID', async () => {
      const mockUpdatedSubscription = createMockSubscription({ status: 'past_due' });
      vi.mocked(mockPrismaClient.subscription.update).mockResolvedValue(
        mockUpdatedSubscription
      );

      const result = await subscriptionRepository.updateByStripeId('sub_stripe123', {
        status: 'past_due',
      });

      expect(result).toEqual(mockUpdatedSubscription);
      expect(mockPrismaClient.subscription.update).toHaveBeenCalledWith({
        where: { stripeSubscriptionId: 'sub_stripe123' },
        data: { status: 'past_due' },
      });
    });

    it('should throw error when subscription not found', async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '5.0.0' }
      );
      vi.mocked(mockPrismaClient.subscription.update).mockRejectedValue(error);

      await expect(
        subscriptionRepository.updateByStripeId('nonexistent', { status: 'canceled' })
      ).rejects.toThrow('[SubscriptionRepository] Subscription not found');
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.subscription.update).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(
        subscriptionRepository.updateByStripeId('sub_stripe123', { status: 'canceled' })
      ).rejects.toThrow('[SubscriptionRepository] Failed to update subscription by Stripe ID');
    });
  });

  // ============================================
  // DELETE TESTS
  // ============================================

  describe('delete', () => {
    it('should delete subscription', async () => {
      const mockSubscription = createMockSubscription();
      vi.mocked(mockPrismaClient.subscription.delete).mockResolvedValue(mockSubscription);

      const result = await subscriptionRepository.delete('user123');

      expect(result).toEqual(mockSubscription);
      expect(mockPrismaClient.subscription.delete).toHaveBeenCalledWith({
        where: { userId: 'user123' },
      });
    });

    it('should throw error when subscription not found', async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        { code: 'P2025', clientVersion: '5.0.0' }
      );
      vi.mocked(mockPrismaClient.subscription.delete).mockRejectedValue(error);

      await expect(subscriptionRepository.delete('nonexistent')).rejects.toThrow(
        '[SubscriptionRepository] Subscription not found'
      );
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.subscription.delete).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(subscriptionRepository.delete('user123')).rejects.toThrow(
        '[SubscriptionRepository] Failed to delete subscription'
      );
    });
  });

  // ============================================
  // IS ACTIVE TESTS
  // ============================================

  describe('isActive', () => {
    it('should return true when subscription is active', async () => {
      vi.mocked(mockPrismaClient.subscription.findUnique).mockResolvedValue({
        status: 'active',
      } as Subscription);

      const result = await subscriptionRepository.isActive('user123');

      expect(result).toBe(true);
    });

    it('should return true when subscription is trialing', async () => {
      vi.mocked(mockPrismaClient.subscription.findUnique).mockResolvedValue({
        status: 'trialing',
      } as Subscription);

      const result = await subscriptionRepository.isActive('user123');

      expect(result).toBe(true);
    });

    it('should return false when subscription is canceled', async () => {
      vi.mocked(mockPrismaClient.subscription.findUnique).mockResolvedValue({
        status: 'canceled',
      } as Subscription);

      const result = await subscriptionRepository.isActive('user123');

      expect(result).toBe(false);
    });

    it('should return false when subscription not found', async () => {
      vi.mocked(mockPrismaClient.subscription.findUnique).mockResolvedValue(null);

      const result = await subscriptionRepository.isActive('user123');

      expect(result).toBe(false);
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.subscription.findUnique).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(subscriptionRepository.isActive('user123')).rejects.toThrow(
        '[SubscriptionRepository] Failed to check subscription status'
      );
    });
  });

  // ============================================
  // FIND ALL ACTIVE TESTS
  // ============================================

  describe('findAllActive', () => {
    it('should find all active and trialing subscriptions', async () => {
      const mockSubscriptions = [
        createMockSubscription({ status: 'active' }),
        createMockSubscription({ status: 'trialing', userId: 'user456' }),
      ];
      vi.mocked(mockPrismaClient.subscription.findMany).mockResolvedValue(mockSubscriptions);

      const result = await subscriptionRepository.findAllActive();

      expect(result).toEqual(mockSubscriptions);
      expect(mockPrismaClient.subscription.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ status: 'active' }, { status: 'trialing' }],
        },
      });
    });

    it('should return empty array when no active subscriptions', async () => {
      vi.mocked(mockPrismaClient.subscription.findMany).mockResolvedValue([]);

      const result = await subscriptionRepository.findAllActive();

      expect(result).toEqual([]);
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.subscription.findMany).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(subscriptionRepository.findAllActive()).rejects.toThrow(
        '[SubscriptionRepository] Failed to find active subscriptions'
      );
    });
  });

  // ============================================
  // FIND BY STATUS TESTS
  // ============================================

  describe('findByStatus', () => {
    it('should find subscriptions by status', async () => {
      const mockSubscriptions = [
        createMockSubscription({ status: 'past_due' }),
        createMockSubscription({ status: 'past_due', userId: 'user456' }),
      ];
      vi.mocked(mockPrismaClient.subscription.findMany).mockResolvedValue(mockSubscriptions);

      const result = await subscriptionRepository.findByStatus('past_due');

      expect(result).toEqual(mockSubscriptions);
      expect(mockPrismaClient.subscription.findMany).toHaveBeenCalledWith({
        where: { status: 'past_due' },
      });
    });

    it('should return empty array when no subscriptions with status', async () => {
      vi.mocked(mockPrismaClient.subscription.findMany).mockResolvedValue([]);

      const result = await subscriptionRepository.findByStatus('canceled');

      expect(result).toEqual([]);
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.subscription.findMany).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(subscriptionRepository.findByStatus('active')).rejects.toThrow(
        '[SubscriptionRepository] Failed to find subscriptions by status'
      );
    });
  });
});
