/**
 * FavoriteService Unit Tests
 *
 * Tests all business logic for favorites including validation and permissions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FavoriteService,
  FavoriteValidationError,
  FavoritePermissionError,
} from '../FavoriteService';
import type { FavoriteRepository } from '@/lib/repositories/FavoriteRepository';
import type { UserRepository } from '@/lib/repositories/UserRepository';
import type { ProjectRepository } from '@/lib/repositories/ProjectRepository';

// Mock repositories
const mockFavoriteRepository = {
  create: vi.fn(),
  delete: vi.fn(),
  isFavorited: vi.fn(),
  getUserFavorites: vi.fn(),
  getProjectFavoriters: vi.fn(),
  getProjectFavoriteCount: vi.fn(),
  updateProjectFavoriteCount: vi.fn(),
} as unknown as FavoriteRepository;

const mockUserRepository = {
  findById: vi.fn(),
} as unknown as UserRepository;

const mockProjectRepository = {
  findById: vi.fn(),
} as unknown as ProjectRepository;

// Mock data helpers
const createMockUser = (overrides = {}) => ({
  id: 'user123',
  email: 'user@test.com',
  username: 'testuser',
  fullName: 'Test User',
  ...overrides,
});

const createMockProject = (overrides = {}) => ({
  id: 'project456',
  title: 'Test Project',
  description: 'A test project',
  sellerId: 'seller123',
  status: 'active',
  priceCents: 50000,
  completionPercentage: 80,
  ...overrides,
});

const createMockFavorite = (overrides = {}) => ({
  id: 'fav123',
  userId: 'user123',
  projectId: 'project456',
  createdAt: new Date('2026-01-15T10:00:00Z'),
  ...overrides,
});

const createMockFavoriteWithProject = (overrides = {}) => ({
  ...createMockFavorite(overrides),
  project: {
    ...createMockProject(),
    seller: {
      id: 'seller123',
      username: 'seller',
      fullName: 'Seller Name',
      avatarUrl: 'https://avatar.com/seller.jpg',
    },
  },
});

describe('FavoriteService', () => {
  let favoriteService: FavoriteService;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create fresh instance
    favoriteService = new FavoriteService(
      mockFavoriteRepository,
      mockUserRepository,
      mockProjectRepository
    );
  });

  // ============================================
  // ADD FAVORITE TESTS
  // ============================================

  describe('addFavorite', () => {
    it('should add favorite successfully', async () => {
      const mockUser = createMockUser();
      const mockProject = createMockProject();
      const mockFavorite = createMockFavorite();

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject as any);
      vi.mocked(mockFavoriteRepository.isFavorited).mockResolvedValue(false);
      vi.mocked(mockFavoriteRepository.create).mockResolvedValue(mockFavorite as any);
      vi.mocked(mockFavoriteRepository.updateProjectFavoriteCount).mockResolvedValue();

      const result = await favoriteService.addFavorite('user123', 'project456');

      expect(result).toEqual(mockFavorite);
      expect(mockFavoriteRepository.create).toHaveBeenCalledWith('user123', 'project456');
      expect(mockFavoriteRepository.updateProjectFavoriteCount).toHaveBeenCalledWith(
        'project456',
        true
      );
    });

    it('should throw error if already favorited', async () => {
      const mockUser = createMockUser();
      const mockProject = createMockProject();

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject as any);
      vi.mocked(mockFavoriteRepository.isFavorited).mockResolvedValue(true);

      await expect(favoriteService.addFavorite('user123', 'project456')).rejects.toThrow(
        FavoriteValidationError
      );
      await expect(favoriteService.addFavorite('user123', 'project456')).rejects.toThrow(
        'Project is already in favorites'
      );

      expect(mockFavoriteRepository.create).not.toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      await expect(favoriteService.addFavorite('user123', 'project456')).rejects.toThrow(
        FavoriteValidationError
      );
      await expect(favoriteService.addFavorite('user123', 'project456')).rejects.toThrow(
        'User not found'
      );
    });

    it('should throw error if project not found', async () => {
      const mockUser = createMockUser();

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(null);

      await expect(favoriteService.addFavorite('user123', 'project456')).rejects.toThrow(
        FavoriteValidationError
      );
      await expect(favoriteService.addFavorite('user123', 'project456')).rejects.toThrow(
        'Project not found'
      );
    });

    it('should throw error if project is not active', async () => {
      const mockUser = createMockUser();
      const mockProject = createMockProject({ status: 'draft' });

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject as any);

      await expect(favoriteService.addFavorite('user123', 'project456')).rejects.toThrow(
        FavoriteValidationError
      );
      await expect(favoriteService.addFavorite('user123', 'project456')).rejects.toThrow(
        'Cannot favorite inactive projects'
      );
    });

    it('should throw error if trying to favorite own project', async () => {
      const mockUser = createMockUser({ id: 'seller123' });
      const mockProject = createMockProject({ sellerId: 'seller123' });

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject as any);

      await expect(
        favoriteService.addFavorite('seller123', 'project456')
      ).rejects.toThrow(FavoritePermissionError);
      await expect(
        favoriteService.addFavorite('seller123', 'project456')
      ).rejects.toThrow('Cannot favorite your own project');
    });

    it('should throw error if userId is empty', async () => {
      await expect(favoriteService.addFavorite('', 'project456')).rejects.toThrow(
        FavoriteValidationError
      );
      await expect(favoriteService.addFavorite('', 'project456')).rejects.toThrow(
        'User ID is required'
      );
    });

    it('should throw error if projectId is empty', async () => {
      await expect(favoriteService.addFavorite('user123', '')).rejects.toThrow(
        FavoriteValidationError
      );
      await expect(favoriteService.addFavorite('user123', '')).rejects.toThrow(
        'Project ID is required'
      );
    });
  });

  // ============================================
  // REMOVE FAVORITE TESTS
  // ============================================

  describe('removeFavorite', () => {
    it('should remove favorite successfully', async () => {
      const mockFavorite = createMockFavorite();

      vi.mocked(mockFavoriteRepository.isFavorited).mockResolvedValue(true);
      vi.mocked(mockFavoriteRepository.delete).mockResolvedValue(mockFavorite as any);
      vi.mocked(mockFavoriteRepository.updateProjectFavoriteCount).mockResolvedValue();

      const result = await favoriteService.removeFavorite('user123', 'project456');

      expect(result).toBe(true);
      expect(mockFavoriteRepository.delete).toHaveBeenCalledWith('user123', 'project456');
      expect(mockFavoriteRepository.updateProjectFavoriteCount).toHaveBeenCalledWith(
        'project456',
        false
      );
    });

    it('should return false if favorite not found', async () => {
      vi.mocked(mockFavoriteRepository.isFavorited).mockResolvedValue(false);

      const result = await favoriteService.removeFavorite('user123', 'project456');

      expect(result).toBe(false);
      expect(mockFavoriteRepository.delete).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // TOGGLE FAVORITE TESTS
  // ============================================

  describe('toggleFavorite', () => {
    it('should add favorite if not already favorited', async () => {
      const mockUser = createMockUser();
      const mockProject = createMockProject();
      const mockFavorite = createMockFavorite();

      vi.mocked(mockFavoriteRepository.isFavorited).mockResolvedValue(false);
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);
      vi.mocked(mockProjectRepository.findById).mockResolvedValue(mockProject as any);
      vi.mocked(mockFavoriteRepository.create).mockResolvedValue(mockFavorite as any);
      vi.mocked(mockFavoriteRepository.updateProjectFavoriteCount).mockResolvedValue();

      const result = await favoriteService.toggleFavorite('user123', 'project456');

      expect(result.isFavorited).toBe(true);
      expect(result.favorite).toEqual(mockFavorite);
      expect(mockFavoriteRepository.create).toHaveBeenCalledWith('user123', 'project456');
    });

    it('should remove favorite if already favorited', async () => {
      const mockFavorite = createMockFavorite();

      // First call returns true (favorited), second call (inside removeFavorite) also returns true
      vi.mocked(mockFavoriteRepository.isFavorited)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      vi.mocked(mockFavoriteRepository.delete).mockResolvedValue(mockFavorite as any);
      vi.mocked(mockFavoriteRepository.updateProjectFavoriteCount).mockResolvedValue();

      const result = await favoriteService.toggleFavorite('user123', 'project456');

      expect(result.isFavorited).toBe(false);
      expect(result.favorite).toBeUndefined();
      expect(mockFavoriteRepository.delete).toHaveBeenCalledWith('user123', 'project456');
    });
  });

  // ============================================
  // GET USER FAVORITES TESTS
  // ============================================

  describe('getUserFavorites', () => {
    it('should get user favorites with pagination', async () => {
      const mockUser = createMockUser();
      const mockFavorites = [
        createMockFavoriteWithProject(),
        createMockFavoriteWithProject({ id: 'fav456' }),
      ];

      const mockPaginatedResult = {
        favorites: mockFavorites,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      };

      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser as any);
      vi.mocked(mockFavoriteRepository.getUserFavorites).mockResolvedValue(
        mockPaginatedResult as any
      );

      const result = await favoriteService.getUserFavorites('user123', {
        page: 1,
        limit: 20,
      });

      expect(result).toEqual(mockPaginatedResult);
      expect(mockFavoriteRepository.getUserFavorites).toHaveBeenCalledWith('user123', {
        page: 1,
        limit: 20,
      });
    });

    it('should throw error if user not found', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      await expect(favoriteService.getUserFavorites('user123')).rejects.toThrow(
        FavoriteValidationError
      );
      await expect(favoriteService.getUserFavorites('user123')).rejects.toThrow(
        'User not found'
      );
    });
  });

  // ============================================
  // IS FAVORITED TESTS
  // ============================================

  describe('isFavorited', () => {
    it('should return true if favorited', async () => {
      vi.mocked(mockFavoriteRepository.isFavorited).mockResolvedValue(true);

      const result = await favoriteService.isFavorited('user123', 'project456');

      expect(result).toBe(true);
      expect(mockFavoriteRepository.isFavorited).toHaveBeenCalledWith(
        'user123',
        'project456'
      );
    });

    it('should return false if not favorited', async () => {
      vi.mocked(mockFavoriteRepository.isFavorited).mockResolvedValue(false);

      const result = await favoriteService.isFavorited('user123', 'project456');

      expect(result).toBe(false);
    });
  });
});
