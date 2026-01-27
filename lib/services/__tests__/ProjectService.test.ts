/**
 * ProjectService Unit Tests
 *
 * Tests validation logic, permission checks, and business rules
 * for project management operations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ProjectService,
  ProjectValidationError,
  ProjectPermissionError,
} from '../ProjectService';
import type { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import type { UserRepository } from '@/lib/repositories/UserRepository';
import type { SubscriptionService } from '../SubscriptionService';
import type { R2Service } from '../R2Service';

// Mock implementations
const mockProjectRepository: ProjectRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  search: vi.fn(),
  findBySellerId: vi.fn(),
  incrementViewCount: vi.fn(),
  getFeatured: vi.fn(),
  getStatistics: vi.fn(),
  countByUser: vi.fn(),
} as any;

const mockUserRepository: UserRepository = {
  findById: vi.fn(),
  findByEmail: vi.fn(),
  findByGitHubId: vi.fn(),
  createUser: vi.fn(),
  updateUserProfile: vi.fn(),
  deleteUser: vi.fn(),
  getVerifiedSellers: vi.fn(),
  updateStripeAccount: vi.fn(),
} as any;

const mockSubscriptionService: SubscriptionService = {
  getSubscriptionStatus: vi.fn(),
  createSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
  resumeSubscription: vi.fn(),
  createPortalSession: vi.fn(),
  isActiveSubscriber: vi.fn(),
  getPricing: vi.fn(),
  updateFromWebhook: vi.fn(),
  cancelImmediately: vi.fn(),
  findAllActive: vi.fn(),
  findByStatus: vi.fn(),
} as any;

const mockR2Service: R2Service = {
  getUploadUrl: vi.fn(),
  validateFile: vi.fn(),
} as any;

describe('ProjectService', () => {
  let projectService: ProjectService;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create fresh instance
    projectService = new ProjectService(
      mockProjectRepository,
      mockUserRepository,
      mockSubscriptionService,
      mockR2Service
    );
  });

  // ============================================
  // CREATE PROJECT TESTS
  // ============================================

  describe('createProject', () => {
    const validProjectData = {
      title: 'Test Project',
      description: 'A'.repeat(50), // Minimum 50 characters
      category: 'web_app' as const,
      completionPercentage: 75,
      priceCents: 50000, // $500
      techStack: ['React', 'TypeScript'],
      licenseType: 'full_code' as const,
      accessLevel: 'full' as const,
    };

    beforeEach(() => {
      // Mock user as seller for all tests in this block
      vi.mocked(mockUserRepository.findById).mockResolvedValue({
        id: 'seller123',
        isSeller: true,
        isVerifiedSeller: true,
      } as any);

      // Mock subscription status (default: Pro with unlimited listings)
      vi.mocked(mockSubscriptionService.getSubscriptionStatus).mockResolvedValue({
        subscriptionId: 'sub_test',
        plan: 'pro',
        status: 'active',
        currentPeriodEnd: new Date(),
        cancelAtPeriodEnd: false,
        benefits: {
          unlimitedListings: true,
          advancedAnalytics: true,
          featuredListingDiscount: 20,
          verificationBadge: true,
        },
      });
    });

    it('should create project with valid data', async () => {
      const sellerId = 'seller123';
      const mockCreatedProject = {
        id: 'project123',
        ...validProjectData,
        sellerId,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(mockProjectRepository.create).mockResolvedValue(
        mockCreatedProject as any
      );

      const result = await projectService.createProject(sellerId, validProjectData);

      expect(result).toEqual(mockCreatedProject);
      expect(mockProjectRepository.create).toHaveBeenCalledWith({
        ...validProjectData,
        sellerId,
        status: 'draft',
        viewCount: 0,
        favoriteCount: 0,
        messageCount: 0,
        isFeatured: false,
        isApproved: true,
      });
    });

    it('should reject title that is too short', async () => {
      const invalidData = {
        ...validProjectData,
        title: 'Hi', // Too short (< 5 chars)
      };

      await expect(
        projectService.createProject('seller123', invalidData)
      ).rejects.toThrow(ProjectValidationError);
    });

    it('should reject title that is too long', async () => {
      const invalidData = {
        ...validProjectData,
        title: 'A'.repeat(101), // Too long (> 100 chars)
      };

      await expect(
        projectService.createProject('seller123', invalidData)
      ).rejects.toThrow(ProjectValidationError);
    });

    it('should reject description that is too short', async () => {
      const invalidData = {
        ...validProjectData,
        description: 'Short', // Too short (< 50 chars)
      };

      await expect(
        projectService.createProject('seller123', invalidData)
      ).rejects.toThrow(ProjectValidationError);
    });

    it('should reject description that is too long', async () => {
      const invalidData = {
        ...validProjectData,
        description: 'A'.repeat(5001), // Too long (> 5000 chars)
      };

      await expect(
        projectService.createProject('seller123', invalidData)
      ).rejects.toThrow(ProjectValidationError);
    });

    it('should reject completion percentage below 50', async () => {
      const invalidData = {
        ...validProjectData,
        completionPercentage: 49,
      };

      await expect(
        projectService.createProject('seller123', invalidData)
      ).rejects.toThrow(ProjectValidationError);
    });

    it('should reject completion percentage above 95', async () => {
      const invalidData = {
        ...validProjectData,
        completionPercentage: 96,
      };

      await expect(
        projectService.createProject('seller123', invalidData)
      ).rejects.toThrow(ProjectValidationError);
    });

    it('should reject price below $100', async () => {
      const invalidData = {
        ...validProjectData,
        priceCents: 9999, // $99.99
      };

      await expect(
        projectService.createProject('seller123', invalidData)
      ).rejects.toThrow(ProjectValidationError);
    });

    it('should reject price above $100,000', async () => {
      const invalidData = {
        ...validProjectData,
        priceCents: 10000001, // $100,000.01
      };

      await expect(
        projectService.createProject('seller123', invalidData)
      ).rejects.toThrow(ProjectValidationError);
    });

    it('should reject tech stack with no technologies', async () => {
      const invalidData = {
        ...validProjectData,
        techStack: [],
      };

      await expect(
        projectService.createProject('seller123', invalidData)
      ).rejects.toThrow(ProjectValidationError);
    });

    it('should reject tech stack with more than 20 technologies', async () => {
      const invalidData = {
        ...validProjectData,
        techStack: Array(21).fill('Tech'),
      };

      await expect(
        projectService.createProject('seller123', invalidData)
      ).rejects.toThrow(ProjectValidationError);
    });

    it('should reject invalid category', async () => {
      const invalidData = {
        ...validProjectData,
        category: 'invalid_category' as any,
      };

      await expect(
        projectService.createProject('seller123', invalidData)
      ).rejects.toThrow(ProjectValidationError);
    });

    it('should reject invalid license type', async () => {
      const invalidData = {
        ...validProjectData,
        licenseType: 'invalid_license' as any,
      };

      await expect(
        projectService.createProject('seller123', invalidData)
      ).rejects.toThrow(ProjectValidationError);
    });

    it('should reject invalid access level', async () => {
      const invalidData = {
        ...validProjectData,
        accessLevel: 'invalid_access' as any,
      };

      await expect(
        projectService.createProject('seller123', invalidData)
      ).rejects.toThrow(ProjectValidationError);
    });

    it('should validate GitHub URL format', async () => {
      const invalidData = {
        ...validProjectData,
        githubUrl: 'not-a-valid-url',
      };

      await expect(
        projectService.createProject('seller123', invalidData)
      ).rejects.toThrow(ProjectValidationError);
    });

    // ============================================
    // PROJECT LIMIT ENFORCEMENT TESTS
    // ============================================

    it('should allow free tier user to create up to 3 projects', async () => {
      // Mock free tier subscription
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

      // Mock project count: 2 active projects
      vi.mocked(mockProjectRepository.countByUser).mockResolvedValue(2);

      // Mock successful creation
      vi.mocked(mockProjectRepository.create).mockResolvedValue({
        id: 'project123',
        ...validProjectData,
      } as any);

      // Should succeed (3rd project)
      await expect(
        projectService.createProject('seller123', validProjectData)
      ).resolves.toBeDefined();

      // Verify countByUser was called with correct filters
      expect(mockProjectRepository.countByUser).toHaveBeenCalledWith('seller123', {
        status: 'active',
      });
    });

    it('should reject free tier user creating 4th project', async () => {
      // Mock free tier subscription
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

      // Mock project count: 3 active projects (limit reached)
      vi.mocked(mockProjectRepository.countByUser).mockResolvedValue(3);

      // Should throw error
      await expect(
        projectService.createProject('seller123', validProjectData)
      ).rejects.toThrow(ProjectValidationError);

      await expect(
        projectService.createProject('seller123', validProjectData)
      ).rejects.toThrow('Free plan limited to 3 active projects');

      // Verify create was NOT called
      expect(mockProjectRepository.create).not.toHaveBeenCalled();
    });

    it('should allow Pro subscriber unlimited projects', async () => {
      // Mock Pro subscription (default from beforeEach has unlimited listings)
      // Mock project count: 100 active projects
      vi.mocked(mockProjectRepository.countByUser).mockResolvedValue(100);

      // Mock successful creation
      vi.mocked(mockProjectRepository.create).mockResolvedValue({
        id: 'project123',
        ...validProjectData,
      } as any);

      // Should succeed even with 100 projects
      await expect(
        projectService.createProject('seller123', validProjectData)
      ).resolves.toBeDefined();

      // Verify countByUser was NOT called (unlimited, no need to check)
      // Actually it should be called since we check before knowing the benefits
      expect(mockSubscriptionService.getSubscriptionStatus).toHaveBeenCalled();
    });

    it('should only count active projects towards limit', async () => {
      // Mock free tier subscription
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

      // Mock project count with status filter
      vi.mocked(mockProjectRepository.countByUser).mockResolvedValue(2);

      // Mock successful creation
      vi.mocked(mockProjectRepository.create).mockResolvedValue({
        id: 'project123',
        ...validProjectData,
      } as any);

      await projectService.createProject('seller123', validProjectData);

      // Verify countByUser was called with status: 'active' filter
      expect(mockProjectRepository.countByUser).toHaveBeenCalledWith('seller123', {
        status: 'active',
      });
    });
  });

  // ============================================
  // UPDATE PROJECT TESTS
  // ============================================

  describe('updateProject', () => {
    const existingProject = {
      id: 'project123',
      sellerId: 'seller123',
      title: 'Existing Project',
      status: 'draft',
    };

    beforeEach(() => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(existingProject as any);
    });

    it('should update project when user is the seller', async () => {
      const updateData = { title: 'Updated Title' };
      const updatedProject = { ...existingProject, ...updateData };

      vi.mocked(mockProjectRepository.update).mockResolvedValue(updatedProject as any);

      const result = await projectService.updateProject(
        'project123',
        'seller123',
        updateData
      );

      expect(result).toEqual(updatedProject);
      expect(mockProjectRepository.update).toHaveBeenCalledWith('project123', updateData);
    });

    it('should reject update when user is not the seller', async () => {
      await expect(
        projectService.updateProject('project123', 'different-user', {
          title: 'New Title',
        })
      ).rejects.toThrow(ProjectPermissionError);

      expect(mockProjectRepository.update).not.toHaveBeenCalled();
    });

    it('should reject update when project not found', async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      await expect(
        projectService.updateProject('nonexistent', 'seller123', { title: 'New Title' })
      ).rejects.toThrow('Project not found');
    });

    it('should validate update data', async () => {
      const invalidUpdate = { title: 'Hi' }; // Too short

      await expect(
        projectService.updateProject('project123', 'seller123', invalidUpdate)
      ).rejects.toThrow(ProjectValidationError);
    });
  });

  // ============================================
  // DELETE PROJECT TESTS
  // ============================================

  describe('deleteProject', () => {
    it('should delete draft project when user is seller', async () => {
      const project = {
        id: 'project123',
        sellerId: 'seller123',
        status: 'draft',
      };

      vi.mocked(mockProjectRepository.findById).mockResolvedValue(project as any);
      vi.mocked(mockProjectRepository.delete).mockResolvedValue(project as any);

      await projectService.deleteProject('project123', 'seller123');

      expect(mockProjectRepository.delete).toHaveBeenCalledWith('project123');
    });

    it('should reject delete when user is not seller', async () => {
      const project = {
        id: 'project123',
        sellerId: 'seller123',
        status: 'draft',
      };

      vi.mocked(mockProjectRepository.findById).mockResolvedValue(project as any);

      await expect(
        projectService.deleteProject('project123', 'different-user')
      ).rejects.toThrow(ProjectPermissionError);

      expect(mockProjectRepository.delete).not.toHaveBeenCalled();
    });

    it('should reject delete when project is sold', async () => {
      const project = {
        id: 'project123',
        sellerId: 'seller123',
        status: 'sold',
      };

      vi.mocked(mockProjectRepository.findById).mockResolvedValue(project as any);

      await expect(
        projectService.deleteProject('project123', 'seller123')
      ).rejects.toThrow(ProjectValidationError);

      expect(mockProjectRepository.delete).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // PUBLISH PROJECT TESTS
  // ============================================

  describe('publishProject', () => {
    const validProject = {
      id: 'project123',
      sellerId: 'seller123',
      status: 'draft',
      title: 'Valid Project',
      description: 'A'.repeat(50),
      category: 'web_app',
      completionPercentage: 75,
      priceCents: 50000,
      techStack: ['React'],
      licenseType: 'full_code',
      accessLevel: 'full',
      thumbnailImageUrl: null,
      screenshotUrls: [],
    };

    it('should publish valid draft project', async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(validProject as any);
      vi.mocked(mockProjectRepository.update).mockResolvedValue({
        ...validProject,
        status: 'active',
      } as any);

      const result = await projectService.publishProject('project123', 'seller123');

      expect(result.status).toBe('active');
      expect(mockProjectRepository.update).toHaveBeenCalledWith('project123', {
        status: 'active',
      });
    });

    it('should reject publish when project is not draft', async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue({
        ...validProject,
        status: 'active',
      } as any);

      await expect(
        projectService.publishProject('project123', 'seller123')
      ).rejects.toThrow(ProjectValidationError);
    });

    it('should reject publish when user is not seller', async () => {
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(validProject as any);

      await expect(
        projectService.publishProject('project123', 'different-user')
      ).rejects.toThrow(ProjectPermissionError);
    });

    it('should reject publish when required fields are missing', async () => {
      const incompleteProject = {
        ...validProject,
        description: undefined,
      };

      vi.mocked(mockProjectRepository.findById).mockResolvedValue(
        incompleteProject as any
      );

      await expect(
        projectService.publishProject('project123', 'seller123')
      ).rejects.toThrow(ProjectValidationError);
    });
  });

  // ============================================
  // GET PROJECT TESTS
  // ============================================

  describe('getProject', () => {
    it('should get project and increment view count for active projects', async () => {
      const project = {
        id: 'project123',
        status: 'active',
        title: 'Test Project',
      };

      vi.mocked(mockProjectRepository.findById).mockResolvedValue(project as any);
      vi.mocked(mockProjectRepository.incrementViewCount).mockResolvedValue({
        ...project,
        viewCount: 1,
      } as any);

      const result = await projectService.getProject('project123', {
        incrementView: true,
      });

      expect(mockProjectRepository.incrementViewCount).toHaveBeenCalledWith('project123');
      expect(result).toBeDefined();
    });

    it('should not increment view count for draft projects', async () => {
      const project = {
        id: 'project123',
        status: 'draft',
        title: 'Test Project',
      };

      vi.mocked(mockProjectRepository.findById).mockResolvedValue(project as any);

      await projectService.getProject('project123', { incrementView: true });

      expect(mockProjectRepository.incrementViewCount).not.toHaveBeenCalled();
    });

    it('should not increment view count when disabled', async () => {
      const project = {
        id: 'project123',
        status: 'active',
        title: 'Test Project',
      };

      vi.mocked(mockProjectRepository.findById).mockResolvedValue(project as any);

      await projectService.getProject('project123', { incrementView: false });

      expect(mockProjectRepository.incrementViewCount).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // SEARCH PROJECTS TESTS
  // ============================================

  describe('searchProjects', () => {
    it('should search projects with filters and pagination', async () => {
      const mockResults = {
        projects: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      };

      vi.mocked(mockProjectRepository.search).mockResolvedValue(mockResults as any);

      const filters = {
        query: 'test',
        category: 'web_app',
      };

      const pagination = {
        page: 1,
        limit: 20,
      };

      const result = await projectService.searchProjects(filters, pagination);

      expect(result).toEqual(mockResults);
      expect(mockProjectRepository.search).toHaveBeenCalledWith(filters, pagination);
    });
  });
});
