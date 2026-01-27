/**
 * AuthService Unit Tests
 *
 * Test Coverage:
 * - handleGitHubSignIn (happy path + edge cases)
 * - Profile validation
 * - Email validation
 * - Authorization checks (isSeller, canCreateProject, etc.)
 * - Error handling
 * - Logging behavior
 *
 * Testing Approach:
 * - Arrange-Act-Assert pattern
 * - Mock UserRepository
 * - Test both success and failure paths
 * - Verify service behavior, not implementation details
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../AuthService';
import type { UserRepository } from '@/lib/repositories/UserRepository';
import {
  createMockGitHubProfile,
  createMockUser,
  createMockSeller,
  mockConsole,
} from '@/tests/utils/mock-data';

// Mock UserRepository
vi.mock('@/lib/repositories/UserRepository');

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create mock UserRepository instance
    mockUserRepository = {
      findByGitHubId: vi.fn(),
      createUser: vi.fn(),
      updateUserProfile: vi.fn(),
      findById: vi.fn(),
    } as any;

    // Create AuthService with mocked repository
    authService = new AuthService(mockUserRepository);
  });

  describe('handleGitHubSignIn', () => {
    describe('Happy Path - New User', () => {
      it('should create new user when GitHub ID does not exist', async () => {
        // Arrange
        const githubProfile = createMockGitHubProfile();
        const newUser = createMockUser({
          githubId: githubProfile.id.toString(),
          email: githubProfile.email,
        });

        mockUserRepository.findByGitHubId.mockResolvedValue(null);
        mockUserRepository.createUser.mockResolvedValue(newUser);

        // Act
        const result = await authService.handleGitHubSignIn(githubProfile);

        // Assert
        expect(mockUserRepository.findByGitHubId).toHaveBeenCalledWith(
          githubProfile.id.toString()
        );
        expect(mockUserRepository.createUser).toHaveBeenCalledWith(
          expect.objectContaining({
            email: githubProfile.email.toLowerCase(),
            username: githubProfile.login.toLowerCase(),
            githubId: githubProfile.id.toString(),
          })
        );
        expect(result).toEqual({ user: newUser, isNewUser: true });
      });

      it('should lowercase email and username for new users', async () => {
        // Arrange
        const githubProfile = createMockGitHubProfile({
          email: 'TEST@EXAMPLE.COM',
          login: 'TestUser',
        });

        mockUserRepository.findByGitHubId.mockResolvedValue(null);
        mockUserRepository.createUser.mockResolvedValue(createMockUser());

        // Act
        await authService.handleGitHubSignIn(githubProfile);

        // Assert
        expect(mockUserRepository.createUser).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'test@example.com',
            username: 'testuser',
          })
        );
      });
    });

    describe('Happy Path - Existing User', () => {
      it('should update existing user profile', async () => {
        // Arrange
        const githubProfile = createMockGitHubProfile();
        const existingUser = createMockUser({
          githubId: githubProfile.id.toString(),
        });
        const updatedUser = { ...existingUser, fullName: githubProfile.name };

        mockUserRepository.findByGitHubId.mockResolvedValue(existingUser);
        mockUserRepository.updateUserProfile.mockResolvedValue(updatedUser);

        // Act
        const result = await authService.handleGitHubSignIn(githubProfile);

        // Assert
        expect(mockUserRepository.findByGitHubId).toHaveBeenCalledWith(
          githubProfile.id.toString()
        );
        expect(mockUserRepository.updateUserProfile).toHaveBeenCalledWith(
          existingUser.id,
          expect.objectContaining({
            fullName: githubProfile.name,
            bio: githubProfile.bio,
            lastLogin: expect.any(Date),
          })
        );
        expect(result).toEqual({ user: updatedUser, isNewUser: false });
      });

      it('should update last login timestamp', async () => {
        // Arrange
        const githubProfile = createMockGitHubProfile();
        const existingUser = createMockUser({
          githubId: githubProfile.id.toString(),
        });

        mockUserRepository.findByGitHubId.mockResolvedValue(existingUser);
        mockUserRepository.updateUserProfile.mockResolvedValue(existingUser);

        // Act
        await authService.handleGitHubSignIn(githubProfile);

        // Assert
        expect(mockUserRepository.updateUserProfile).toHaveBeenCalledWith(
          existingUser.id,
          expect.objectContaining({
            lastLogin: expect.any(Date),
          })
        );
      });
    });

    describe('Error Handling - Invalid Profile', () => {
      it('should throw error when GitHub ID is missing', async () => {
        // Arrange
        const invalidProfile = createMockGitHubProfile({ id: undefined as any });

        // Act & Assert
        await expect(authService.handleGitHubSignIn(invalidProfile)).rejects.toThrow(
          '[AuthService] Invalid GitHub profile: missing id'
        );
      });

      it('should throw error when email is missing', async () => {
        // Arrange
        const invalidProfile = createMockGitHubProfile({ email: undefined as any });

        // Act & Assert
        await expect(authService.handleGitHubSignIn(invalidProfile)).rejects.toThrow(
          '[AuthService] Invalid GitHub profile: missing email'
        );
      });

      it('should throw error when login is missing', async () => {
        // Arrange
        const invalidProfile = createMockGitHubProfile({ login: undefined as any });

        // Act & Assert
        await expect(authService.handleGitHubSignIn(invalidProfile)).rejects.toThrow(
          '[AuthService] Invalid GitHub profile: missing login'
        );
      });

      it('should throw error when avatar_url is missing', async () => {
        // Arrange
        const invalidProfile = createMockGitHubProfile({ avatar_url: undefined as any });

        // Act & Assert
        await expect(authService.handleGitHubSignIn(invalidProfile)).rejects.toThrow(
          '[AuthService] Invalid GitHub profile: missing avatar_url'
        );
      });

      it('should throw error for invalid email format', async () => {
        // Arrange
        const invalidProfile = createMockGitHubProfile({ email: 'not-an-email' });

        // Act & Assert
        await expect(authService.handleGitHubSignIn(invalidProfile)).rejects.toThrow(
          '[AuthService] Invalid email format from GitHub profile'
        );
      });
    });

    describe('Error Handling - Database Errors', () => {
      it('should propagate error when findByGitHubId fails', async () => {
        // Arrange
        const githubProfile = createMockGitHubProfile();
        const dbError = new Error('[UserRepository] Database connection failed');

        mockUserRepository.findByGitHubId.mockRejectedValue(dbError);

        // Act & Assert
        await expect(authService.handleGitHubSignIn(githubProfile)).rejects.toThrow(
          '[UserRepository] Database connection failed'
        );
      });

      it('should propagate error when createUser fails', async () => {
        // Arrange
        const githubProfile = createMockGitHubProfile();
        const dbError = new Error('[UserRepository] Failed to create user');

        mockUserRepository.findByGitHubId.mockResolvedValue(null);
        mockUserRepository.createUser.mockRejectedValue(dbError);

        // Act & Assert
        await expect(authService.handleGitHubSignIn(githubProfile)).rejects.toThrow(
          '[UserRepository] Failed to create user'
        );
      });
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when user exists', async () => {
      // Arrange
      const user = createMockUser();
      mockUserRepository.findById.mockResolvedValue(user);

      // Act
      const result = await authService.isAuthenticated(user.id);

      // Assert
      expect(result).toBe(true);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(user.id);
    });

    it('should return false when user does not exist', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(null);

      // Act
      const result = await authService.isAuthenticated('nonexistent-id');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when database error occurs', async () => {
      // Arrange
      mockUserRepository.findById.mockRejectedValue(new Error('DB error'));

      // Act
      const result = await authService.isAuthenticated('user-id');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('canAccessSellerFeatures', () => {
    it('should return true for sellers', async () => {
      // Arrange
      const seller = createMockSeller();
      mockUserRepository.findById.mockResolvedValue(seller);

      // Act
      const result = await authService.canAccessSellerFeatures(seller.id);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for non-sellers', async () => {
      // Arrange
      const buyer = createMockUser({ isSeller: false });
      mockUserRepository.findById.mockResolvedValue(buyer);

      // Act
      const result = await authService.canAccessSellerFeatures(buyer.id);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when user does not exist', async () => {
      // Arrange
      mockUserRepository.findById.mockResolvedValue(null);

      // Act
      const result = await authService.canAccessSellerFeatures('nonexistent-id');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('canCreateProject', () => {
    it('should return true for sellers', async () => {
      // Arrange
      const seller = createMockSeller();
      mockUserRepository.findById.mockResolvedValue(seller);

      // Act
      const result = await authService.canCreateProject(seller.id);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for non-sellers', async () => {
      // Arrange
      const buyer = createMockUser({ isSeller: false });
      mockUserRepository.findById.mockResolvedValue(buyer);

      // Act
      const result = await authService.canCreateProject(buyer.id);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('canPurchaseProject', () => {
    it('should return true for buyers', async () => {
      // Arrange
      const buyer = createMockUser({ isBuyer: true });
      mockUserRepository.findById.mockResolvedValue(buyer);

      // Act
      const result = await authService.canPurchaseProject(buyer.id);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for non-buyers', async () => {
      // Arrange
      const nonBuyer = createMockUser({ isBuyer: false });
      mockUserRepository.findById.mockResolvedValue(nonBuyer);

      // Act
      const result = await authService.canPurchaseProject(nonBuyer.id);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      // Arrange
      const user = createMockUser();
      mockUserRepository.updateUserProfile.mockResolvedValue(user);

      // Act
      await authService.updateLastLogin(user.id);

      // Assert
      expect(mockUserRepository.updateUserProfile).toHaveBeenCalledWith(user.id, {
        lastLogin: expect.any(Date),
      });
    });

    it('should not throw error when update fails', async () => {
      // Arrange
      mockUserRepository.updateUserProfile.mockRejectedValue(new Error('Update failed'));

      // Act & Assert - Should not throw
      await expect(authService.updateLastLogin('user-id')).resolves.not.toThrow();
    });
  });

  describe('Logging', () => {
    it('should log handleGitHubSignIn calls', async () => {
      // Arrange
      const console = mockConsole();
      const githubProfile = createMockGitHubProfile();
      mockUserRepository.findByGitHubId.mockResolvedValue(null);
      mockUserRepository.createUser.mockResolvedValue(createMockUser());

      // Act
      await authService.handleGitHubSignIn(githubProfile);

      // Assert
      expect(console.log).toHaveBeenCalledWith(
        '[AuthService] handleGitHubSignIn called:',
        expect.objectContaining({
          githubId: githubProfile.id,
          username: githubProfile.login,
        })
      );

      // Cleanup
      console.restore();
    });
  });
});
