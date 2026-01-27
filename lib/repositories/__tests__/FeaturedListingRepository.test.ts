/**
 * FeaturedListingRepository Unit Tests
 *
 * Tests all CRUD operations and query methods for featured listings.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeaturedListingRepository } from '../FeaturedListingRepository';
import type { PrismaClient } from '@prisma/client';

// Mock Prisma Client
const mockPrismaClient = {
  project: {
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
  },
} as unknown as PrismaClient;

// Mock data helpers
const createMockProject = (overrides = {}) => ({
  id: 'project123',
  title: 'Test Project',
  description: 'A test project',
  thumbnailImageUrl: 'https://example.com/thumb.jpg',
  priceCents: 50000,
  completionPercentage: 80,
  status: 'active',
  isFeatured: false,
  featuredUntil: null,
  sellerId: 'seller123',
  createdAt: new Date('2026-01-15T10:00:00Z'),
  updatedAt: new Date('2026-01-15T10:00:00Z'),
  ...overrides,
});

const createMockFeaturedProject = (overrides = {}) => ({
  ...createMockProject(overrides),
  isFeatured: true,
  featuredUntil: new Date('2026-02-15T10:00:00Z'),
  seller: {
    id: 'seller123',
    username: 'seller',
    fullName: 'Seller Name',
    avatarUrl: 'https://avatar.com/seller.jpg',
    isSeller: true,
  },
});

describe('FeaturedListingRepository', () => {
  let featuredListingRepository: FeaturedListingRepository;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create fresh instance
    featuredListingRepository = new FeaturedListingRepository(mockPrismaClient);
  });

  // ============================================
  // SET FEATURED TESTS
  // ============================================

  describe('setFeatured', () => {
    it('should set project as featured', async () => {
      const featuredUntil = new Date('2026-02-15T10:00:00Z');
      const mockProject = createMockProject({
        isFeatured: true,
        featuredUntil,
      });

      vi.mocked(mockPrismaClient.project.update).mockResolvedValue(mockProject);

      const result = await featuredListingRepository.setFeatured(
        'project123',
        featuredUntil
      );

      expect(result).toEqual(mockProject);
      expect(mockPrismaClient.project.update).toHaveBeenCalledWith({
        where: { id: 'project123' },
        data: {
          isFeatured: true,
          featuredUntil,
        },
      });
    });

    it('should throw error when project not found', async () => {
      vi.mocked(mockPrismaClient.project.update).mockRejectedValue(
        new Error('Record not found')
      );

      await expect(
        featuredListingRepository.setFeatured('project999', new Date())
      ).rejects.toThrow('[FeaturedListingRepository] Failed to set featured status');
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.project.update).mockRejectedValue(new Error('DB Error'));

      await expect(
        featuredListingRepository.setFeatured('project123', new Date())
      ).rejects.toThrow('[FeaturedListingRepository] Failed to set featured status');
    });
  });

  // ============================================
  // UNSET FEATURED TESTS
  // ============================================

  describe('unsetFeatured', () => {
    it('should unset featured status', async () => {
      const mockProject = createMockProject({
        isFeatured: false,
        featuredUntil: null,
      });

      vi.mocked(mockPrismaClient.project.update).mockResolvedValue(mockProject);

      const result = await featuredListingRepository.unsetFeatured('project123');

      expect(result).toEqual(mockProject);
      expect(mockPrismaClient.project.update).toHaveBeenCalledWith({
        where: { id: 'project123' },
        data: {
          isFeatured: false,
          featuredUntil: null,
        },
      });
    });

    it('should throw error when project not found', async () => {
      vi.mocked(mockPrismaClient.project.update).mockRejectedValue(
        new Error('Record not found')
      );

      await expect(featuredListingRepository.unsetFeatured('project999')).rejects.toThrow(
        '[FeaturedListingRepository] Failed to unset featured status'
      );
    });
  });

  // ============================================
  // GET FEATURED PROJECTS TESTS
  // ============================================

  describe('getFeaturedProjects', () => {
    it('should return paginated featured projects', async () => {
      const mockProjects = [
        createMockFeaturedProject({ id: 'project1' }),
        createMockFeaturedProject({ id: 'project2' }),
      ];

      vi.mocked(mockPrismaClient.project.findMany).mockResolvedValue(mockProjects);
      vi.mocked(mockPrismaClient.project.count).mockResolvedValue(2);

      const result = await featuredListingRepository.getFeaturedProjects({
        page: 1,
        limit: 10,
      });

      expect(result.projects).toEqual(mockProjects);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(false);

      // Verify query includes correct where clause
      expect(mockPrismaClient.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isFeatured: true,
            featuredUntil: expect.objectContaining({ gt: expect.any(Date) }),
            status: 'active',
          },
        })
      );
    });

    it('should use default pagination values', async () => {
      vi.mocked(mockPrismaClient.project.findMany).mockResolvedValue([]);
      vi.mocked(mockPrismaClient.project.count).mockResolvedValue(0);

      const result = await featuredListingRepository.getFeaturedProjects();

      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should calculate hasNext and hasPrev correctly', async () => {
      vi.mocked(mockPrismaClient.project.findMany).mockResolvedValue([]);
      vi.mocked(mockPrismaClient.project.count).mockResolvedValue(25);

      const result = await featuredListingRepository.getFeaturedProjects({
        page: 2,
        limit: 10,
      });

      expect(result.hasNext).toBe(true); // 25 total, page 2 of 3
      expect(result.hasPrev).toBe(true); // page 2 has previous page
    });

    it('should handle empty results', async () => {
      vi.mocked(mockPrismaClient.project.findMany).mockResolvedValue([]);
      vi.mocked(mockPrismaClient.project.count).mockResolvedValue(0);

      const result = await featuredListingRepository.getFeaturedProjects();

      expect(result.projects).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.project.findMany).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(featuredListingRepository.getFeaturedProjects()).rejects.toThrow(
        '[FeaturedListingRepository] Failed to get featured projects'
      );
    });
  });

  // ============================================
  // IS FEATURED TESTS
  // ============================================

  describe('isFeatured', () => {
    it('should return true when project is featured and not expired', async () => {
      const mockProject = createMockProject({
        isFeatured: true,
        featuredUntil: new Date('2026-12-31T23:59:59Z'), // Future date
      });

      vi.mocked(mockPrismaClient.project.findUnique).mockResolvedValue(mockProject);

      const result = await featuredListingRepository.isFeatured('project123');

      expect(result).toBe(true);
      expect(mockPrismaClient.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'project123' },
        select: {
          isFeatured: true,
          featuredUntil: true,
        },
      });
    });

    it('should return false when project is not featured', async () => {
      const mockProject = createMockProject({
        isFeatured: false,
        featuredUntil: null,
      });

      vi.mocked(mockPrismaClient.project.findUnique).mockResolvedValue(mockProject);

      const result = await featuredListingRepository.isFeatured('project123');

      expect(result).toBe(false);
    });

    it('should return false when project is featured but expired', async () => {
      const mockProject = createMockProject({
        isFeatured: true,
        featuredUntil: new Date('2020-01-01T00:00:00Z'), // Past date
      });

      vi.mocked(mockPrismaClient.project.findUnique).mockResolvedValue(mockProject);

      const result = await featuredListingRepository.isFeatured('project123');

      expect(result).toBe(false);
    });

    it('should return false when project not found', async () => {
      vi.mocked(mockPrismaClient.project.findUnique).mockResolvedValue(null);

      const result = await featuredListingRepository.isFeatured('project999');

      expect(result).toBe(false);
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.project.findUnique).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(featuredListingRepository.isFeatured('project123')).rejects.toThrow(
        '[FeaturedListingRepository] Failed to check featured status'
      );
    });
  });

  // ============================================
  // COUNT FEATURED BY SELLER TESTS
  // ============================================

  describe('countFeaturedBySeller', () => {
    it('should return count of featured projects for seller', async () => {
      vi.mocked(mockPrismaClient.project.count).mockResolvedValue(3);

      const result = await featuredListingRepository.countFeaturedBySeller('seller123');

      expect(result).toBe(3);
      expect(mockPrismaClient.project.count).toHaveBeenCalledWith({
        where: {
          sellerId: 'seller123',
          isFeatured: true,
          featuredUntil: expect.objectContaining({ gt: expect.any(Date) }),
          status: 'active',
        },
      });
    });

    it('should return 0 when seller has no featured projects', async () => {
      vi.mocked(mockPrismaClient.project.count).mockResolvedValue(0);

      const result = await featuredListingRepository.countFeaturedBySeller('seller456');

      expect(result).toBe(0);
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.project.count).mockRejectedValue(new Error('DB Error'));

      await expect(
        featuredListingRepository.countFeaturedBySeller('seller123')
      ).rejects.toThrow('[FeaturedListingRepository] Failed to count featured projects');
    });
  });

  // ============================================
  // EXTEND FEATURED PERIOD TESTS
  // ============================================

  describe('extendFeaturedPeriod', () => {
    it('should extend featured period by adding days', async () => {
      const currentFeaturedUntil = new Date('2026-02-15T10:00:00Z');
      const mockProject = createMockProject({
        isFeatured: true,
        featuredUntil: currentFeaturedUntil,
      });

      // Mock findUnique to return current project
      vi.mocked(mockPrismaClient.project.findUnique).mockResolvedValue(mockProject);

      // Mock update to return extended project
      const extendedFeaturedUntil = new Date(currentFeaturedUntil);
      extendedFeaturedUntil.setDate(extendedFeaturedUntil.getDate() + 7);
      vi.mocked(mockPrismaClient.project.update).mockResolvedValue({
        ...mockProject,
        featuredUntil: extendedFeaturedUntil,
      });

      const result = await featuredListingRepository.extendFeaturedPeriod(
        'project123',
        7
      );

      expect(result.featuredUntil).toEqual(extendedFeaturedUntil);
      expect(mockPrismaClient.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'project123' },
        select: { featuredUntil: true },
      });
    });

    it('should throw error when project not found', async () => {
      vi.mocked(mockPrismaClient.project.findUnique).mockResolvedValue(null);

      await expect(
        featuredListingRepository.extendFeaturedPeriod('project999', 7)
      ).rejects.toThrow('[FeaturedListingRepository] Failed to extend featured period');
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.project.findUnique).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(
        featuredListingRepository.extendFeaturedPeriod('project123', 7)
      ).rejects.toThrow('[FeaturedListingRepository] Failed to extend featured period');
    });
  });

  // ============================================
  // CLEANUP EXPIRED FEATURED TESTS
  // ============================================

  describe('cleanupExpiredFeatured', () => {
    it('should cleanup expired featured projects', async () => {
      vi.mocked(mockPrismaClient.project.updateMany).mockResolvedValue({
        count: 5,
      });

      const result = await featuredListingRepository.cleanupExpiredFeatured();

      expect(result).toBe(5);
      expect(mockPrismaClient.project.updateMany).toHaveBeenCalledWith({
        where: {
          isFeatured: true,
          featuredUntil: expect.objectContaining({ lte: expect.any(Date) }),
        },
        data: {
          isFeatured: false,
        },
      });
    });

    it('should return 0 when no expired projects', async () => {
      vi.mocked(mockPrismaClient.project.updateMany).mockResolvedValue({
        count: 0,
      });

      const result = await featuredListingRepository.cleanupExpiredFeatured();

      expect(result).toBe(0);
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.project.updateMany).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(featuredListingRepository.cleanupExpiredFeatured()).rejects.toThrow(
        '[FeaturedListingRepository] Failed to cleanup expired featured projects'
      );
    });
  });
});
