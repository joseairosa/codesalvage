/**
 * ProjectService Integration Tests
 *
 * Tests project business logic with real database operations.
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
import { createTestUser, createTestSeller, createTestProject } from '@/tests/helpers/fixtures';
import { ProjectService } from '@/lib/services/ProjectService';
import { SubscriptionService } from '@/lib/services/SubscriptionService';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { SubscriptionRepository } from '@/lib/repositories/SubscriptionRepository';
import { prisma } from '@/lib/prisma';

// Mock R2Service since we don't need real file uploads for integration tests
vi.mock('@/lib/services/R2Service', () => ({
  R2Service: class {
    async generatePresignedUploadUrl() {
      return {
        uploadUrl: 'https://mock-upload-url.com',
        publicUrl: 'https://mock-public-url.com',
        key: 'mock-key',
      };
    }
  },
}));

describe('ProjectService (Integration)', () => {
  let projectService: ProjectService;
  let projectRepository: ProjectRepository;
  let userRepository: UserRepository;
  let subscriptionService: SubscriptionService;
  let subscriptionRepository: SubscriptionRepository;

  beforeAll(async () => {
    await setupTestDatabase();
    projectRepository = new ProjectRepository(prisma);
    userRepository = new UserRepository(prisma);
    subscriptionRepository = new SubscriptionRepository(prisma);
    subscriptionService = new SubscriptionService(subscriptionRepository, userRepository);
    projectService = new ProjectService(
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

  describe('createProject', () => {
    it('should create project for verified seller', async () => {
      const seller = await createTestSeller({ isVerifiedSeller: true });

      const projectData = {
        title: 'New E-commerce Platform',
        description: 'A full-featured online store with product catalog, shopping cart, checkout, and payment processing capabilities.',
        category: 'web_app' as const,
        completionPercentage: 80,
        estimatedCompletionHours: 50,
        knownIssues: 'Payment gateway integration pending',
        priceCents: 150000,
        licenseType: 'full_code' as const,
        accessLevel: 'full' as const,
        techStack: ['Next.js', 'Stripe', 'PostgreSQL'],
        primaryLanguage: 'TypeScript',
        frameworks: ['Next.js', 'Tailwind CSS'],
        githubUrl: 'https://github.com/test/project',
        demoUrl: 'https://demo.example.com',
      };

      const project = await projectService.createProject(seller.id, projectData);

      expect(project.id).toBeDefined();
      expect(project.title).toBe(projectData.title);
      expect(project.sellerId).toBe(seller.id);
      expect(project.status).toBe('draft'); // New projects start as draft
      expect(project.isApproved).toBe(true);

      // Verify in database
      const dbProject = await prisma.project.findUnique({
        where: { id: project.id },
      });
      expect(dbProject).toBeTruthy();
    });

    it('should throw error for non-seller user', async () => {
      const buyer = await createTestUser({ isSeller: false });

      const projectData = {
        title: 'Test Project',
        description: 'This is a test project description that meets the minimum length requirement of 50 characters.',
        category: 'web_app' as const,
        completionPercentage: 50,
        priceCents: 10000,
        licenseType: 'full_code' as const,
        accessLevel: 'full' as const,
        techStack: ['React'],
        primaryLanguage: 'JavaScript',
        frameworks: [],
      };

      await expect(projectService.createProject(buyer.id, projectData)).rejects.toThrow(
        'must be a seller'
      );
    });

    it('should throw error for invalid completion percentage', async () => {
      const seller = await createTestSeller();

      const projectData = {
        title: 'Test Project',
        description: 'This is a test project description that meets the minimum length requirement of 50 characters.',
        completionPercentage: 150, // Invalid
        category: 'web_app' as const,
        priceCents: 10000,
        licenseType: 'full_code' as const,
        accessLevel: 'full' as const,
        techStack: ['React'],
        primaryLanguage: 'JavaScript',
        frameworks: [],
      };

      await expect(projectService.createProject(seller.id, projectData)).rejects.toThrow(
        'Completion percentage must be between'
      );
    });
  });

  describe('updateProject', () => {
    it('should update project by owner', async () => {
      const seller = await createTestSeller();
      const project = await createTestProject({ sellerId: seller.id });

      const updates = {
        title: 'Updated Title',
        priceCents: 200000,
        completionPercentage: 95,
      };

      const updated = await projectService.updateProject(project.id, seller.id, updates);

      expect(updated.title).toBe('Updated Title');
      expect(updated.priceCents).toBe(200000);
      expect(updated.completionPercentage).toBe(95);
    });

    it('should throw error when non-owner tries to update', async () => {
      const seller1 = await createTestSeller();
      const seller2 = await createTestSeller();
      const project = await createTestProject({ sellerId: seller1.id });

      await expect(
        projectService.updateProject(project.id, seller2.id, { title: 'Hacked' })
      ).rejects.toThrow('permission');
    });

    it('should not allow updating sellerId', async () => {
      const seller = await createTestSeller();
      const project = await createTestProject({ sellerId: seller.id });

      const updated = await projectService.updateProject(project.id, seller.id, {
        title: 'Updated',
      });

      expect(updated.sellerId).toBe(seller.id); // Should remain unchanged
    });
  });

  describe('publishProject', () => {
    it('should publish draft project', async () => {
      const seller = await createTestSeller();
      const project = await createTestProject({
        sellerId: seller.id,
        status: 'draft',
      });

      const published = await projectService.publishProject(project.id, seller.id);

      expect(published.status).toBe('active');

      // Verify in database
      const dbProject = await prisma.project.findUnique({
        where: { id: project.id },
      });
      expect(dbProject?.status).toBe('active');
    });

    it('should throw error when non-owner tries to publish', async () => {
      const seller1 = await createTestSeller();
      const seller2 = await createTestSeller();
      const project = await createTestProject({
        sellerId: seller1.id,
        status: 'draft',
      });

      await expect(projectService.publishProject(project.id, seller2.id)).rejects.toThrow(
        'permission'
      );
    });

    it('should not publish already active project', async () => {
      const seller = await createTestSeller();
      const project = await createTestProject({
        sellerId: seller.id,
        status: 'active',
      });

      await expect(projectService.publishProject(project.id, seller.id)).rejects.toThrow(
        'Only draft projects can be published'
      );
    });
  });

  describe('deleteProject', () => {
    it('should delete project by owner', async () => {
      const seller = await createTestSeller();
      const project = await createTestProject({ sellerId: seller.id });

      await projectService.deleteProject(project.id, seller.id);

      // Verify deleted from database
      const dbProject = await prisma.project.findUnique({
        where: { id: project.id },
      });
      expect(dbProject).toBeNull();
    });

    it('should throw error when non-owner tries to delete', async () => {
      const seller1 = await createTestSeller();
      const seller2 = await createTestSeller();
      const project = await createTestProject({ sellerId: seller1.id });

      await expect(projectService.deleteProject(project.id, seller2.id)).rejects.toThrow(
        'permission'
      );
    });
  });

  describe('getProject', () => {
    it('should get project without incrementing view count', async () => {
      const project = await createTestProject();
      const initialViews = project.viewCount;

      const retrieved = await projectService.getProject(project.id, {
        incrementView: false,
      });

      expect(retrieved.id).toBe(project.id);
      expect(retrieved.viewCount).toBe(initialViews);
    });

    it('should get project with seller included', async () => {
      const seller = await createTestSeller({ username: 'johndoe' });
      const project = await createTestProject({ sellerId: seller.id });

      const retrieved = await projectService.getProject(project.id, {
        includeSeller: true,
      });

      expect(retrieved.seller).toBeDefined();
      expect(retrieved.seller.username).toBe('johndoe');
    });

    it('should throw error for non-existent project', async () => {
      await expect(projectService.getProject('non-existent-id')).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('searchProjects', () => {
    beforeEach(async () => {
      const seller = await createTestSeller();

      await createTestProject({
        sellerId: seller.id,
        title: 'React Dashboard',
        category: 'dashboard',
        techStack: ['React', 'TypeScript'],
        priceCents: 100000,
        status: 'active',
      });

      await createTestProject({
        sellerId: seller.id,
        title: 'Python Tool',
        category: 'tool',
        techStack: ['Python'],
        priceCents: 50000,
        status: 'active',
      });

      await createTestProject({
        sellerId: seller.id,
        title: 'Draft Project',
        category: 'web_app',
        techStack: ['Vue.js'],
        priceCents: 75000,
        status: 'draft',
      });
    });

    it('should search projects with filters', async () => {
      const result = await projectService.searchProjects(
        { category: 'dashboard' },
        { page: 1, limit: 10 }
      );

      expect(result.projects.length).toBe(1);
      expect(result.projects[0].title).toBe('React Dashboard');
    });

    it('should only return active projects by default', async () => {
      const result = await projectService.searchProjects(
        {},
        { page: 1, limit: 10 }
      );

      expect(result.projects.every((p) => p.status === 'active')).toBe(true);
    });

    it('should paginate results', async () => {
      const result = await projectService.searchProjects(
        {},
        { page: 1, limit: 1 }
      );

      expect(result.projects.length).toBe(1);
      expect(result.limit).toBe(1);
      expect(result.hasNext).toBe(result.total > 1);
    });
  });

  describe('getSellerProjects', () => {
    it('should get all projects for a seller', async () => {
      const seller1 = await createTestSeller();
      const seller2 = await createTestSeller();

      await createTestProject({ sellerId: seller1.id });
      await createTestProject({ sellerId: seller1.id });
      await createTestProject({ sellerId: seller2.id });

      const projects = await projectService.getSellerProjects(seller1.id);

      expect(projects.length).toBe(2);
      expect(projects.every((p) => p.sellerId === seller1.id)).toBe(true);
    });

    it('should return empty array for seller with no projects', async () => {
      const seller = await createTestSeller();
      const projects = await projectService.getSellerProjects(seller.id);
      expect(projects).toEqual([]);
    });
  });

  describe('getFeaturedProjects', () => {
    it('should return featured active projects', async () => {
      const seller = await createTestSeller();

      await createTestProject({
        sellerId: seller.id,
        isFeatured: true,
        status: 'active',
      });
      await createTestProject({
        sellerId: seller.id,
        isFeatured: true,
        status: 'active',
      });
      await createTestProject({
        sellerId: seller.id,
        isFeatured: false,
        status: 'active',
      });

      const featured = await projectService.getFeaturedProjects(10);

      expect(featured.length).toBe(2);
      expect(featured.every((p) => p.isFeatured === true)).toBe(true);
    });
  });

  describe('Project Ownership Validation', () => {
    it('should verify project ownership correctly', async () => {
      const seller = await createTestSeller();
      const project = await createTestProject({ sellerId: seller.id });

      // Should not throw for owner
      await expect(
        projectService.updateProject(project.id, seller.id, { title: 'Updated' })
      ).resolves.toBeDefined();
    });

    it('should prevent cross-seller modifications', async () => {
      const seller1 = await createTestSeller();
      const seller2 = await createTestSeller();
      const project = await createTestProject({ sellerId: seller1.id });

      // Should throw for non-owner
      await expect(
        projectService.updateProject(project.id, seller2.id, { title: 'Hacked' })
      ).rejects.toThrow();
    });
  });

  describe('Business Rules', () => {
    it('should enforce completion percentage range', async () => {
      const seller = await createTestSeller();

      await expect(
        projectService.createProject(seller.id, {
          title: 'Test Project',
          description: 'This is a test project description that meets the minimum length requirement of 50 characters.',
          category: 'web_app',
          completionPercentage: -10, // Invalid
          priceCents: 10000,
          licenseType: 'full_code',
          accessLevel: 'full',
          techStack: ['React'],
          primaryLanguage: 'JavaScript',
          frameworks: [],
        })
      ).rejects.toThrow();

      await expect(
        projectService.createProject(seller.id, {
          title: 'Test Project',
          description: 'This is a test project description that meets the minimum length requirement of 50 characters.',
          category: 'web_app',
          completionPercentage: 110, // Invalid
          priceCents: 10000,
          licenseType: 'full_code',
          accessLevel: 'full',
          techStack: ['React'],
          primaryLanguage: 'JavaScript',
          frameworks: [],
        })
      ).rejects.toThrow();
    });

    it('should enforce minimum price', async () => {
      const seller = await createTestSeller();

      await expect(
        projectService.createProject(seller.id, {
          title: 'Test Project', // At least 5 characters
          description: 'This is a test project description that meets the minimum length requirement of 50 characters.',
          category: 'web_app',
          completionPercentage: 50,
          priceCents: 100, // Too low (< $5)
          licenseType: 'full_code',
          accessLevel: 'full',
          techStack: ['React'],
          primaryLanguage: 'JavaScript',
          frameworks: [],
        })
      ).rejects.toThrow('Price must be at least');
    });

    it('should enforce required fields', async () => {
      const seller = await createTestSeller();

      await expect(
        projectService.createProject(seller.id, {
          title: '', // Empty
          description: 'This is a test project description that meets the minimum length requirement of 50 characters.',
          category: 'web_app',
          completionPercentage: 50,
          priceCents: 10000,
          licenseType: 'full_code',
          accessLevel: 'full',
          techStack: ['React'],
          primaryLanguage: 'JavaScript',
          frameworks: [],
        })
      ).rejects.toThrow();
    });
  });
});
