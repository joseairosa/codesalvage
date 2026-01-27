/**
 * FavoriteService Integration Tests
 *
 * Tests favorite/watchlist business logic with real database operations.
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
import { FavoriteService } from '@/lib/services/FavoriteService';
import { FavoriteRepository } from '@/lib/repositories/FavoriteRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import { prisma } from '@/lib/prisma';

describe('FavoriteService (Integration)', () => {
  let favoriteService: FavoriteService;
  let favoriteRepository: FavoriteRepository;
  let userRepository: UserRepository;
  let projectRepository: ProjectRepository;

  beforeAll(async () => {
    await setupTestDatabase();
    favoriteRepository = new FavoriteRepository(prisma);
    userRepository = new UserRepository(prisma);
    projectRepository = new ProjectRepository(prisma);
    favoriteService = new FavoriteService(
      favoriteRepository,
      userRepository,
      projectRepository
    );
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('addFavorite', () => {
    it('should add project to favorites', async () => {
      const seller = await createTestUser({ username: 'seller', isSeller: true });
      const buyer = await createTestUser({ username: 'buyer' });
      const project = await createTestProject({ sellerId: seller.id, status: 'active' });

      const favorite = await favoriteService.addFavorite(buyer.id, project.id);

      expect(favorite.id).toBeDefined();
      expect(favorite.userId).toBe(buyer.id);
      expect(favorite.projectId).toBe(project.id);

      // Verify in database
      const dbFavorite = await prisma.favorite.findUnique({
        where: {
          userId_projectId: {
            userId: buyer.id,
            projectId: project.id,
          },
        },
      });
      expect(dbFavorite).toBeTruthy();
    });

    it('should increment project favorite count', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id, status: 'active' });

      // Initial count
      const initialProject = await prisma.project.findUnique({
        where: { id: project.id },
      });
      expect(initialProject?.favoriteCount).toBe(0);

      await favoriteService.addFavorite(buyer.id, project.id);

      // Count incremented
      const updatedProject = await prisma.project.findUnique({
        where: { id: project.id },
      });
      expect(updatedProject?.favoriteCount).toBe(1);
    });

    it('should prevent user from favoriting own project', async () => {
      const seller = await createTestUser({ isSeller: true });
      const project = await createTestProject({ sellerId: seller.id, status: 'active' });

      await expect(
        favoriteService.addFavorite(seller.id, project.id)
      ).rejects.toThrow('Cannot favorite your own project');
    });

    it('should prevent favoriting inactive projects', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id, status: 'draft' });

      await expect(
        favoriteService.addFavorite(buyer.id, project.id)
      ).rejects.toThrow('Cannot favorite inactive projects');
    });

    it('should prevent duplicate favorites', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id, status: 'active' });

      // First favorite succeeds
      await favoriteService.addFavorite(buyer.id, project.id);

      // Second favorite fails
      await expect(
        favoriteService.addFavorite(buyer.id, project.id)
      ).rejects.toThrow('Project is already in favorites');
    });
  });

  describe('removeFavorite', () => {
    it('should remove project from favorites', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id, status: 'active' });

      // Add favorite
      await favoriteService.addFavorite(buyer.id, project.id);

      // Remove favorite
      const removed = await favoriteService.removeFavorite(buyer.id, project.id);
      expect(removed).toBe(true);

      // Verify removed from database
      const dbFavorite = await prisma.favorite.findUnique({
        where: {
          userId_projectId: {
            userId: buyer.id,
            projectId: project.id,
          },
        },
      });
      expect(dbFavorite).toBeNull();
    });

    it('should decrement project favorite count', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id, status: 'active' });

      await favoriteService.addFavorite(buyer.id, project.id);
      await favoriteService.removeFavorite(buyer.id, project.id);

      const updatedProject = await prisma.project.findUnique({
        where: { id: project.id },
      });
      expect(updatedProject?.favoriteCount).toBe(0);
    });

    it('should return false when removing non-existent favorite', async () => {
      const buyer = await createTestUser();
      const project = await createTestProject({ status: 'active' });

      const removed = await favoriteService.removeFavorite(buyer.id, project.id);
      expect(removed).toBe(false);
    });
  });

  describe('toggleFavorite', () => {
    it('should add favorite if not exists', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id, status: 'active' });

      const result = await favoriteService.toggleFavorite(buyer.id, project.id);

      expect(result.isFavorited).toBe(true);
      expect(result.favorite).toBeDefined();
      expect(result.favorite?.userId).toBe(buyer.id);
    });

    it('should remove favorite if exists', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id, status: 'active' });

      // Add first
      await favoriteService.addFavorite(buyer.id, project.id);

      // Toggle removes
      const result = await favoriteService.toggleFavorite(buyer.id, project.id);

      expect(result.isFavorited).toBe(false);
      expect(result.favorite).toBeUndefined();
    });
  });

  describe('getUserFavorites', () => {
    it('should get all favorites for a user with pagination', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();

      // Create multiple projects and favorite them
      const project1 = await createTestProject({
        sellerId: seller.id,
        status: 'active',
        title: 'Project 1',
      });
      const project2 = await createTestProject({
        sellerId: seller.id,
        status: 'active',
        title: 'Project 2',
      });

      await favoriteService.addFavorite(buyer.id, project1.id);
      await favoriteService.addFavorite(buyer.id, project2.id);

      const result = await favoriteService.getUserFavorites(buyer.id);

      expect(result.favorites).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.favorites[0]!.project).toBeDefined();
      expect(result.favorites[0]!.project.seller).toBeDefined();
    });

    it('should return empty list when no favorites', async () => {
      const buyer = await createTestUser();

      const result = await favoriteService.getUserFavorites(buyer.id);

      expect(result.favorites).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should support pagination', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();

      // Create 5 favorites
      for (let i = 0; i < 5; i++) {
        const project = await createTestProject({
          sellerId: seller.id,
          status: 'active',
          title: `Project ${i}`,
        });
        await favoriteService.addFavorite(buyer.id, project.id);
      }

      const result = await favoriteService.getUserFavorites(buyer.id, {
        page: 1,
        limit: 2,
      });

      expect(result.favorites).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.totalPages).toBe(3);
      expect(result.hasNext).toBe(true);
      expect(result.hasPrev).toBe(false);
    });
  });

  describe('isFavorited', () => {
    it('should return true when project is favorited', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id, status: 'active' });

      await favoriteService.addFavorite(buyer.id, project.id);

      const isFavorited = await favoriteService.isFavorited(buyer.id, project.id);
      expect(isFavorited).toBe(true);
    });

    it('should return false when project is not favorited', async () => {
      const buyer = await createTestUser();
      const project = await createTestProject({ status: 'active' });

      const isFavorited = await favoriteService.isFavorited(buyer.id, project.id);
      expect(isFavorited).toBe(false);
    });
  });
});
