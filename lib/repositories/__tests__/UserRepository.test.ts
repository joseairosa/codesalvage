/**
 * UserRepository Unit Tests
 *
 * Test Coverage:
 * - CRUD operations (Create, Read, Update, Delete)
 * - Find operations (by ID, email, GitHub ID, username)
 * - Seller-specific operations
 * - Stripe account management
 * - Error handling
 * - Edge cases
 *
 * Testing Approach:
 * - Mock Prisma Client
 * - Test repository behavior in isolation
 * - Verify correct Prisma query construction
 * - Test error propagation
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { UserRepository } from '../UserRepository';
import { PrismaClient } from '@prisma/client';
import {
  createMockUser,
  createMockSeller,
  createMockAuthUserData,
} from '@/tests/utils/mock-data';

// Mock Prisma Client
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(),
}));

describe('UserRepository', () => {
  let userRepository: UserRepository;
  let mockPrismaClient: any;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Create mock Prisma Client with user methods
    mockPrismaClient = {
      user: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        findMany: vi.fn(),
      },
    };

    // Create UserRepository with mocked Prisma
    userRepository = new UserRepository(mockPrismaClient as PrismaClient);
  });

  describe('createUser', () => {
    it('should create a new user with correct data', async () => {
      // Arrange
      const userData = createMockAuthUserData();
      const expectedUser = createMockUser({
        email: userData.email,
        username: userData.username,
      });

      mockPrismaClient.user.create.mockResolvedValue(expectedUser);

      // Act
      const result = await userRepository.createUser(userData);

      // Assert
      expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
        data: {
          email: userData.email,
          username: userData.username,
          fullName: userData.fullName,
          bio: userData.bio,
          avatarUrl: userData.avatarUrl,
          githubId: userData.githubId,
          githubUsername: userData.githubUsername,
          githubAvatarUrl: userData.githubAvatarUrl,
          isSeller: false,
          isBuyer: true,
          lastLogin: expect.any(Date),
        },
      });
      expect(result).toEqual(expectedUser);
    });

    it('should default isSeller to false and isBuyer to true', async () => {
      // Arrange
      const userData = createMockAuthUserData();
      mockPrismaClient.user.create.mockResolvedValue(createMockUser());

      // Act
      await userRepository.createUser(userData);

      // Assert
      expect(mockPrismaClient.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isSeller: false,
          isBuyer: true,
        }),
      });
    });

    it('should throw error when email already exists', async () => {
      // Arrange
      const userData = createMockAuthUserData();
      const prismaError = new Error('Unique constraint failed on email');

      mockPrismaClient.user.create.mockRejectedValue(prismaError);

      // Act & Assert
      await expect(userRepository.createUser(userData)).rejects.toThrow(
        '[UserRepository] Failed to create user - email or username may already exist'
      );
    });

    it('should throw error when username already exists', async () => {
      // Arrange
      const userData = createMockAuthUserData();
      const prismaError = new Error('Unique constraint failed on username');

      mockPrismaClient.user.create.mockRejectedValue(prismaError);

      // Act & Assert
      await expect(userRepository.createUser(userData)).rejects.toThrow(
        '[UserRepository] Failed to create user - email or username may already exist'
      );
    });
  });

  describe('findById', () => {
    it('should find user by ID', async () => {
      // Arrange
      const user = createMockUser();
      mockPrismaClient.user.findUnique.mockResolvedValue(user);

      // Act
      const result = await userRepository.findById(user.id);

      // Assert
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { id: user.id },
      });
      expect(result).toEqual(user);
    });

    it('should return null when user not found', async () => {
      // Arrange
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await userRepository.findById('nonexistent-id');

      // Assert
      expect(result).toBeNull();
    });

    it('should throw error when database fails', async () => {
      // Arrange
      const dbError = new Error('Database connection lost');
      mockPrismaClient.user.findUnique.mockRejectedValue(dbError);

      // Act & Assert
      await expect(userRepository.findById('user-id')).rejects.toThrow(
        '[UserRepository] Failed to find user by ID'
      );
    });
  });

  describe('findByEmail', () => {
    it('should find user by email (lowercase)', async () => {
      // Arrange
      const user = createMockUser({ email: 'test@example.com' });
      mockPrismaClient.user.findUnique.mockResolvedValue(user);

      // Act
      const result = await userRepository.findByEmail('TEST@EXAMPLE.COM');

      // Assert
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toEqual(user);
    });

    it('should return null when user not found', async () => {
      // Arrange
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await userRepository.findByEmail('nonexistent@example.com');

      // Assert
      expect(result).toBeNull();
    });

    it('should throw error when database fails', async () => {
      // Arrange
      mockPrismaClient.user.findUnique.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(userRepository.findByEmail('test@example.com')).rejects.toThrow(
        '[UserRepository] Failed to find user by email'
      );
    });
  });

  describe('findByGitHubId', () => {
    it('should find user by GitHub ID', async () => {
      // Arrange
      const user = createMockUser({ githubId: '12345' });
      mockPrismaClient.user.findUnique.mockResolvedValue(user);

      // Act
      const result = await userRepository.findByGitHubId('12345');

      // Assert
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { githubId: '12345' },
      });
      expect(result).toEqual(user);
    });

    it('should return null when user not found', async () => {
      // Arrange
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await userRepository.findByGitHubId('nonexistent');

      // Assert
      expect(result).toBeNull();
    });

    it('should throw error when database fails', async () => {
      // Arrange
      mockPrismaClient.user.findUnique.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(userRepository.findByGitHubId('12345')).rejects.toThrow(
        '[UserRepository] Failed to find user by GitHub ID'
      );
    });
  });

  describe('findByUsername', () => {
    it('should find user by username (lowercase)', async () => {
      // Arrange
      const user = createMockUser({ username: 'testuser' });
      mockPrismaClient.user.findUnique.mockResolvedValue(user);

      // Act
      const result = await userRepository.findByUsername('TestUser');

      // Assert
      expect(mockPrismaClient.user.findUnique).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
      expect(result).toEqual(user);
    });

    it('should return null when user not found', async () => {
      // Arrange
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await userRepository.findByUsername('nonexistent');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile with provided data', async () => {
      // Arrange
      const userId = 'user-123';
      const updateData = {
        fullName: 'Updated Name',
        bio: 'Updated bio',
        lastLogin: new Date(),
      };
      const updatedUser = createMockUser({ ...updateData });

      mockPrismaClient.user.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userRepository.updateUserProfile(userId, updateData);

      // Assert
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: updateData,
      });
      expect(result).toEqual(updatedUser);
    });

    it('should update only provided fields (partial update)', async () => {
      // Arrange
      const userId = 'user-123';
      const partialUpdate = { bio: 'New bio only' };

      mockPrismaClient.user.update.mockResolvedValue(createMockUser());

      // Act
      await userRepository.updateUserProfile(userId, partialUpdate);

      // Assert
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: partialUpdate,
      });
    });

    it('should throw error when user not found', async () => {
      // Arrange
      const prismaError = new Error('Record not found');
      mockPrismaClient.user.update.mockRejectedValue(prismaError);

      // Act & Assert
      await expect(
        userRepository.updateUserProfile('nonexistent', { bio: 'test' })
      ).rejects.toThrow(
        '[UserRepository] Failed to update user profile - user may not exist'
      );
    });
  });

  describe('enableSellerMode', () => {
    it('should enable seller mode for user', async () => {
      // Arrange
      const userId = 'user-123';
      const sellerUser = createMockSeller();

      mockPrismaClient.user.update.mockResolvedValue(sellerUser);

      // Act
      const result = await userRepository.enableSellerMode(userId);

      // Assert
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { isSeller: true },
      });
      expect(result).toEqual(sellerUser);
    });
  });

  describe('updateStripeAccount', () => {
    it('should update Stripe account ID', async () => {
      // Arrange
      const userId = 'user-123';
      const stripeAccountId = 'acct_123456789';
      const updatedUser = createMockUser({ stripeAccountId });

      mockPrismaClient.user.update.mockResolvedValue(updatedUser);

      // Act
      const result = await userRepository.updateStripeAccount(userId, stripeAccountId);

      // Assert
      expect(mockPrismaClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { stripeAccountId },
      });
      expect(result).toEqual(updatedUser);
    });

    it('should throw error when update fails', async () => {
      // Arrange
      mockPrismaClient.user.update.mockRejectedValue(new Error('Update failed'));

      // Act & Assert
      await expect(
        userRepository.updateStripeAccount('user-123', 'acct_123')
      ).rejects.toThrow('[UserRepository] Failed to update Stripe account');
    });
  });

  describe('deleteUser', () => {
    it('should delete user by ID', async () => {
      // Arrange
      const userId = 'user-123';
      mockPrismaClient.user.delete.mockResolvedValue(createMockUser());

      // Act
      await userRepository.deleteUser(userId);

      // Assert
      expect(mockPrismaClient.user.delete).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('should throw error when user not found', async () => {
      // Arrange
      mockPrismaClient.user.delete.mockRejectedValue(new Error('Record not found'));

      // Act & Assert
      await expect(userRepository.deleteUser('nonexistent')).rejects.toThrow(
        '[UserRepository] Failed to delete user - may have related data'
      );
    });

    it('should throw error when user has related data (foreign key constraint)', async () => {
      // Arrange
      const fkError = new Error('Foreign key constraint failed');
      mockPrismaClient.user.delete.mockRejectedValue(fkError);

      // Act & Assert
      await expect(userRepository.deleteUser('user-123')).rejects.toThrow(
        '[UserRepository] Failed to delete user - may have related data'
      );
    });
  });

  describe('getAllSellers', () => {
    it('should get sellers with pagination', async () => {
      // Arrange
      const sellers = [createMockSeller(), createMockSeller()];
      mockPrismaClient.user.findMany.mockResolvedValue(sellers);

      // Act
      const result = await userRepository.getAllSellers(10, 0);

      // Assert
      expect(mockPrismaClient.user.findMany).toHaveBeenCalledWith({
        where: { isSeller: true },
        take: 10,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(sellers);
    });

    it('should use default pagination values', async () => {
      // Arrange
      mockPrismaClient.user.findMany.mockResolvedValue([]);

      // Act
      await userRepository.getAllSellers();

      // Assert
      expect(mockPrismaClient.user.findMany).toHaveBeenCalledWith({
        where: { isSeller: true },
        take: 20, // default limit
        skip: 0, // default offset
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle pagination offset', async () => {
      // Arrange
      mockPrismaClient.user.findMany.mockResolvedValue([]);

      // Act
      await userRepository.getAllSellers(10, 20);

      // Assert
      expect(mockPrismaClient.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
        })
      );
    });

    it('should throw error when database fails', async () => {
      // Arrange
      mockPrismaClient.user.findMany.mockRejectedValue(new Error('DB error'));

      // Act & Assert
      await expect(userRepository.getAllSellers()).rejects.toThrow(
        '[UserRepository] Failed to get sellers'
      );
    });
  });

  describe('getVerifiedSellers', () => {
    it('should get only verified sellers', async () => {
      // Arrange
      const verifiedSellers = [
        createMockSeller({ isVerifiedSeller: true }),
        createMockSeller({ isVerifiedSeller: true }),
      ];
      mockPrismaClient.user.findMany.mockResolvedValue(verifiedSellers);

      // Act
      const result = await userRepository.getVerifiedSellers(10, 0);

      // Assert
      expect(mockPrismaClient.user.findMany).toHaveBeenCalledWith({
        where: {
          isSeller: true,
          isVerifiedSeller: true,
        },
        take: 10,
        skip: 0,
        orderBy: { sellerVerificationDate: 'desc' },
      });
      expect(result).toEqual(verifiedSellers);
    });

    it('should order by verification date descending', async () => {
      // Arrange
      mockPrismaClient.user.findMany.mockResolvedValue([]);

      // Act
      await userRepository.getVerifiedSellers();

      // Assert
      expect(mockPrismaClient.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { sellerVerificationDate: 'desc' },
        })
      );
    });
  });

  describe('Logging', () => {
    it('should log createUser calls', async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'log');
      const userData = createMockAuthUserData();
      mockPrismaClient.user.create.mockResolvedValue(createMockUser());

      // Act
      await userRepository.createUser(userData);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        '[UserRepository] createUser called:',
        expect.objectContaining({
          email: userData.email,
          username: userData.username,
        })
      );

      consoleSpy.mockRestore();
    });

    it('should log successful user creation', async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'log');
      const userData = createMockAuthUserData();
      const user = createMockUser();
      mockPrismaClient.user.create.mockResolvedValue(user);

      // Act
      await userRepository.createUser(userData);

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        '[UserRepository] User created successfully:',
        user.id
      );

      consoleSpy.mockRestore();
    });
  });
});
