/**
 * FeaturedListingService Integration Tests
 *
 * Tests featured listing business logic with real database operations.
 *
 * Prerequisites:
 * - Test database must be running: `npm run test:db:setup`
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
} from '@/tests/helpers/db';
import { createTestUser, createTestProject } from '@/tests/helpers/fixtures';
import {
  FeaturedListingService,
  FeaturedListingValidationError,
  FeaturedListingPermissionError,
  FeaturedListingNotFoundError,
} from '@/lib/services/FeaturedListingService';
import { FeaturedListingRepository } from '@/lib/repositories/FeaturedListingRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { SubscriptionRepository } from '@/lib/repositories/SubscriptionRepository';
import { SubscriptionService } from '@/lib/services/SubscriptionService';
import { prisma } from '@/lib/prisma';

describe('FeaturedListingService (Integration)', () => {
  let featuredListingService: FeaturedListingService;
  let featuredListingRepository: FeaturedListingRepository;
  let projectRepository: ProjectRepository;
  let userRepository: UserRepository;
  let subscriptionRepository: SubscriptionRepository;
  let subscriptionService: SubscriptionService;

  beforeAll(async () => {
    await setupTestDatabase();
    featuredListingRepository = new FeaturedListingRepository(prisma);
    projectRepository = new ProjectRepository(prisma);
    userRepository = new UserRepository(prisma);
    subscriptionRepository = new SubscriptionRepository(prisma);
    subscriptionService = new SubscriptionService(subscriptionRepository, userRepository);
    featuredListingService = new FeaturedListingService(
      featuredListingRepository,
      projectRepository,
      userRepository,
      subscriptionService
    );
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  // ============================================
  // PURCHASE FEATURED PLACEMENT TESTS
  // ============================================

  describe('purchaseFeaturedPlacement', () => {
    it('should purchase featured placement successfully', async () => {
      // Create seller with active project
      const seller = await createTestUser({
        username: 'featured-seller',
        isSeller: true,
      });
      const project = await createTestProject({
        sellerId: seller.id,
        title: 'Test Project',
        status: 'active',
      });

      // Purchase 7-day featured placement
      const result = await featuredListingService.purchaseFeaturedPlacement(seller.id, {
        projectId: project.id,
        durationDays: 7,
      });

      // Verify result
      expect(result.projectId).toBe(project.id);
      expect(result.durationDays).toBe(7);
      expect(result.costCents).toBe(2999); // $29.99
      expect(result.featuredUntil).toBeDefined();
      expect(result.message).toContain('featured successfully');

      // Verify project is featured in database
      const updatedProject = await prisma.project.findUnique({
        where: { id: project.id },
      });
      expect(updatedProject?.isFeatured).toBe(true);
      expect(updatedProject?.featuredUntil).toBeDefined();

      // Verify expiration date is approximately 7 days from now
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 7);
      const actualDate = new Date(result.featuredUntil);
      const diffMs = Math.abs(actualDate.getTime() - expectedDate.getTime());
      expect(diffMs).toBeLessThan(5000); // Within 5 seconds
    });

    it('should calculate correct cost for 14-day placement', async () => {
      const seller = await createTestUser({
        username: 'seller-14',
        isSeller: true,
      });
      const project = await createTestProject({
        sellerId: seller.id,
        status: 'active',
      });

      const result = await featuredListingService.purchaseFeaturedPlacement(seller.id, {
        projectId: project.id,
        durationDays: 14,
      });

      expect(result.costCents).toBe(4999); // $49.99
      expect(result.durationDays).toBe(14);
    });

    it('should calculate correct cost for 30-day placement', async () => {
      const seller = await createTestUser({
        username: 'seller-30',
        isSeller: true,
      });
      const project = await createTestProject({
        sellerId: seller.id,
        status: 'active',
      });

      const result = await featuredListingService.purchaseFeaturedPlacement(seller.id, {
        projectId: project.id,
        durationDays: 30,
      });

      expect(result.costCents).toBe(7999); // $79.99
      expect(result.durationDays).toBe(30);
    });

    it('should throw error if user is not a seller', async () => {
      const user = await createTestUser({
        username: 'non-seller',
        isSeller: false,
      });
      const project = await createTestProject({
        sellerId: user.id,
        status: 'active',
      });

      await expect(
        featuredListingService.purchaseFeaturedPlacement(user.id, {
          projectId: project.id,
          durationDays: 7,
        })
      ).rejects.toThrow(FeaturedListingPermissionError);
      await expect(
        featuredListingService.purchaseFeaturedPlacement(user.id, {
          projectId: project.id,
          durationDays: 7,
        })
      ).rejects.toThrow('Only sellers can purchase featured placement');
    });

    it('should throw error if duration is invalid', async () => {
      const seller = await createTestUser({
        username: 'seller-invalid',
        isSeller: true,
      });
      const project = await createTestProject({
        sellerId: seller.id,
        status: 'active',
      });

      await expect(
        featuredListingService.purchaseFeaturedPlacement(seller.id, {
          projectId: project.id,
          durationDays: 5, // Invalid
        })
      ).rejects.toThrow(FeaturedListingValidationError);
      await expect(
        featuredListingService.purchaseFeaturedPlacement(seller.id, {
          projectId: project.id,
          durationDays: 100, // Invalid
        })
      ).rejects.toThrow(FeaturedListingValidationError);
    });

    it('should throw error if project not found', async () => {
      const seller = await createTestUser({
        username: 'seller-no-project',
        isSeller: true,
      });

      await expect(
        featuredListingService.purchaseFeaturedPlacement(seller.id, {
          projectId: 'nonexistent',
          durationDays: 7,
        })
      ).rejects.toThrow(FeaturedListingNotFoundError);
    });

    it('should throw error if user does not own project', async () => {
      const seller1 = await createTestUser({
        username: 'seller1',
        isSeller: true,
      });
      const seller2 = await createTestUser({
        username: 'seller2',
        isSeller: true,
      });
      const project = await createTestProject({
        sellerId: seller1.id,
        status: 'active',
      });

      await expect(
        featuredListingService.purchaseFeaturedPlacement(seller2.id, {
          projectId: project.id,
          durationDays: 7,
        })
      ).rejects.toThrow(FeaturedListingPermissionError);
      await expect(
        featuredListingService.purchaseFeaturedPlacement(seller2.id, {
          projectId: project.id,
          durationDays: 7,
        })
      ).rejects.toThrow('You can only feature your own projects');
    });

    it('should throw error if project is not active', async () => {
      const seller = await createTestUser({
        username: 'seller-draft',
        isSeller: true,
      });
      const project = await createTestProject({
        sellerId: seller.id,
        status: 'draft',
      });

      await expect(
        featuredListingService.purchaseFeaturedPlacement(seller.id, {
          projectId: project.id,
          durationDays: 7,
        })
      ).rejects.toThrow(FeaturedListingValidationError);
      await expect(
        featuredListingService.purchaseFeaturedPlacement(seller.id, {
          projectId: project.id,
          durationDays: 7,
        })
      ).rejects.toThrow('Only active projects can be featured');
    });
  });

  // ============================================
  // GET FEATURED PROJECTS TESTS
  // ============================================

  describe('getFeaturedProjects', () => {
    it('should return featured projects that are not expired', async () => {
      const seller = await createTestUser({
        username: 'featured-seller',
        isSeller: true,
      });

      // Create featured project (not expired)
      const project1 = await createTestProject({
        sellerId: seller.id,
        title: 'Featured Project 1',
        status: 'active',
      });
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      await prisma.project.update({
        where: { id: project1.id },
        data: { isFeatured: true, featuredUntil: futureDate },
      });

      // Create expired featured project (should not appear)
      const project2 = await createTestProject({
        sellerId: seller.id,
        title: 'Expired Featured Project',
        status: 'active',
      });
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      await prisma.project.update({
        where: { id: project2.id },
        data: { isFeatured: true, featuredUntil: pastDate },
      });

      // Create non-featured project (should not appear)
      await createTestProject({
        sellerId: seller.id,
        title: 'Non-Featured Project',
        status: 'active',
      });

      const result = await featuredListingService.getFeaturedProjects(1, 10);

      expect(result.total).toBe(1);
      expect(result.projects).toHaveLength(1);
      expect(result.projects[0]!.id).toBe(project1.id);
      expect(result.projects[0]!.seller).toBeDefined();
      expect(result.projects[0]!.seller.username).toBe('featured-seller');
    });

    it('should handle pagination correctly', async () => {
      const seller = await createTestUser({
        username: 'paginated-seller',
        isSeller: true,
      });

      // Create 5 featured projects
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      for (let i = 0; i < 5; i++) {
        const project = await createTestProject({
          sellerId: seller.id,
          title: `Featured Project ${i + 1}`,
          status: 'active',
        });
        await prisma.project.update({
          where: { id: project.id },
          data: { isFeatured: true, featuredUntil: futureDate },
        });
      }

      // Get page 1 (limit 2)
      const page1 = await featuredListingService.getFeaturedProjects(1, 2);
      expect(page1.total).toBe(5);
      expect(page1.projects).toHaveLength(2);
      expect(page1.page).toBe(1);
      expect(page1.totalPages).toBe(3);
      expect(page1.hasNext).toBe(true);
      expect(page1.hasPrev).toBe(false);

      // Get page 2 (limit 2)
      const page2 = await featuredListingService.getFeaturedProjects(2, 2);
      expect(page2.projects).toHaveLength(2);
      expect(page2.hasNext).toBe(true);
      expect(page2.hasPrev).toBe(true);

      // Get page 3 (limit 2)
      const page3 = await featuredListingService.getFeaturedProjects(3, 2);
      expect(page3.projects).toHaveLength(1); // Last page has only 1
      expect(page3.hasNext).toBe(false);
      expect(page3.hasPrev).toBe(true);
    });

    it('should return empty list when no featured projects', async () => {
      const result = await featuredListingService.getFeaturedProjects(1, 10);

      expect(result.total).toBe(0);
      expect(result.projects).toHaveLength(0);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(false);
    });
  });

  // ============================================
  // IS FEATURED TESTS
  // ============================================

  describe('isFeatured', () => {
    it('should return true for featured non-expired project', async () => {
      const seller = await createTestUser({
        username: 'is-featured-seller',
        isSeller: true,
      });
      const project = await createTestProject({
        sellerId: seller.id,
        status: 'active',
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      await prisma.project.update({
        where: { id: project.id },
        data: { isFeatured: true, featuredUntil: futureDate },
      });

      const result = await featuredListingService.isFeatured(project.id);

      expect(result).toBe(true);
    });

    it('should return false for expired featured project', async () => {
      const seller = await createTestUser({
        username: 'expired-seller',
        isSeller: true,
      });
      const project = await createTestProject({
        sellerId: seller.id,
        status: 'active',
      });

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      await prisma.project.update({
        where: { id: project.id },
        data: { isFeatured: true, featuredUntil: pastDate },
      });

      const result = await featuredListingService.isFeatured(project.id);

      expect(result).toBe(false);
    });

    it('should return false for non-featured project', async () => {
      const seller = await createTestUser({
        username: 'non-featured-seller',
        isSeller: true,
      });
      const project = await createTestProject({
        sellerId: seller.id,
        status: 'active',
      });

      const result = await featuredListingService.isFeatured(project.id);

      expect(result).toBe(false);
    });
  });

  // ============================================
  // REMOVE FEATURED STATUS TESTS
  // ============================================

  describe('removeFeaturedStatus', () => {
    it('should remove featured status successfully', async () => {
      const seller = await createTestUser({
        username: 'remove-seller',
        isSeller: true,
      });
      const project = await createTestProject({
        sellerId: seller.id,
        status: 'active',
      });

      // Set as featured first
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      await prisma.project.update({
        where: { id: project.id },
        data: { isFeatured: true, featuredUntil: futureDate },
      });

      // Remove featured status
      await featuredListingService.removeFeaturedStatus(seller.id, project.id);

      // Verify it's no longer featured
      const updatedProject = await prisma.project.findUnique({
        where: { id: project.id },
      });
      expect(updatedProject?.isFeatured).toBe(false);
      expect(updatedProject?.featuredUntil).toBeNull();
    });

    it('should throw error if user does not own project', async () => {
      const seller1 = await createTestUser({
        username: 'seller1-remove',
        isSeller: true,
      });
      const seller2 = await createTestUser({
        username: 'seller2-remove',
        isSeller: true,
      });
      const project = await createTestProject({
        sellerId: seller1.id,
        status: 'active',
      });

      await expect(
        featuredListingService.removeFeaturedStatus(seller2.id, project.id)
      ).rejects.toThrow(FeaturedListingPermissionError);
    });
  });

  // ============================================
  // EXTEND FEATURED PERIOD TESTS
  // ============================================

  describe('extendFeaturedPeriod', () => {
    it('should extend featured period successfully', async () => {
      const seller = await createTestUser({
        username: 'extend-seller',
        isSeller: true,
      });
      const project = await createTestProject({
        sellerId: seller.id,
        status: 'active',
      });

      // Set initial featured period (7 days from now)
      const initialDate = new Date();
      initialDate.setDate(initialDate.getDate() + 7);
      await prisma.project.update({
        where: { id: project.id },
        data: { isFeatured: true, featuredUntil: initialDate },
      });

      // Extend by 7 more days
      const result = await featuredListingService.extendFeaturedPeriod(
        seller.id,
        project.id,
        7
      );

      // Verify extension (should be 14 days from now)
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + 14);
      const actualDate = new Date(result.featuredUntil);
      const diffMs = Math.abs(actualDate.getTime() - expectedDate.getTime());
      expect(diffMs).toBeLessThan(5000); // Within 5 seconds
    });

    it('should throw error if duration is invalid', async () => {
      const seller = await createTestUser({
        username: 'extend-invalid-seller',
        isSeller: true,
      });
      const project = await createTestProject({
        sellerId: seller.id,
        status: 'active',
      });

      await expect(
        featuredListingService.extendFeaturedPeriod(seller.id, project.id, 5)
      ).rejects.toThrow(FeaturedListingValidationError);
    });
  });

  // ============================================
  // GET SELLER FEATURED COUNT TESTS
  // ============================================

  describe('getSellerFeaturedCount', () => {
    it('should return correct count of featured projects', async () => {
      const seller = await createTestUser({
        username: 'count-seller',
        isSeller: true,
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      // Create 3 featured projects
      for (let i = 0; i < 3; i++) {
        const project = await createTestProject({
          sellerId: seller.id,
          status: 'active',
        });
        await prisma.project.update({
          where: { id: project.id },
          data: { isFeatured: true, featuredUntil: futureDate },
        });
      }

      // Create 1 expired featured project (should not be counted)
      const expiredProject = await createTestProject({
        sellerId: seller.id,
        status: 'active',
      });
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      await prisma.project.update({
        where: { id: expiredProject.id },
        data: { isFeatured: true, featuredUntil: pastDate },
      });

      const count = await featuredListingService.getSellerFeaturedCount(seller.id);

      expect(count).toBe(3);
    });

    it('should return 0 when seller has no featured projects', async () => {
      const seller = await createTestUser({
        username: 'no-featured-seller',
        isSeller: true,
      });

      const count = await featuredListingService.getSellerFeaturedCount(seller.id);

      expect(count).toBe(0);
    });
  });

  // ============================================
  // CLEANUP EXPIRED FEATURED TESTS
  // ============================================

  describe('cleanupExpiredFeatured', () => {
    it('should cleanup expired featured projects', async () => {
      const seller = await createTestUser({
        username: 'cleanup-seller',
        isSeller: true,
      });

      // Create 2 expired featured projects
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      for (let i = 0; i < 2; i++) {
        const project = await createTestProject({
          sellerId: seller.id,
          status: 'active',
        });
        await prisma.project.update({
          where: { id: project.id },
          data: { isFeatured: true, featuredUntil: pastDate },
        });
      }

      // Create 1 non-expired featured project (should not be affected)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const activeProject = await createTestProject({
        sellerId: seller.id,
        status: 'active',
      });
      await prisma.project.update({
        where: { id: activeProject.id },
        data: { isFeatured: true, featuredUntil: futureDate },
      });

      // Run cleanup
      const count = await featuredListingService.cleanupExpiredFeatured();

      expect(count).toBe(2);

      // Verify active project still featured
      const stillFeatured = await prisma.project.findUnique({
        where: { id: activeProject.id },
      });
      expect(stillFeatured?.isFeatured).toBe(true);
    });

    it('should return 0 when no expired projects', async () => {
      const count = await featuredListingService.cleanupExpiredFeatured();

      expect(count).toBe(0);
    });
  });

  // ============================================
  // GET FEATURED PRICING TESTS
  // ============================================

  describe('getFeaturedPricing', () => {
    it('should return all pricing tiers', () => {
      const pricing = featuredListingService.getFeaturedPricing();

      expect(pricing).toHaveLength(3);
      expect(pricing[0]!.durationDays).toBe(7);
      expect(pricing[0]!.costCents).toBe(2999);
      expect(pricing[1]!.durationDays).toBe(14);
      expect(pricing[1]!.costCents).toBe(4999);
      expect(pricing[2]!.durationDays).toBe(30);
      expect(pricing[2]!.costCents).toBe(7999);
    });
  });
});
