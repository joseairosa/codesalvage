/**
 * FavoriteRepository Unit Tests
 *
 * Tests all CRUD operations and query methods for favorites.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FavoriteRepository } from '../FavoriteRepository';
import type { PrismaClient } from '@prisma/client';

// Mock Prisma Client
const mockPrismaClient = {
  favorite: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    delete: vi.fn(),
  },
  project: {
    update: vi.fn(),
  },
} as unknown as PrismaClient;

// Mock data helpers
const createMockFavorite = (overrides = {}) => ({
  id: 'fav123',
  userId: 'user123',
  projectId: 'project456',
  createdAt: new Date('2026-01-15T10:00:00Z'),
  ...overrides,
});

const createMockProject = () => ({
  id: 'project456',
  title: 'Test Project',
  description: 'A test project',
  thumbnailImageUrl: 'https://example.com/thumb.jpg',
  priceCents: 50000,
  completionPercentage: 80,
  status: 'active',
  seller: {
    id: 'seller123',
    username: 'seller',
    fullName: 'Seller Name',
    avatarUrl: 'https://avatar.com/seller.jpg',
  },
});

const createMockFavoriteWithProject = (overrides = {}) => ({
  ...createMockFavorite(overrides),
  project: createMockProject(),
});

describe('FavoriteRepository', () => {
  let favoriteRepository: FavoriteRepository;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create fresh instance
    favoriteRepository = new FavoriteRepository(mockPrismaClient);
  });

  // ============================================
  // CREATE TESTS
  // ============================================

  describe('create', () => {
    it('should create favorite', async () => {
      const mockFavorite = createMockFavorite();
      vi.mocked(mockPrismaClient.favorite.create).mockResolvedValue(mockFavorite);

      const result = await favoriteRepository.create('user123', 'project456');

      expect(result).toEqual(mockFavorite);
      expect(mockPrismaClient.favorite.create).toHaveBeenCalledWith({
        data: {
          userId: 'user123',
          projectId: 'project456',
        },
      });
    });

    it('should throw error when duplicate favorite', async () => {
      vi.mocked(mockPrismaClient.favorite.create).mockRejectedValue(
        new Error('Unique constraint violation')
      );

      await expect(
        favoriteRepository.create('user123', 'project456')
      ).rejects.toThrow('[FavoriteRepository] Failed to create favorite');
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.favorite.create).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(
        favoriteRepository.create('user123', 'project456')
      ).rejects.toThrow('[FavoriteRepository] Failed to create favorite');
    });
  });

  // ============================================
  // DELETE TESTS
  // ============================================

  describe('delete', () => {
    it('should delete favorite', async () => {
      const mockFavorite = createMockFavorite();
      vi.mocked(mockPrismaClient.favorite.findFirst).mockResolvedValue(mockFavorite);
      vi.mocked(mockPrismaClient.favorite.delete).mockResolvedValue(mockFavorite);

      const result = await favoriteRepository.delete('user123', 'project456');

      expect(result).toEqual(mockFavorite);
      expect(mockPrismaClient.favorite.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user123',
          projectId: 'project456',
        },
      });
      expect(mockPrismaClient.favorite.delete).toHaveBeenCalledWith({
        where: { id: 'fav123' },
      });
    });

    it('should throw error when favorite not found', async () => {
      vi.mocked(mockPrismaClient.favorite.findFirst).mockResolvedValue(null);

      await expect(
        favoriteRepository.delete('user123', 'project456')
      ).rejects.toThrow('[FavoriteRepository] Failed to delete favorite');
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.favorite.findFirst).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(
        favoriteRepository.delete('user123', 'project456')
      ).rejects.toThrow('[FavoriteRepository] Failed to delete favorite');
    });
  });

  // ============================================
  // IS FAVORITED TESTS
  // ============================================

  describe('isFavorited', () => {
    it('should return true when favorite exists', async () => {
      const mockFavorite = createMockFavorite();
      vi.mocked(mockPrismaClient.favorite.findFirst).mockResolvedValue(mockFavorite);

      const result = await favoriteRepository.isFavorited('user123', 'project456');

      expect(result).toBe(true);
      expect(mockPrismaClient.favorite.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user123',
          projectId: 'project456',
        },
      });
    });

    it('should return false when favorite does not exist', async () => {
      vi.mocked(mockPrismaClient.favorite.findFirst).mockResolvedValue(null);

      const result = await favoriteRepository.isFavorited('user123', 'project456');

      expect(result).toBe(false);
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.favorite.findFirst).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(
        favoriteRepository.isFavorited('user123', 'project456')
      ).rejects.toThrow('[FavoriteRepository] Failed to check favorite status');
    });
  });

  // ============================================
  // GET USER FAVORITES TESTS
  // ============================================

  describe('getUserFavorites', () => {
    it('should get user favorites with default pagination', async () => {
      const mockFavorites = [
        createMockFavoriteWithProject(),
        createMockFavoriteWithProject({ id: 'fav456' }),
      ];

      vi.mocked(mockPrismaClient.favorite.findMany).mockResolvedValue(mockFavorites);
      vi.mocked(mockPrismaClient.favorite.count).mockResolvedValue(2);

      const result = await favoriteRepository.getUserFavorites('user123');

      expect(result.favorites).toEqual(mockFavorites);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(false);
    });

    it('should get user favorites with custom pagination', async () => {
      const mockFavorites = [createMockFavoriteWithProject()];

      vi.mocked(mockPrismaClient.favorite.findMany).mockResolvedValue(mockFavorites);
      vi.mocked(mockPrismaClient.favorite.count).mockResolvedValue(25);

      const result = await favoriteRepository.getUserFavorites('user123', {
        page: 2,
        limit: 10,
      });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(result.hasNext).toBe(true);
      expect(result.hasPrev).toBe(true);
      expect(mockPrismaClient.favorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (page 2 - 1) * limit 10
          take: 10,
        })
      );
    });

    it('should return empty array when no favorites found', async () => {
      vi.mocked(mockPrismaClient.favorite.findMany).mockResolvedValue([]);
      vi.mocked(mockPrismaClient.favorite.count).mockResolvedValue(0);

      const result = await favoriteRepository.getUserFavorites('user123');

      expect(result.favorites).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.favorite.findMany).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(
        favoriteRepository.getUserFavorites('user123')
      ).rejects.toThrow('[FavoriteRepository] Failed to get user favorites');
    });
  });

  // ============================================
  // GET PROJECT FAVORITERS TESTS
  // ============================================

  describe('getProjectFavoriters', () => {
    it('should get list of user IDs who favorited project', async () => {
      const mockFavorites = [
        { userId: 'user123' },
        { userId: 'user456' },
        { userId: 'user789' },
      ];

      vi.mocked(mockPrismaClient.favorite.findMany).mockResolvedValue(
        mockFavorites as any
      );

      const result = await favoriteRepository.getProjectFavoriters('project456');

      expect(result).toEqual(['user123', 'user456', 'user789']);
      expect(mockPrismaClient.favorite.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project456' },
        select: { userId: true },
      });
    });

    it('should return empty array when no favoriters', async () => {
      vi.mocked(mockPrismaClient.favorite.findMany).mockResolvedValue([]);

      const result = await favoriteRepository.getProjectFavoriters('project456');

      expect(result).toEqual([]);
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.favorite.findMany).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(
        favoriteRepository.getProjectFavoriters('project456')
      ).rejects.toThrow('[FavoriteRepository] Failed to get project favoriters');
    });
  });

  // ============================================
  // GET PROJECT FAVORITE COUNT TESTS
  // ============================================

  describe('getProjectFavoriteCount', () => {
    it('should get favorite count for project', async () => {
      vi.mocked(mockPrismaClient.favorite.count).mockResolvedValue(15);

      const result = await favoriteRepository.getProjectFavoriteCount('project456');

      expect(result).toBe(15);
      expect(mockPrismaClient.favorite.count).toHaveBeenCalledWith({
        where: { projectId: 'project456' },
      });
    });

    it('should return 0 when no favorites', async () => {
      vi.mocked(mockPrismaClient.favorite.count).mockResolvedValue(0);

      const result = await favoriteRepository.getProjectFavoriteCount('project456');

      expect(result).toBe(0);
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.favorite.count).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(
        favoriteRepository.getProjectFavoriteCount('project456')
      ).rejects.toThrow('[FavoriteRepository] Failed to get project favorite count');
    });
  });

  // ============================================
  // UPDATE PROJECT FAVORITE COUNT TESTS
  // ============================================

  describe('updateProjectFavoriteCount', () => {
    it('should increment project favorite count', async () => {
      vi.mocked(mockPrismaClient.project.update).mockResolvedValue({} as any);

      await favoriteRepository.updateProjectFavoriteCount('project456', true);

      expect(mockPrismaClient.project.update).toHaveBeenCalledWith({
        where: { id: 'project456' },
        data: {
          favoriteCount: {
            increment: 1,
          },
        },
      });
    });

    it('should decrement project favorite count', async () => {
      vi.mocked(mockPrismaClient.project.update).mockResolvedValue({} as any);

      await favoriteRepository.updateProjectFavoriteCount('project456', false);

      expect(mockPrismaClient.project.update).toHaveBeenCalledWith({
        where: { id: 'project456' },
        data: {
          favoriteCount: {
            decrement: 1,
          },
        },
      });
    });

    it('should throw error when database operation fails', async () => {
      vi.mocked(mockPrismaClient.project.update).mockRejectedValue(
        new Error('DB Error')
      );

      await expect(
        favoriteRepository.updateProjectFavoriteCount('project456', true)
      ).rejects.toThrow('[FavoriteRepository] Failed to update project favorite count');
    });
  });
});
