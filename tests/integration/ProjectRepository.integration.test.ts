/**
 * ProjectRepository Integration Tests
 *
 * Tests project CRUD operations, search, filters, and pagination with real database.
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
import { createTestUser, createTestSeller, createTestProject } from '@/tests/helpers/fixtures';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import { prisma } from '@/lib/prisma';

describe('ProjectRepository (Integration)', () => {
  let projectRepository: ProjectRepository;

  beforeAll(async () => {
    await setupTestDatabase();
    projectRepository = new ProjectRepository(prisma);
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('create', () => {
    it('should create project with all fields', async () => {
      const seller = await createTestSeller();

      const projectData = {
        sellerId: seller.id,
        title: 'E-commerce Platform',
        description: 'Full-stack e-commerce solution with cart and checkout',
        category: 'web_app',
        completionPercentage: 85,
        estimatedCompletionHours: 40,
        knownIssues: 'Payment integration needs testing',
        priceCents: 250000,
        licenseType: 'full_code',
        accessLevel: 'full',
        techStack: ['Next.js', 'TypeScript', 'Stripe', 'PostgreSQL'],
        primaryLanguage: 'TypeScript',
        frameworks: ['Next.js', 'Tailwind CSS'],
        githubUrl: 'https://github.com/test/ecommerce',
        demoUrl: 'https://demo.example.com',
        status: 'active',
      };

      const project = await projectRepository.create(projectData);

      expect(project.id).toBeDefined();
      expect(project.title).toBe(projectData.title);
      expect(project.sellerId).toBe(seller.id);
      expect(project.completionPercentage).toBe(85);
      expect(project.priceCents).toBe(250000);
      expect(project.techStack).toEqual(projectData.techStack);
      expect(project.createdAt).toBeInstanceOf(Date);
      expect(project.updatedAt).toBeInstanceOf(Date);

      // Verify in database
      const dbProject = await prisma.project.findUnique({
        where: { id: project.id },
      });
      expect(dbProject).toBeTruthy();
      expect(dbProject?.title).toBe(projectData.title);
    });

    it('should create project with minimal required fields', async () => {
      const seller = await createTestSeller();

      const project = await projectRepository.create({
        sellerId: seller.id,
        title: 'Minimal Project',
        description: 'Basic project',
        category: 'tool',
        completionPercentage: 50,
        priceCents: 10000,
        licenseType: 'full_code',
        accessLevel: 'full',
        techStack: ['Python'],
        primaryLanguage: 'Python',
        frameworks: [],
        status: 'draft',
      });

      expect(project.id).toBeDefined();
      expect(project.estimatedCompletionHours).toBeNull();
      expect(project.githubUrl).toBeNull();
      expect(project.demoUrl).toBeNull();
    });

    it('should set default values', async () => {
      const seller = await createTestSeller();

      const project = await projectRepository.create({
        sellerId: seller.id,
        title: 'Default Values Project',
        description: 'Test defaults',
        category: 'web_app',
        completionPercentage: 70,
        priceCents: 50000,
        licenseType: 'full_code',
        accessLevel: 'full',
        techStack: ['React'],
        primaryLanguage: 'JavaScript',
        frameworks: [],
        status: 'active',
      });

      expect(project.viewCount).toBe(0);
      expect(project.favoriteCount).toBe(0);
      expect(project.messageCount).toBe(0);
      expect(project.isFeatured).toBe(false);
      expect(project.isApproved).toBe(true);
    });
  });

  describe('findById', () => {
    it('should find existing project by id', async () => {
      const createdProject = await createTestProject();

      const foundProject = await projectRepository.findById(createdProject.id);

      expect(foundProject).toBeTruthy();
      expect(foundProject?.id).toBe(createdProject.id);
      expect(foundProject?.title).toBe(createdProject.title);
    });

    it('should find project with seller relation', async () => {
      const seller = await createTestSeller({ username: 'johndoe' });
      const project = await createTestProject({ sellerId: seller.id });

      const foundProject = await projectRepository.findById(project.id, true);

      expect(foundProject).toBeTruthy();
      expect(foundProject?.seller).toBeDefined();
      expect(foundProject?.seller.username).toBe('johndoe');
    });

    it('should return null for non-existent project', async () => {
      const project = await projectRepository.findById('non-existent-id');
      expect(project).toBeNull();
    });
  });

  describe('update', () => {
    it('should update project fields', async () => {
      const project = await createTestProject({
        title: 'Original Title',
        priceCents: 100000,
      });

      const updated = await projectRepository.update(project.id, {
        title: 'Updated Title',
        priceCents: 150000,
        status: 'active',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.priceCents).toBe(150000);
      expect(updated.status).toBe('active');

      // Verify updatedAt changed
      expect(updated.updatedAt.getTime()).toBeGreaterThan(project.updatedAt.getTime());
    });

    it('should partially update project', async () => {
      const project = await createTestProject({
        title: 'Original',
        description: 'Original description',
      });

      const updated = await projectRepository.update(project.id, {
        title: 'New Title',
      });

      expect(updated.title).toBe('New Title');
      expect(updated.description).toBe('Original description'); // Unchanged
    });

    it('should throw error for non-existent project', async () => {
      await expect(
        projectRepository.update('non-existent-id', { title: 'New' })
      ).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete project', async () => {
      const project = await createTestProject();

      await projectRepository.delete(project.id);

      const deleted = await prisma.project.findUnique({
        where: { id: project.id },
      });
      expect(deleted).toBeNull();
    });

    it('should throw error for non-existent project', async () => {
      await expect(projectRepository.delete('non-existent-id')).rejects.toThrow();
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      // Create test projects with different attributes
      const seller = await createTestSeller();

      await createTestProject({
        sellerId: seller.id,
        title: 'React Dashboard',
        description: 'Admin dashboard built with React',
        category: 'dashboard',
        techStack: ['React', 'TypeScript', 'Tailwind'],
        primaryLanguage: 'TypeScript',
        completionPercentage: 90,
        priceCents: 100000,
        status: 'active',
      });

      await createTestProject({
        sellerId: seller.id,
        title: 'Python ML Tool',
        description: 'Machine learning data analysis tool',
        category: 'tool',
        techStack: ['Python', 'TensorFlow', 'Pandas'],
        primaryLanguage: 'Python',
        completionPercentage: 70,
        priceCents: 50000,
        status: 'active',
      });

      await createTestProject({
        sellerId: seller.id,
        title: 'Mobile App',
        description: 'React Native mobile application',
        category: 'mobile',
        techStack: ['React Native', 'TypeScript'],
        primaryLanguage: 'TypeScript',
        completionPercentage: 60,
        priceCents: 200000,
        status: 'active', // Changed to active for search tests
      });

      await createTestProject({
        sellerId: seller.id,
        title: 'Featured Web App',
        description: 'Featured e-commerce platform',
        category: 'web_app',
        techStack: ['Next.js', 'PostgreSQL'],
        primaryLanguage: 'JavaScript',
        completionPercentage: 95,
        priceCents: 300000,
        status: 'active',
        isFeatured: true,
      });

      await createTestProject({
        sellerId: seller.id,
        title: 'Draft Project',
        description: 'Work in progress project',
        category: 'web_app',
        techStack: ['Vue.js'],
        primaryLanguage: 'JavaScript',
        completionPercentage: 40,
        priceCents: 50000,
        status: 'draft',
      });
    });

    it('should return all active projects without filters', async () => {
      const result = await projectRepository.search({}, { page: 1, limit: 10 });

      expect(result.projects.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      expect(result.page).toBe(1);
    });

    it('should filter by query text', async () => {
      const result = await projectRepository.search(
        { query: 'React' },
        { page: 1, limit: 10 }
      );

      expect(result.projects.length).toBeGreaterThanOrEqual(2);
      expect(
        result.projects.some((p) => p.title.includes('React') || p.description.includes('React'))
      ).toBe(true);
    });

    it('should filter by category', async () => {
      const result = await projectRepository.search(
        { category: 'tool' },
        { page: 1, limit: 10 }
      );

      expect(result.projects.length).toBe(1);
      expect(result.projects[0].category).toBe('tool');
    });

    it('should filter by tech stack', async () => {
      const result = await projectRepository.search(
        { techStack: ['TypeScript'] },
        { page: 1, limit: 10 }
      );

      expect(result.projects.length).toBeGreaterThanOrEqual(2);
      expect(result.projects.every((p) => p.techStack.includes('TypeScript'))).toBe(true);
    });

    it('should filter by primary language', async () => {
      const result = await projectRepository.search(
        { primaryLanguage: 'Python' },
        { page: 1, limit: 10 }
      );

      expect(result.projects.length).toBe(1);
      expect(result.projects[0].primaryLanguage).toBe('Python');
    });

    it('should filter by completion percentage range', async () => {
      const result = await projectRepository.search(
        { minCompletion: 80, maxCompletion: 95 },
        { page: 1, limit: 10 }
      );

      expect(result.projects.length).toBeGreaterThanOrEqual(1);
      expect(
        result.projects.every((p) => p.completionPercentage >= 80 && p.completionPercentage <= 95)
      ).toBe(true);
    });

    it('should filter by price range', async () => {
      const result = await projectRepository.search(
        { minPrice: 50000, maxPrice: 150000 },
        { page: 1, limit: 10 }
      );

      expect(result.projects.length).toBeGreaterThanOrEqual(1);
      expect(result.projects.every((p) => p.priceCents >= 50000 && p.priceCents <= 150000)).toBe(
        true
      );
    });

    it('should filter by status', async () => {
      const result = await projectRepository.search(
        { status: 'draft' },
        { page: 1, limit: 10 }
      );

      expect(result.projects.length).toBe(1);
      expect(result.projects[0].status).toBe('draft');
    });

    it('should filter featured projects', async () => {
      const result = await projectRepository.search(
        { featured: true },
        { page: 1, limit: 10 }
      );

      expect(result.projects.length).toBe(1);
      expect(result.projects[0].isFeatured).toBe(true);
    });

    it('should combine multiple filters', async () => {
      const result = await projectRepository.search(
        {
          category: 'dashboard',
          techStack: ['TypeScript'],
          minCompletion: 85,
        },
        { page: 1, limit: 10 }
      );

      expect(result.projects.length).toBe(1);
      expect(result.projects[0].title).toBe('React Dashboard');
    });

    it('should paginate results', async () => {
      const page1 = await projectRepository.search({}, { page: 1, limit: 2 });
      const page2 = await projectRepository.search({}, { page: 2, limit: 2 });

      expect(page1.projects.length).toBeLessThanOrEqual(2);
      expect(page1.page).toBe(1);
      expect(page1.limit).toBe(2);
      expect(page1.hasNext).toBe(page1.total > 2);

      if (page1.total > 2) {
        expect(page2.projects.length).toBeGreaterThan(0);
        expect(page2.page).toBe(2);
        expect(page2.hasPrev).toBe(true);
      }
    });

    it('should sort by price descending', async () => {
      const result = await projectRepository.search(
        {},
        { page: 1, limit: 10, sortBy: 'priceCents', sortOrder: 'desc' }
      );

      if (result.projects.length > 1) {
        expect(result.projects[0].priceCents).toBeGreaterThanOrEqual(
          result.projects[1].priceCents
        );
      }
    });

    it('should sort by completion percentage ascending', async () => {
      const result = await projectRepository.search(
        {},
        { page: 1, limit: 10, sortBy: 'completionPercentage', sortOrder: 'asc' }
      );

      if (result.projects.length > 1) {
        expect(result.projects[0].completionPercentage).toBeLessThanOrEqual(
          result.projects[1].completionPercentage
        );
      }
    });
  });

  describe('findBySellerId', () => {
    it('should find all projects for a seller', async () => {
      const seller1 = await createTestSeller();
      const seller2 = await createTestSeller();

      await createTestProject({ sellerId: seller1.id, title: 'Project 1' });
      await createTestProject({ sellerId: seller1.id, title: 'Project 2' });
      await createTestProject({ sellerId: seller2.id, title: 'Other Project' });

      const projects = await projectRepository.findBySellerId(seller1.id);

      expect(projects.length).toBe(2);
      expect(projects.every((p) => p.sellerId === seller1.id)).toBe(true);
    });

    it('should return empty array for seller with no projects', async () => {
      const seller = await createTestSeller();
      const projects = await projectRepository.findBySellerId(seller.id);
      expect(projects).toEqual([]);
    });
  });

  describe('incrementViewCount', () => {
    it('should increment view count', async () => {
      const project = await createTestProject();
      const initialViews = project.viewCount;

      const updated = await projectRepository.incrementViewCount(project.id);

      expect(updated.viewCount).toBe(initialViews + 1);

      // Verify in database
      const dbProject = await prisma.project.findUnique({
        where: { id: project.id },
      });
      expect(dbProject?.viewCount).toBe(initialViews + 1);
    });

    it('should increment multiple times', async () => {
      const project = await createTestProject();

      await projectRepository.incrementViewCount(project.id);
      await projectRepository.incrementViewCount(project.id);
      const final = await projectRepository.incrementViewCount(project.id);

      expect(final.viewCount).toBe(project.viewCount + 3);
    });
  });

  describe('getFeatured', () => {
    it('should return only featured projects', async () => {
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

      const featured = await projectRepository.getFeatured(10);

      expect(featured.length).toBe(2);
      expect(featured.every((p) => p.isFeatured === true)).toBe(true);
      expect(featured.every((p) => p.status === 'active')).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const seller = await createTestSeller();

      await createTestProject({ sellerId: seller.id, isFeatured: true, status: 'active' });
      await createTestProject({ sellerId: seller.id, isFeatured: true, status: 'active' });
      await createTestProject({ sellerId: seller.id, isFeatured: true, status: 'active' });

      const featured = await projectRepository.getFeatured(2);
      expect(featured.length).toBe(2);
    });

    it('should return empty array when no featured projects', async () => {
      const featured = await projectRepository.getFeatured(10);
      expect(featured).toEqual([]);
    });
  });

  describe('getStatistics', () => {
    it('should return project statistics', async () => {
      const seller = await createTestSeller();

      await createTestProject({ sellerId: seller.id, status: 'active' });
      await createTestProject({ sellerId: seller.id, status: 'active' });
      await createTestProject({ sellerId: seller.id, status: 'draft' });
      await createTestProject({ sellerId: seller.id, status: 'sold' });

      const stats = await projectRepository.getStatistics();

      expect(stats.total).toBe(4);
      expect(stats.active).toBe(2);
      expect(stats.draft).toBe(1);
      expect(stats.sold).toBe(1);
    });

    it('should return zero stats when no projects', async () => {
      const stats = await projectRepository.getStatistics();

      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.draft).toBe(0);
      expect(stats.sold).toBe(0);
    });
  });
});
