/**
 * FeaturedListingService Unit Tests
 *
 * Tests all business logic for featured listings including validation and permissions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FeaturedListingService,
  FeaturedListingValidationError,
  FeaturedListingPermissionError,
  FeaturedListingNotFoundError,
} from '../FeaturedListingService';
import type { FeaturedListingRepository } from '@/lib/repositories/FeaturedListingRepository';
import type { UserRepository } from '@/lib/repositories/UserRepository';
import type { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import type { SubscriptionService } from '@/lib/services/SubscriptionService';

// Mock repositories
const mockFeaturedListingRepository = {
  setFeatured: vi.fn(),
  unsetFeatured: vi.fn(),
  getFeaturedProjects: vi.fn(),
  isFeatured: vi.fn(),
  countFeaturedBySeller: vi.fn(),
  extendFeaturedPeriod: vi.fn(),
  cleanupExpiredFeatured: vi.fn(),
} as unknown as FeaturedListingRepository;

const mockUserRepository = {
  findById: vi.fn(),
} as unknown as UserRepository;

const mockProjectRepository = {
  findById: vi.fn(),
} as unknown as ProjectRepository;

const mockSubscriptionService = {
  getSubscriptionStatus: vi.fn(),
  createSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  resumeSubscription: vi.fn(),
  isActiveSubscriber: vi.fn(),
  getPricing: vi.fn(),
  updateFromWebhook: vi.fn(),
  cancelImmediately: vi.fn(),
  createPortalSession: vi.fn(),
} as unknown as SubscriptionService;

// Mock data helpers
const createMockUser = (overrides = {}) => ({
  id: 'user123',
  email: 'seller@test.com',
  username: 'testseller',
  fullName: 'Test Seller',
  isSeller: true,
  ...overrides,
});

const createMockProject = (overrides = {}) => ({
  id: 'project456',
  title: 'Test Project',
  description: 'A test project',
  sellerId: 'user123',
  status: 'active',
  priceCents: 50000,
  completionPercentage: 80,
  isFeatured: false,
  featuredUntil: null,
  ...overrides,
});

const createMockFeaturedProject = (overrides = {}) => ({
  ...createMockProject(overrides),
  isFeatured: true,
  featuredUntil: new Date('2026-02-15T10:00:00Z'),
  seller: {
    id: 'user123',
    username: 'testseller',
    fullName: 'Test Seller',
    avatarUrl: 'https://avatar.com/seller.jpg',
  },
});

describe('FeaturedListingService', () => {
  let featuredListingService: FeaturedListingService;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Setup default subscription mock (free plan, no discount)
    vi.mocked(mockSubscriptionService.getSubscriptionStatus).mockResolvedValue({
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

    // Create fresh instance
    featuredListingService = new FeaturedListingService(
      mockFeaturedListingRepository,
      mockProjectRepository,
      mockUserRepository,
      mockSubscriptionService
    );
  });

  // ============================================
  // PURCHASE FEATURED PLACEMENT TESTS
  // ============================================

  describe('purchaseFeaturedPlacement', () => {
    it('should purchase featured placement successfully', async () => {
      const mockUser = createMockUser();
      const mockProject = createMockProject();
      const featuredUntil = new Date();
      featuredUntil.setDate(featuredUntil.getDate() + 7);
      const mockUpdatedProject = {
        ...mockProject,
        isFeatured: true,
        featuredUntil,
      };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject as any);
      vi.mocked(mockFeaturedListingRepository.setFeatured).mockResolvedValue(
        mockUpdatedProject as any
      );

      const result = await featuredListingService.purchaseFeaturedPlacement('user123', {
        projectId: 'project456',
        durationDays: 7,
      });

      expect(result.projectId).toBe('project456');
      expect(result.durationDays).toBe(7);
      expect(result.costCents).toBe(2999); // 7 days = $29.99
      expect(mockFeaturedListingRepository.setFeatured).toHaveBeenCalledWith(
        'project456',
        expect.any(Date)
      );
    });

    it('should throw error if user is not a seller', async () => {
      const mockUser = createMockUser({ isSeller: false });

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);

      await expect(
        featuredListingService.purchaseFeaturedPlacement('user123', {
          projectId: 'project456',
          durationDays: 7,
        })
      ).rejects.toThrow(FeaturedListingPermissionError);
      await expect(
        featuredListingService.purchaseFeaturedPlacement('user123', {
          projectId: 'project456',
          durationDays: 7,
        })
      ).rejects.toThrow('Only sellers can purchase featured placement');
    });

    it('should throw error if user not found', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      await expect(
        featuredListingService.purchaseFeaturedPlacement('user123', {
          projectId: 'project456',
          durationDays: 7,
        })
      ).rejects.toThrow(FeaturedListingPermissionError);
    });

    it('should throw error if duration is invalid', async () => {
      const mockUser = createMockUser();

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);

      await expect(
        featuredListingService.purchaseFeaturedPlacement('user123', {
          projectId: 'project456',
          durationDays: 5, // Invalid duration
        })
      ).rejects.toThrow(FeaturedListingValidationError);
      await expect(
        featuredListingService.purchaseFeaturedPlacement('user123', {
          projectId: 'project456',
          durationDays: 5,
        })
      ).rejects.toThrow('Invalid duration. Must be one of: 7, 14, 30 days');
    });

    it('should throw error if project not found', async () => {
      const mockUser = createMockUser();

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      await expect(
        featuredListingService.purchaseFeaturedPlacement('user123', {
          projectId: 'project456',
          durationDays: 7,
        })
      ).rejects.toThrow(FeaturedListingNotFoundError);
      await expect(
        featuredListingService.purchaseFeaturedPlacement('user123', {
          projectId: 'project456',
          durationDays: 7,
        })
      ).rejects.toThrow('Project project456 not found');
    });

    it('should throw error if user does not own project', async () => {
      const mockUser = createMockUser();
      const mockProject = createMockProject({ sellerId: 'otheruser456' });

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject as any);

      await expect(
        featuredListingService.purchaseFeaturedPlacement('user123', {
          projectId: 'project456',
          durationDays: 7,
        })
      ).rejects.toThrow(FeaturedListingPermissionError);
      await expect(
        featuredListingService.purchaseFeaturedPlacement('user123', {
          projectId: 'project456',
          durationDays: 7,
        })
      ).rejects.toThrow('You can only feature your own projects');
    });

    it('should throw error if project is not active', async () => {
      const mockUser = createMockUser();
      const mockProject = createMockProject({ status: 'draft' });

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject as any);

      await expect(
        featuredListingService.purchaseFeaturedPlacement('user123', {
          projectId: 'project456',
          durationDays: 7,
        })
      ).rejects.toThrow(FeaturedListingValidationError);
      await expect(
        featuredListingService.purchaseFeaturedPlacement('user123', {
          projectId: 'project456',
          durationDays: 7,
        })
      ).rejects.toThrow('Only active projects can be featured');
    });

    it('should calculate correct cost for 14-day duration', async () => {
      const mockUser = createMockUser();
      const mockProject = createMockProject();
      const featuredUntil = new Date();
      featuredUntil.setDate(featuredUntil.getDate() + 14);
      const mockUpdatedProject = {
        ...mockProject,
        isFeatured: true,
        featuredUntil,
      };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject as any);
      vi.mocked(mockFeaturedListingRepository.setFeatured).mockResolvedValue(
        mockUpdatedProject as any
      );

      const result = await featuredListingService.purchaseFeaturedPlacement('user123', {
        projectId: 'project456',
        durationDays: 14,
      });

      expect(result.costCents).toBe(4999); // 14 days = $49.99
    });

    it('should calculate correct cost for 30-day duration', async () => {
      const mockUser = createMockUser();
      const mockProject = createMockProject();
      const featuredUntil = new Date();
      featuredUntil.setDate(featuredUntil.getDate() + 30);
      const mockUpdatedProject = {
        ...mockProject,
        isFeatured: true,
        featuredUntil,
      };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject as any);
      vi.mocked(mockFeaturedListingRepository.setFeatured).mockResolvedValue(
        mockUpdatedProject as any
      );

      const result = await featuredListingService.purchaseFeaturedPlacement('user123', {
        projectId: 'project456',
        durationDays: 30,
      });

      expect(result.costCents).toBe(7999); // 30 days = $79.99
    });

    it('should apply 20% discount for Pro subscribers', async () => {
      const mockUser = createMockUser();
      const mockProject = createMockProject();
      const featuredUntil = new Date();
      featuredUntil.setDate(featuredUntil.getDate() + 7);
      const mockUpdatedProject = {
        ...mockProject,
        isFeatured: true,
        featuredUntil,
      };

      // Mock Pro subscription with 20% discount
      vi.mocked(mockSubscriptionService.getSubscriptionStatus).mockResolvedValue({
        subscriptionId: 'sub_pro123',
        plan: 'pro',
        status: 'active',
        currentPeriodEnd: new Date('2026-03-01'),
        cancelAtPeriodEnd: false,
        benefits: {
          unlimitedListings: true,
          advancedAnalytics: true,
          featuredListingDiscount: 20,
          verificationBadge: true,
        },
      });

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject as any);
      vi.mocked(mockFeaturedListingRepository.setFeatured).mockResolvedValue(
        mockUpdatedProject as any
      );

      const result = await featuredListingService.purchaseFeaturedPlacement('user123', {
        projectId: 'project456',
        durationDays: 7,
      });

      // 7 days base cost: $29.99 (2999 cents)
      // 20% discount: 2999 * 0.8 = 2399.2 = 2399 cents (rounded)
      expect(result.costCents).toBe(2399);
    });

    it('should not apply discount for free plan users', async () => {
      const mockUser = createMockUser();
      const mockProject = createMockProject();
      const featuredUntil = new Date();
      featuredUntil.setDate(featuredUntil.getDate() + 7);
      const mockUpdatedProject = {
        ...mockProject,
        isFeatured: true,
        featuredUntil,
      };

      // Free plan already set in beforeEach
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject as any);
      vi.mocked(mockFeaturedListingRepository.setFeatured).mockResolvedValue(
        mockUpdatedProject as any
      );

      const result = await featuredListingService.purchaseFeaturedPlacement('user123', {
        projectId: 'project456',
        durationDays: 7,
      });

      // Full price for free tier: $29.99
      expect(result.costCents).toBe(2999);
    });
  });

  // ============================================
  // GET FEATURED PROJECTS TESTS
  // ============================================

  describe('getFeaturedProjects', () => {
    it('should return featured projects from repository', async () => {
      const mockProjects = [createMockFeaturedProject()];
      const mockResult = {
        projects: mockProjects,
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      };

      vi.mocked(mockFeaturedListingRepository.getFeaturedProjects).mockResolvedValue(
        mockResult as any
      );

      const result = await featuredListingService.getFeaturedProjects(1, 10);

      expect(result).toEqual(mockResult);
      expect(mockFeaturedListingRepository.getFeaturedProjects).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
      });
    });

    it('should use default pagination if not provided', async () => {
      const mockResult = {
        projects: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      };

      vi.mocked(mockFeaturedListingRepository.getFeaturedProjects).mockResolvedValue(
        mockResult as any
      );

      await featuredListingService.getFeaturedProjects();

      expect(mockFeaturedListingRepository.getFeaturedProjects).toHaveBeenCalledWith({
        page: undefined,
        limit: undefined,
      });
    });
  });

  // ============================================
  // IS FEATURED TESTS
  // ============================================

  describe('isFeatured', () => {
    it('should return true if project is featured', async () => {
      vi.mocked(mockFeaturedListingRepository.isFeatured).mockResolvedValue(true);

      const result = await featuredListingService.isFeatured('project456');

      expect(result).toBe(true);
      expect(mockFeaturedListingRepository.isFeatured).toHaveBeenCalledWith('project456');
    });

    it('should return false if project is not featured', async () => {
      vi.mocked(mockFeaturedListingRepository.isFeatured).mockResolvedValue(false);

      const result = await featuredListingService.isFeatured('project456');

      expect(result).toBe(false);
    });
  });

  // ============================================
  // REMOVE FEATURED STATUS TESTS
  // ============================================

  describe('removeFeaturedStatus', () => {
    it('should remove featured status successfully', async () => {
      const mockProject = createMockProject();

      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject as any);
      vi.mocked(mockFeaturedListingRepository.unsetFeatured).mockResolvedValue(
        mockProject as any
      );

      await featuredListingService.removeFeaturedStatus('user123', 'project456');

      expect(mockFeaturedListingRepository.unsetFeatured).toHaveBeenCalledWith('project456');
    });

    it('should throw error if project not found', async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      await expect(
        featuredListingService.removeFeaturedStatus('user123', 'project456')
      ).rejects.toThrow(FeaturedListingNotFoundError);
      await expect(
        featuredListingService.removeFeaturedStatus('user123', 'project456')
      ).rejects.toThrow('Project project456 not found');
    });

    it('should throw error if user does not own project', async () => {
      const mockProject = createMockProject({ sellerId: 'otheruser456' });

      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject as any);

      await expect(
        featuredListingService.removeFeaturedStatus('user123', 'project456')
      ).rejects.toThrow(FeaturedListingPermissionError);
      await expect(
        featuredListingService.removeFeaturedStatus('user123', 'project456')
      ).rejects.toThrow('You can only unfeature your own projects');
    });
  });

  // ============================================
  // GET SELLER FEATURED COUNT TESTS
  // ============================================

  describe('getSellerFeaturedCount', () => {
    it('should return count from repository', async () => {
      vi.mocked(mockFeaturedListingRepository.countFeaturedBySeller).mockResolvedValue(3);

      const result = await featuredListingService.getSellerFeaturedCount('seller123');

      expect(result).toBe(3);
      expect(mockFeaturedListingRepository.countFeaturedBySeller).toHaveBeenCalledWith(
        'seller123'
      );
    });

    it('should return 0 if seller has no featured projects', async () => {
      vi.mocked(mockFeaturedListingRepository.countFeaturedBySeller).mockResolvedValue(0);

      const result = await featuredListingService.getSellerFeaturedCount('seller456');

      expect(result).toBe(0);
    });
  });

  // ============================================
  // EXTEND FEATURED PERIOD TESTS
  // ============================================

  describe('extendFeaturedPeriod', () => {
    it('should extend featured period successfully', async () => {
      const mockProject = createMockProject();
      const newFeaturedUntil = new Date('2026-02-22T10:00:00Z');
      const mockUpdatedProject = {
        ...mockProject,
        featuredUntil: newFeaturedUntil,
      };

      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject as any);
      vi.mocked(mockFeaturedListingRepository.extendFeaturedPeriod).mockResolvedValue(
        mockUpdatedProject as any
      );

      const result = await featuredListingService.extendFeaturedPeriod(
        'user123',
        'project456',
        7
      );

      expect(result.featuredUntil).toBe(newFeaturedUntil.toISOString());
      expect(mockFeaturedListingRepository.extendFeaturedPeriod).toHaveBeenCalledWith(
        'project456',
        7
      );
    });

    it('should throw error if duration is invalid', async () => {
      await expect(
        featuredListingService.extendFeaturedPeriod('user123', 'project456', 5)
      ).rejects.toThrow(FeaturedListingValidationError);
      await expect(
        featuredListingService.extendFeaturedPeriod('user123', 'project456', 5)
      ).rejects.toThrow('Invalid duration. Must be one of: 7, 14, 30 days');
    });

    it('should throw error if project not found', async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      await expect(
        featuredListingService.extendFeaturedPeriod('user123', 'project456', 7)
      ).rejects.toThrow(FeaturedListingNotFoundError);
      await expect(
        featuredListingService.extendFeaturedPeriod('user123', 'project456', 7)
      ).rejects.toThrow('Project project456 not found');
    });

    it('should throw error if user does not own project', async () => {
      const mockProject = createMockProject({ sellerId: 'otheruser456' });

      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject as any);

      await expect(
        featuredListingService.extendFeaturedPeriod('user123', 'project456', 7)
      ).rejects.toThrow(FeaturedListingPermissionError);
      await expect(
        featuredListingService.extendFeaturedPeriod('user123', 'project456', 7)
      ).rejects.toThrow('You can only extend featured period for your own projects');
    });
  });

  // ============================================
  // GET FEATURED PRICING TESTS
  // ============================================

  describe('getFeaturedPricing', () => {
    it('should return pricing tiers', () => {
      const pricing = featuredListingService.getFeaturedPricing();

      expect(pricing).toHaveLength(3);
      expect(pricing[0]).toEqual({
        durationDays: 7,
        costCents: 2999,
        costFormatted: expect.stringMatching(/29\.99/),
      });
      expect(pricing[1]).toEqual({
        durationDays: 14,
        costCents: 4999,
        costFormatted: expect.stringMatching(/49\.99/),
      });
      expect(pricing[2]).toEqual({
        durationDays: 30,
        costCents: 7999,
        costFormatted: expect.stringMatching(/79\.99/),
      });
    });
  });

  // ============================================
  // CLEANUP EXPIRED FEATURED TESTS
  // ============================================

  describe('cleanupExpiredFeatured', () => {
    it('should return count of cleaned up projects', async () => {
      vi.mocked(mockFeaturedListingRepository.cleanupExpiredFeatured).mockResolvedValue(5);

      const result = await featuredListingService.cleanupExpiredFeatured();

      expect(result).toBe(5);
      expect(mockFeaturedListingRepository.cleanupExpiredFeatured).toHaveBeenCalled();
    });

    it('should return 0 if no expired projects', async () => {
      vi.mocked(mockFeaturedListingRepository.cleanupExpiredFeatured).mockResolvedValue(0);

      const result = await featuredListingService.cleanupExpiredFeatured();

      expect(result).toBe(0);
    });
  });
});
