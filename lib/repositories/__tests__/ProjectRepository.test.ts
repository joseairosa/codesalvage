/**
 * ProjectRepository Unit Tests
 *
 * Tests CRUD operations, search functionality, and data access logic
 * for project management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectRepository } from '../ProjectRepository';
import type { PrismaClient } from '@prisma/client';

// Mock Prisma Client
const mockPrismaClient = {
  project: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  $transaction: vi.fn(),
} as unknown as PrismaClient;

describe('ProjectRepository', () => {
  let projectRepository: ProjectRepository;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create fresh instance
    projectRepository = new ProjectRepository(mockPrismaClient);
  });

  // ============================================
  // CREATE TESTS
  // ============================================

  describe('create', () => {
    it('should create a new project', async () => {
      const projectData = {
        sellerId: 'seller123',
        title: 'Test Project',
        description: 'A test project description that is long enough',
        category: 'web_app' as const,
        completionPercentage: 75,
        priceCents: 50000,
        techStack: ['React', 'TypeScript'],
        licenseType: 'full_code' as const,
        accessLevel: 'full' as const,
        status: 'draft' as const,
      };

      const mockCreatedProject = {
        id: 'project123',
        ...projectData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockPrismaClient.project.create).mockResolvedValue(
        mockCreatedProject as any
      );

      const result = await projectRepository.create(projectData);

      expect(result).toEqual(mockCreatedProject);

      const { sellerId: _sellerId, ...projectDataWithoutSellerId } = projectData;
      expect(mockPrismaClient.project.create).toHaveBeenCalledWith({
        data: {
          ...projectDataWithoutSellerId,
          seller: {
            connect: { id: 'seller123' },
          },
        },
      });
    });
  });

  // ============================================
  // FIND BY ID TESTS
  // ============================================

  describe('findById', () => {
    it('should find project by id', async () => {
      const mockProject = {
        id: 'project123',
        title: 'Test Project',
        sellerId: 'seller123',
      };

      vi.mocked(mockPrismaClient.project.findUnique).mockResolvedValue(
        mockProject as any
      );

      const result = await projectRepository.findById('project123');

      expect(result).toEqual(mockProject);
      expect(mockPrismaClient.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'project123' },
        include: { seller: false },
      });
    });

    it('should include seller when requested', async () => {
      const mockProject = {
        id: 'project123',
        title: 'Test Project',
        seller: {
          id: 'seller123',
          username: 'testseller',
        },
      };

      vi.mocked(mockPrismaClient.project.findUnique).mockResolvedValue(
        mockProject as any
      );

      const result = await projectRepository.findById('project123', true);

      expect(result).toEqual(mockProject);
      expect(mockPrismaClient.project.findUnique).toHaveBeenCalledWith({
        where: { id: 'project123' },
        include: { seller: true },
      });
    });

    it('should return null when project not found', async () => {
      vi.mocked(mockPrismaClient.project.findUnique).mockResolvedValue(null);

      const result = await projectRepository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // UPDATE TESTS
  // ============================================

  describe('update', () => {
    it('should update project', async () => {
      const updateData = {
        title: 'Updated Title',
        completionPercentage: 80,
      };

      const mockUpdatedProject = {
        id: 'project123',
        ...updateData,
        updatedAt: new Date(),
      };

      vi.mocked(mockPrismaClient.project.update).mockResolvedValue(
        mockUpdatedProject as any
      );

      const result = await projectRepository.update('project123', updateData);

      expect(result).toEqual(mockUpdatedProject);
      expect(mockPrismaClient.project.update).toHaveBeenCalledWith({
        where: { id: 'project123' },
        data: updateData,
      });
    });
  });

  // ============================================
  // DELETE TESTS
  // ============================================

  describe('delete', () => {
    it('should delete project', async () => {
      const mockDeletedProject = {
        id: 'project123',
        title: 'Deleted Project',
      };

      vi.mocked(mockPrismaClient.project.delete).mockResolvedValue(
        mockDeletedProject as any
      );

      const result = await projectRepository.delete('project123');

      expect(result).toEqual(mockDeletedProject);
      expect(mockPrismaClient.project.delete).toHaveBeenCalledWith({
        where: { id: 'project123' },
      });
    });
  });

  // ============================================
  // SEARCH TESTS
  // ============================================

  describe('search', () => {
    it('should search projects with default pagination', async () => {
      const mockProjects = [
        { id: 'project1', title: 'Project 1' },
        { id: 'project2', title: 'Project 2' },
      ];

      vi.mocked(mockPrismaClient.$transaction).mockResolvedValue([
        mockProjects,
        2,
      ] as any);

      const result = await projectRepository.search();

      expect(result.projects).toEqual(mockProjects);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(false);
    });

    it('should filter by text search query', async () => {
      vi.mocked(mockPrismaClient.$transaction).mockResolvedValue([[], 0] as any);

      await projectRepository.search({ query: 'react app' });

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });

    it('should filter by category', async () => {
      vi.mocked(mockPrismaClient.$transaction).mockResolvedValue([[], 0] as any);

      await projectRepository.search({ category: 'web_app' });

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });

    it('should filter by tech stack', async () => {
      vi.mocked(mockPrismaClient.$transaction).mockResolvedValue([[], 0] as any);

      await projectRepository.search({ techStack: ['React', 'TypeScript'] });

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });

    it('should filter by completion percentage range', async () => {
      vi.mocked(mockPrismaClient.$transaction).mockResolvedValue([[], 0] as any);

      await projectRepository.search({
        minCompletion: 70,
        maxCompletion: 90,
      });

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });

    it('should filter by price range', async () => {
      vi.mocked(mockPrismaClient.$transaction).mockResolvedValue([[], 0] as any);

      await projectRepository.search({
        minPrice: 10000,
        maxPrice: 100000,
      });

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });

    it('should handle pagination correctly', async () => {
      const mockProjects = Array(5).fill({ id: 'project' });
      vi.mocked(mockPrismaClient.$transaction).mockResolvedValue([
        mockProjects,
        25,
      ] as any);

      const result = await projectRepository.search({}, { page: 2, limit: 20 });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(2);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(true);
    });

    it('should sort by different fields', async () => {
      vi.mocked(mockPrismaClient.$transaction).mockResolvedValue([[], 0] as any);

      await projectRepository.search({}, { sortBy: 'priceCents', sortOrder: 'asc' });

      expect(mockPrismaClient.$transaction).toHaveBeenCalled();
    });
  });

  // ============================================
  // FIND BY SELLER ID TESTS
  // ============================================

  describe('findBySellerId', () => {
    it('should find all projects for a seller', async () => {
      const mockProjects = [
        { id: 'project1', sellerId: 'seller123' },
        { id: 'project2', sellerId: 'seller123' },
      ];

      vi.mocked(mockPrismaClient.project.findMany).mockResolvedValue(mockProjects as any);

      const result = await projectRepository.findBySellerId('seller123');

      expect(result).toEqual(mockProjects);
      expect(mockPrismaClient.project.findMany).toHaveBeenCalledWith({
        where: { sellerId: 'seller123' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  // ============================================
  // INCREMENT VIEW COUNT TESTS
  // ============================================

  describe('incrementViewCount', () => {
    it('should increment view count', async () => {
      const mockProject = {
        id: 'project123',
        viewCount: 11,
      };

      vi.mocked(mockPrismaClient.project.update).mockResolvedValue(mockProject as any);

      const result = await projectRepository.incrementViewCount('project123');

      expect(result).toEqual(mockProject);
      expect(mockPrismaClient.project.update).toHaveBeenCalledWith({
        where: { id: 'project123' },
        data: {
          viewCount: {
            increment: 1,
          },
        },
      });
    });
  });

  // ============================================
  // GET FEATURED TESTS
  // ============================================

  describe('getFeatured', () => {
    it('should get featured projects', async () => {
      const mockFeaturedProjects = [
        { id: 'project1', isFeatured: true },
        { id: 'project2', isFeatured: true },
      ];

      vi.mocked(mockPrismaClient.project.findMany).mockResolvedValue(
        mockFeaturedProjects as any
      );

      const result = await projectRepository.getFeatured(10);

      expect(result).toEqual(mockFeaturedProjects);
      expect(mockPrismaClient.project.findMany).toHaveBeenCalledWith({
        where: {
          isFeatured: true,
          status: 'active',
          OR: [{ featuredUntil: null }, { featuredUntil: { gte: expect.any(Date) } }],
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          seller: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
              isVerifiedSeller: true,
            },
          },
        },
      });
    });
  });

  // ============================================
  // GET STATISTICS TESTS
  // ============================================

  describe('getStatistics', () => {
    it('should get platform statistics', async () => {
      vi.mocked(mockPrismaClient.$transaction).mockResolvedValue([
        100, // total
        80, // active
        15, // sold
        5, // draft
        {
          _avg: {
            completionPercentage: 75,
            priceCents: 50000,
          },
        },
      ] as any);

      const result = await projectRepository.getStatistics();

      expect(result.total).toBe(100);
      expect(result.active).toBe(80);
      expect(result.sold).toBe(15);
      expect(result.draft).toBe(5);
      expect(result.averageCompletion).toBe(75);
      expect(result.averagePrice).toBe(50000);
    });

    it('should handle null aggregate values', async () => {
      vi.mocked(mockPrismaClient.$transaction).mockResolvedValue([
        0, // total
        0, // active
        0, // sold
        0, // draft
        {
          _avg: {
            completionPercentage: null,
            priceCents: null,
          },
        },
      ] as any);

      const result = await projectRepository.getStatistics();

      expect(result.total).toBe(0);
      expect(result.active).toBe(0);
      expect(result.sold).toBe(0);
      expect(result.draft).toBe(0);
      expect(result.averageCompletion).toBe(0);
      expect(result.averagePrice).toBe(0);
    });
  });
});
