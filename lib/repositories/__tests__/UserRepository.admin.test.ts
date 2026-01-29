/**
 * UserRepository Admin Methods Tests
 *
 * Test suite for admin-specific UserRepository methods.
 *
 * Test Coverage:
 * - banUser()
 * - unbanUser()
 * - setAdminStatus()
 * - getAllUsers()
 * - countUsers()
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaClient, User } from '@prisma/client';
import { UserRepository } from '../UserRepository';

// Mock Prisma Client
const mockPrisma = {
  user: {
    update: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
} as unknown as PrismaClient;

describe('UserRepository - Admin Methods', () => {
  let userRepo: UserRepository;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create fresh instance
    userRepo = new UserRepository(mockPrisma);
  });

  describe('banUser()', () => {
    it('should ban a user with all required fields', async () => {
      // Arrange
      const userId = 'user123';
      const bannedBy = 'admin456';
      const reason = 'Spam violation - posted spam content repeatedly';

      const mockBannedUser: Partial<User> = {
        id: userId,
        email: 'user@test.com',
        username: 'testuser',
        isBanned: true,
        bannedAt: expect.any(Date),
        bannedBy,
        bannedReason: reason,
      };

      (mockPrisma.user.update as any).mockResolvedValue(mockBannedUser);

      // Act
      const result = await userRepo.banUser(userId, bannedBy, reason);

      // Assert
      expect(result).toEqual(mockBannedUser);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          isBanned: true,
          bannedAt: expect.any(Date),
          bannedBy,
          bannedReason: reason,
        },
      });
    });

    it('should throw error if user not found', async () => {
      // Arrange
      const userId = 'invalid';
      const bannedBy = 'admin123';
      const reason = 'Spam';

      (mockPrisma.user.update as any).mockRejectedValue(
        new Error('Record to update not found')
      );

      // Act & Assert
      await expect(userRepo.banUser(userId, bannedBy, reason)).rejects.toThrow(
        '[UserRepository] Failed to ban user - user may not exist'
      );
    });

    it('should throw error if database update fails', async () => {
      // Arrange
      (mockPrisma.user.update as any).mockRejectedValue(
        new Error('Connection timeout')
      );

      // Act & Assert
      await expect(
        userRepo.banUser('user123', 'admin123', 'Reason')
      ).rejects.toThrow('[UserRepository] Failed to ban user - user may not exist');
    });
  });

  describe('unbanUser()', () => {
    it('should unban a user and clear all ban fields', async () => {
      // Arrange
      const userId = 'user123';

      const mockUnbannedUser: Partial<User> = {
        id: userId,
        email: 'user@test.com',
        username: 'testuser',
        isBanned: false,
        bannedAt: null,
        bannedBy: null,
        bannedReason: null,
      };

      (mockPrisma.user.update as any).mockResolvedValue(mockUnbannedUser);

      // Act
      const result = await userRepo.unbanUser(userId);

      // Assert
      expect(result).toEqual(mockUnbannedUser);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          isBanned: false,
          bannedAt: null,
          bannedBy: null,
          bannedReason: null,
        },
      });
    });

    it('should throw error if user not found', async () => {
      // Arrange
      const userId = 'invalid';

      (mockPrisma.user.update as any).mockRejectedValue(
        new Error('Record to update not found')
      );

      // Act & Assert
      await expect(userRepo.unbanUser(userId)).rejects.toThrow(
        '[UserRepository] Failed to unban user - user may not exist'
      );
    });

    it('should succeed even if user was not banned', async () => {
      // Arrange
      const userId = 'user123';

      const mockUser: Partial<User> = {
        id: userId,
        email: 'user@test.com',
        isBanned: false,
        bannedAt: null,
        bannedBy: null,
        bannedReason: null,
      };

      (mockPrisma.user.update as any).mockResolvedValue(mockUser);

      // Act
      const result = await userRepo.unbanUser(userId);

      // Assert
      expect(result.isBanned).toBe(false);
      expect(result.bannedAt).toBeNull();
    });
  });

  describe('setAdminStatus()', () => {
    it('should grant admin privileges to a user', async () => {
      // Arrange
      const userId = 'user123';
      const isAdmin = true;

      const mockAdminUser: Partial<User> = {
        id: userId,
        email: 'user@test.com',
        username: 'testuser',
        isAdmin: true,
      };

      (mockPrisma.user.update as any).mockResolvedValue(mockAdminUser);

      // Act
      const result = await userRepo.setAdminStatus(userId, isAdmin);

      // Assert
      expect(result).toEqual(mockAdminUser);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { isAdmin: true },
      });
    });

    it('should revoke admin privileges from a user', async () => {
      // Arrange
      const userId = 'user123';
      const isAdmin = false;

      const mockRegularUser: Partial<User> = {
        id: userId,
        email: 'user@test.com',
        username: 'testuser',
        isAdmin: false,
      };

      (mockPrisma.user.update as any).mockResolvedValue(mockRegularUser);

      // Act
      const result = await userRepo.setAdminStatus(userId, isAdmin);

      // Assert
      expect(result.isAdmin).toBe(false);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { isAdmin: false },
      });
    });

    it('should throw error if user not found', async () => {
      // Arrange
      (mockPrisma.user.update as any).mockRejectedValue(
        new Error('Record to update not found')
      );

      // Act & Assert
      await expect(userRepo.setAdminStatus('invalid', true)).rejects.toThrow(
        '[UserRepository] Failed to update admin status - user may not exist'
      );
    });
  });

  describe('getAllUsers()', () => {
    it('should return all users with default pagination', async () => {
      // Arrange
      const mockUsers = [
        { id: 'user1', email: 'user1@test.com', username: 'user1' },
        { id: 'user2', email: 'user2@test.com', username: 'user2' },
      ];

      (mockPrisma.user.findMany as any).mockResolvedValue(mockUsers);

      // Act
      const result = await userRepo.getAllUsers();

      // Assert
      expect(result).toEqual(mockUsers);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {},
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter users by isBanned flag', async () => {
      // Arrange
      const mockBannedUsers = [
        { id: 'user1', email: 'banned@test.com', isBanned: true },
      ];

      (mockPrisma.user.findMany as any).mockResolvedValue(mockBannedUsers);

      // Act
      const result = await userRepo.getAllUsers({ isBanned: true });

      // Assert
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { isBanned: true },
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter users by isAdmin flag', async () => {
      // Arrange
      const mockAdmins = [
        { id: 'admin1', email: 'admin@test.com', isAdmin: true },
      ];

      (mockPrisma.user.findMany as any).mockResolvedValue(mockAdmins);

      // Act
      const result = await userRepo.getAllUsers({ isAdmin: true });

      // Assert
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { isAdmin: true },
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter users by isSeller flag', async () => {
      // Arrange
      const mockSellers = [
        { id: 'seller1', email: 'seller@test.com', isSeller: true },
      ];

      (mockPrisma.user.findMany as any).mockResolvedValue(mockSellers);

      // Act
      const result = await userRepo.getAllUsers({ isSeller: true });

      // Assert
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { isSeller: true },
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter users by isVerifiedSeller flag', async () => {
      // Arrange
      const mockVerifiedSellers = [
        {
          id: 'seller1',
          email: 'verified@test.com',
          isVerifiedSeller: true,
        },
      ];

      (mockPrisma.user.findMany as any).mockResolvedValue(mockVerifiedSellers);

      // Act
      const result = await userRepo.getAllUsers({ isVerifiedSeller: true });

      // Assert
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { isVerifiedSeller: true },
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should apply multiple filters simultaneously', async () => {
      // Arrange
      (mockPrisma.user.findMany as any).mockResolvedValue([]);

      // Act
      const result = await userRepo.getAllUsers({
        isBanned: false,
        isSeller: true,
        isVerifiedSeller: true,
      });

      // Assert
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          isBanned: false,
          isSeller: true,
          isVerifiedSeller: true,
        },
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should support custom pagination', async () => {
      // Arrange
      (mockPrisma.user.findMany as any).mockResolvedValue([]);

      // Act
      const result = await userRepo.getAllUsers({
        limit: 20,
        offset: 40,
      });

      // Assert
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {},
        take: 20,
        skip: 40,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should support custom sorting', async () => {
      // Arrange
      (mockPrisma.user.findMany as any).mockResolvedValue([]);

      // Act
      const result = await userRepo.getAllUsers({
        sortBy: 'email',
        sortOrder: 'asc',
      });

      // Assert
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {},
        take: 50,
        skip: 0,
        orderBy: { email: 'asc' },
      });
    });

    it('should throw error if query fails', async () => {
      // Arrange
      (mockPrisma.user.findMany as any).mockRejectedValue(
        new Error('Database error')
      );

      // Act & Assert
      await expect(userRepo.getAllUsers()).rejects.toThrow(
        '[UserRepository] Failed to get users'
      );
    });
  });

  describe('countUsers()', () => {
    it('should count all users when no filters provided', async () => {
      // Arrange
      (mockPrisma.user.count as any).mockResolvedValue(150);

      // Act
      const result = await userRepo.countUsers();

      // Assert
      expect(result).toBe(150);
      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: {},
      });
    });

    it('should count banned users', async () => {
      // Arrange
      (mockPrisma.user.count as any).mockResolvedValue(5);

      // Act
      const result = await userRepo.countUsers({ isBanned: true });

      // Assert
      expect(result).toBe(5);
      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: { isBanned: true },
      });
    });

    it('should count admin users', async () => {
      // Arrange
      (mockPrisma.user.count as any).mockResolvedValue(3);

      // Act
      const result = await userRepo.countUsers({ isAdmin: true });

      // Assert
      expect(result).toBe(3);
      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: { isAdmin: true },
      });
    });

    it('should count seller users', async () => {
      // Arrange
      (mockPrisma.user.count as any).mockResolvedValue(42);

      // Act
      const result = await userRepo.countUsers({ isSeller: true });

      // Assert
      expect(result).toBe(42);
      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: { isSeller: true },
      });
    });

    it('should count verified seller users', async () => {
      // Arrange
      (mockPrisma.user.count as any).mockResolvedValue(28);

      // Act
      const result = await userRepo.countUsers({ isVerifiedSeller: true });

      // Assert
      expect(result).toBe(28);
      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: { isVerifiedSeller: true },
      });
    });

    it('should apply multiple filters', async () => {
      // Arrange
      (mockPrisma.user.count as any).mockResolvedValue(12);

      // Act
      const result = await userRepo.countUsers({
        isBanned: false,
        isSeller: true,
        isVerifiedSeller: true,
      });

      // Assert
      expect(result).toBe(12);
      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: {
          isBanned: false,
          isSeller: true,
          isVerifiedSeller: true,
        },
      });
    });

    it('should return zero when no users match filters', async () => {
      // Arrange
      (mockPrisma.user.count as any).mockResolvedValue(0);

      // Act
      const result = await userRepo.countUsers({ isAdmin: true, isBanned: true });

      // Assert
      expect(result).toBe(0);
    });

    it('should throw error if count fails', async () => {
      // Arrange
      (mockPrisma.user.count as any).mockRejectedValue(
        new Error('Connection timeout')
      );

      // Act & Assert
      await expect(userRepo.countUsers()).rejects.toThrow(
        '[UserRepository] Failed to count users'
      );
    });
  });
});
