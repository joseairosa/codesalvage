/**
 * ProjectRepository Admin Methods Tests
 *
 * Test suite for admin-specific ProjectRepository methods.
 *
 * Test Coverage:
 * - approveProject()
 * - rejectProject()
 * - toggleFeatured()
 * - getAllProjects()
 * - countAllProjects()
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaClient, Project } from '@prisma/client';
import { ProjectRepository } from '../ProjectRepository';

// Mock Prisma Client
const mockPrisma = {
  project: {
    update: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
} as unknown as PrismaClient;

describe('ProjectRepository - Admin Methods', () => {
  let projectRepo: ProjectRepository;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create fresh instance
    projectRepo = new ProjectRepository(mockPrisma);
  });

  describe('approveProject()', () => {
    it('should approve a project and set approval metadata', async () => {
      // Arrange
      const projectId = 'proj123';
      const approvedBy = 'admin456';

      const mockApprovedProject: Partial<Project> = {
        id: projectId,
        title: 'Test Project',
        sellerId: 'seller789',
        status: 'active',
        approvedBy,
        approvedAt: expect.any(Date),
      };

      (mockPrisma.project.update as any).mockResolvedValue(mockApprovedProject);

      // Act
      const result = await projectRepo.approveProject(projectId, approvedBy);

      // Assert
      expect(result).toEqual(mockApprovedProject);
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          status: 'active',
          approvedBy,
          approvedAt: expect.any(Date),
        },
      });
    });

    it('should throw error if project not found', async () => {
      // Arrange
      const projectId = 'invalid';
      const approvedBy = 'admin123';

      (mockPrisma.project.update as any).mockRejectedValue(
        new Error('Record to update not found')
      );

      // Act & Assert
      await expect(projectRepo.approveProject(projectId, approvedBy)).rejects.toThrow(
        'Failed to approve project: Record to update not found'
      );
    });

    it('should throw error if database update fails', async () => {
      // Arrange
      (mockPrisma.project.update as any).mockRejectedValue(
        new Error('Connection timeout')
      );

      // Act & Assert
      await expect(projectRepo.approveProject('proj123', 'admin123')).rejects.toThrow(
        'Failed to approve project: Connection timeout'
      );
    });
  });

  describe('rejectProject()', () => {
    it('should reject a project and clear approval metadata', async () => {
      // Arrange
      const projectId = 'proj123';
      const reason = 'Violates content policy';

      const mockRejectedProject: Partial<Project> = {
        id: projectId,
        title: 'Test Project',
        sellerId: 'seller789',
        status: 'draft',
        approvedBy: null,
        approvedAt: null,
      };

      (mockPrisma.project.update as any).mockResolvedValue(mockRejectedProject);

      // Act
      const result = await projectRepo.rejectProject(projectId, reason);

      // Assert
      expect(result).toEqual(mockRejectedProject);
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          status: 'draft',
          approvedBy: null,
          approvedAt: null,
        },
      });
    });

    it('should reject project without reason', async () => {
      // Arrange
      const projectId = 'proj123';

      const mockRejectedProject: Partial<Project> = {
        id: projectId,
        status: 'draft',
        approvedBy: null,
        approvedAt: null,
      };

      (mockPrisma.project.update as any).mockResolvedValue(mockRejectedProject);

      // Act
      const result = await projectRepo.rejectProject(projectId);

      // Assert
      expect(result.status).toBe('draft');
      expect(result.approvedBy).toBeNull();
      expect(result.approvedAt).toBeNull();
    });

    it('should throw error if project not found', async () => {
      // Arrange
      (mockPrisma.project.update as any).mockRejectedValue(
        new Error('Record to update not found')
      );

      // Act & Assert
      await expect(
        projectRepo.rejectProject('invalid', 'Reason')
      ).rejects.toThrow('Failed to reject project: Record to update not found');
    });
  });

  describe('toggleFeatured()', () => {
    it('should feature a project with default 30-day expiry', async () => {
      // Arrange
      const projectId = 'proj123';
      const featuredBy = 'admin456';
      const featured = true;

      const mockFeaturedProject: Partial<Project> = {
        id: projectId,
        title: 'Test Project',
        isFeatured: true,
        featuredBy,
        featuredAt: expect.any(Date),
        featuredUntil: expect.any(Date),
      };

      (mockPrisma.project.update as any).mockResolvedValue(mockFeaturedProject);

      // Act
      const result = await projectRepo.toggleFeatured(projectId, featured, featuredBy);

      // Assert
      expect(result).toEqual(mockFeaturedProject);
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          isFeatured: true,
          featuredBy,
          featuredAt: expect.any(Date),
          featuredUntil: expect.any(Date),
        },
      });

      // Verify featuredUntil is approximately 30 days from now
      const call = (mockPrisma.project.update as any).mock.calls[0][0];
      const featuredUntil = call.data.featuredUntil as Date;
      const expectedDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const timeDiff = Math.abs(featuredUntil.getTime() - expectedDate.getTime());
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });

    it('should feature a project with custom expiry days', async () => {
      // Arrange
      const projectId = 'proj123';
      const featuredBy = 'admin456';
      const featured = true;
      const featuredDays = 7;

      const mockFeaturedProject: Partial<Project> = {
        id: projectId,
        isFeatured: true,
        featuredBy,
        featuredAt: expect.any(Date),
        featuredUntil: expect.any(Date),
      };

      (mockPrisma.project.update as any).mockResolvedValue(mockFeaturedProject);

      // Act
      await projectRepo.toggleFeatured(
        projectId,
        featured,
        featuredBy,
        featuredDays
      );

      // Assert
      const call = (mockPrisma.project.update as any).mock.calls[0][0];
      const featuredUntil = call.data.featuredUntil as Date;
      const expectedDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const timeDiff = Math.abs(featuredUntil.getTime() - expectedDate.getTime());
      expect(timeDiff).toBeLessThan(1000); // Within 1 second
    });

    it('should unfeature a project and clear featured metadata', async () => {
      // Arrange
      const projectId = 'proj123';
      const featuredBy = 'admin456';
      const featured = false;

      const mockUnfeaturedProject: Partial<Project> = {
        id: projectId,
        title: 'Test Project',
        isFeatured: false,
        featuredBy: null,
        featuredAt: null,
        featuredUntil: null,
      };

      (mockPrisma.project.update as any).mockResolvedValue(mockUnfeaturedProject);

      // Act
      const result = await projectRepo.toggleFeatured(projectId, featured, featuredBy);

      // Assert
      expect(result).toEqual(mockUnfeaturedProject);
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          isFeatured: false,
          featuredBy: null,
          featuredAt: null,
          featuredUntil: null,
        },
      });
    });

    it('should throw error if project not found', async () => {
      // Arrange
      (mockPrisma.project.update as any).mockRejectedValue(
        new Error('Record to update not found')
      );

      // Act & Assert
      await expect(
        projectRepo.toggleFeatured('invalid', true, 'admin123')
      ).rejects.toThrow('Failed to toggle featured status: Record to update not found');
    });
  });

  describe('getAllProjects()', () => {
    it('should return all projects with default pagination', async () => {
      // Arrange
      const mockProjects = [
        {
          id: 'proj1',
          title: 'Project 1',
          status: 'active',
          seller: { id: 'seller1', username: 'seller1' },
        },
        {
          id: 'proj2',
          title: 'Project 2',
          status: 'draft',
          seller: { id: 'seller2', username: 'seller2' },
        },
      ];

      (mockPrisma.project.findMany as any).mockResolvedValue(mockProjects);

      // Act
      const result = await projectRepo.getAllProjects();

      // Assert
      expect(result).toEqual(mockProjects);
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: {},
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
        include: {
          seller: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true,
              isVerifiedSeller: true,
              isBanned: true,
            },
          },
        },
      });
    });

    it('should filter projects by single status', async () => {
      // Arrange
      (mockPrisma.project.findMany as any).mockResolvedValue([]);

      // Act
      await projectRepo.getAllProjects({ status: 'draft' });

      // Assert
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'draft' },
        })
      );
    });

    it('should filter projects by multiple statuses', async () => {
      // Arrange
      (mockPrisma.project.findMany as any).mockResolvedValue([]);

      // Act
      await projectRepo.getAllProjects({
        status: ['draft', 'active', 'sold'],
      });

      // Assert
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { in: ['draft', 'active', 'sold'] } },
        })
      );
    });

    it('should filter projects by isFeatured flag', async () => {
      // Arrange
      (mockPrisma.project.findMany as any).mockResolvedValue([]);

      // Act
      await projectRepo.getAllProjects({ isFeatured: true });

      // Assert
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isFeatured: true },
        })
      );
    });

    it('should filter projects by sellerId', async () => {
      // Arrange
      (mockPrisma.project.findMany as any).mockResolvedValue([]);

      // Act
      await projectRepo.getAllProjects({ sellerId: 'seller123' });

      // Assert
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sellerId: 'seller123' },
        })
      );
    });

    it('should apply multiple filters simultaneously', async () => {
      // Arrange
      (mockPrisma.project.findMany as any).mockResolvedValue([]);

      // Act
      await projectRepo.getAllProjects({
        status: 'active',
        isFeatured: true,
        sellerId: 'seller123',
      });

      // Assert
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'active',
            isFeatured: true,
            sellerId: 'seller123',
          },
        })
      );
    });

    it('should support custom pagination', async () => {
      // Arrange
      (mockPrisma.project.findMany as any).mockResolvedValue([]);

      // Act
      await projectRepo.getAllProjects({
        limit: 20,
        offset: 40,
      });

      // Assert
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 40,
        })
      );
    });

    it('should support custom sorting', async () => {
      // Arrange
      (mockPrisma.project.findMany as any).mockResolvedValue([]);

      // Act
      await projectRepo.getAllProjects({
        sortBy: 'viewCount',
        sortOrder: 'asc',
      });

      // Assert
      expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { viewCount: 'asc' },
        })
      );
    });

    it('should throw error if query fails', async () => {
      // Arrange
      (mockPrisma.project.findMany as any).mockRejectedValue(
        new Error('Database error')
      );

      // Act & Assert
      await expect(projectRepo.getAllProjects()).rejects.toThrow(
        'Failed to get all projects: Database error'
      );
    });
  });

  describe('countAllProjects()', () => {
    it('should count all projects when no status provided', async () => {
      // Arrange
      (mockPrisma.project.count as any).mockResolvedValue(250);

      // Act
      const result = await projectRepo.countAllProjects();

      // Assert
      expect(result).toBe(250);
      expect(mockPrisma.project.count).toHaveBeenCalledWith();
    });

    it('should count projects filtered by status', async () => {
      // Arrange
      (mockPrisma.project.count as any).mockResolvedValue(42);

      // Act
      const result = await projectRepo.countAllProjects('draft');

      // Assert
      expect(result).toBe(42);
      expect(mockPrisma.project.count).toHaveBeenCalledWith({
        where: { status: 'draft' },
      });
    });

    it('should return zero when no projects exist', async () => {
      // Arrange
      (mockPrisma.project.count as any).mockResolvedValue(0);

      // Act
      const result = await projectRepo.countAllProjects('sold');

      // Assert
      expect(result).toBe(0);
    });

    it('should throw error if count fails', async () => {
      // Arrange
      (mockPrisma.project.count as any).mockRejectedValue(
        new Error('Connection timeout')
      );

      // Act & Assert
      await expect(projectRepo.countAllProjects()).rejects.toThrow(
        'Failed to count projects: Connection timeout'
      );
    });
  });
});
