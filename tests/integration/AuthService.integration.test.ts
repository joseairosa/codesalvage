/**
 * AuthService Integration Tests
 *
 * Tests authentication business logic with real database operations.
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
import { createTestUser, createTestSeller } from '@/tests/helpers/fixtures';
import { AuthService } from '@/lib/services/AuthService';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { prisma } from '@/lib/prisma';

describe('AuthService (Integration)', () => {
  let authService: AuthService;
  let userRepository: UserRepository;

  beforeAll(async () => {
    await setupTestDatabase();
    userRepository = new UserRepository(prisma);
    authService = new AuthService(userRepository);
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('handleGitHubSignIn', () => {
    it('should create new user on first GitHub sign-in', async () => {
      const githubProfile = {
        id: '12345',
        login: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        avatar_url: 'https://github.com/avatar.jpg',
      };

      const result = await authService.handleGitHubSignIn(githubProfile);

      expect(result.user).toBeDefined();
      expect(result.user.githubId).toBe('12345');
      expect(result.user.username).toBe('testuser');
      expect(result.user.email).toBe('test@example.com');
      expect(result.isNewUser).toBe(true);

      // Verify user exists in database
      const dbUser = await prisma.user.findUnique({
        where: { githubId: '12345' },
      });
      expect(dbUser).toBeTruthy();
    });

    it('should return existing user on subsequent sign-ins', async () => {
      const existingUser = await createTestUser({
        githubId: '67890',
        username: 'existinguser',
        email: 'existing@example.com',
      });

      const githubProfile = {
        id: '67890',
        login: 'existinguser',
        name: 'Existing User',
        email: 'existing@example.com',
        avatar_url: 'https://github.com/avatar.jpg',
      };

      const result = await authService.handleGitHubSignIn(githubProfile);

      expect(result.user.id).toBe(existingUser.id);
      expect(result.isNewUser).toBe(false);
    });

    it('should update GitHub profile data on sign-in', async () => {
      const user = await createTestUser({
        githubId: '99999',
        githubUsername: 'oldusername',
        githubAvatarUrl: 'https://old-avatar.jpg',
      });

      const githubProfile = {
        id: '99999',
        login: 'newusername',
        name: 'Updated Name',
        email: user.email!,
        avatar_url: 'https://new-avatar.jpg',
      };

      const result = await authService.handleGitHubSignIn(githubProfile);

      expect(result.user.githubUsername).toBe('newusername');
      expect(result.user.githubAvatarUrl).toBe('https://new-avatar.jpg');

      // Verify in database
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(dbUser?.githubUsername).toBe('newusername');
    });

    it('should handle username conflicts by appending number', async () => {
      // Create existing user with username
      await createTestUser({ username: 'testuser' });

      const githubProfile = {
        id: '11111',
        login: 'testuser',
        name: 'Test User',
        email: 'newuser@example.com',
        avatar_url: 'https://github.com/avatar.jpg',
      };

      const result = await authService.handleGitHubSignIn(githubProfile);

      expect(result.user.username).not.toBe('testuser');
      expect(result.user.username).toMatch(/^testuser\d+$/);
    });

    it('should update last login timestamp', async () => {
      const user = await createTestUser({
        githubId: '22222',
        lastLogin: new Date('2020-01-01'),
      });

      const githubProfile = {
        id: '22222',
        login: user.username!,
        name: user.fullName || 'Test',
        email: user.email!,
        avatar_url: user.githubAvatarUrl || '',
      };

      const result = await authService.handleGitHubSignIn(githubProfile);

      expect(result.user.lastLogin).not.toEqual(new Date('2020-01-01'));
      expect(result.user.lastLogin!.getTime()).toBeGreaterThan(
        new Date('2020-01-01').getTime()
      );
    });
  });

  describe('isAuthenticated', () => {
    it('should return true for existing user', async () => {
      const user = await createTestUser();
      const isAuth = await authService.isAuthenticated(user.id);
      expect(isAuth).toBe(true);
    });

    it('should return false for non-existent user', async () => {
      const isAuth = await authService.isAuthenticated('non-existent-id');
      expect(isAuth).toBe(false);
    });
  });

  describe('canAccessSellerFeatures', () => {
    it('should return true for verified sellers', async () => {
      const seller = await createTestSeller({ isVerifiedSeller: true });
      const canAccess = await authService.canAccessSellerFeatures(seller.id);
      expect(canAccess).toBe(true);
    });

    it('should return false for unverified sellers', async () => {
      const seller = await createTestSeller({ isVerifiedSeller: false });
      const canAccess = await authService.canAccessSellerFeatures(seller.id);
      expect(canAccess).toBe(false);
    });

    it('should return false for regular buyers', async () => {
      const buyer = await createTestUser({ isSeller: false });
      const canAccess = await authService.canAccessSellerFeatures(buyer.id);
      expect(canAccess).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      const canAccess = await authService.canAccessSellerFeatures('non-existent-id');
      expect(canAccess).toBe(false);
    });
  });

  describe('canCreateProject', () => {
    it('should return true for sellers', async () => {
      const seller = await createTestSeller();
      const canCreate = await authService.canCreateProject(seller.id);
      expect(canCreate).toBe(true);
    });

    it('should return false for buyers only', async () => {
      const buyer = await createTestUser({ isSeller: false });
      const canCreate = await authService.canCreateProject(buyer.id);
      expect(canCreate).toBe(false);
    });
  });

  describe('canPurchaseProject', () => {
    it('should return true for buyers', async () => {
      const buyer = await createTestUser({ isBuyer: true });
      const canPurchase = await authService.canPurchaseProject(buyer.id);
      expect(canPurchase).toBe(true);
    });

    it('should return true for sellers who are also buyers', async () => {
      const user = await createTestUser({ isSeller: true, isBuyer: true });
      const canPurchase = await authService.canPurchaseProject(user.id);
      expect(canPurchase).toBe(true);
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const user = await createTestUser({ lastLogin: null });

      await authService.updateLastLogin(user.id);

      const updated = await prisma.user.findUnique({
        where: { id: user.id },
      });

      expect(updated?.lastLogin).toBeDefined();
      expect(updated?.lastLogin).toBeInstanceOf(Date);
    });

    it('should update existing last login timestamp', async () => {
      const oldDate = new Date('2023-01-01');
      const user = await createTestUser({ lastLogin: oldDate });

      await new Promise((resolve) => setTimeout(resolve, 100));

      await authService.updateLastLogin(user.id);

      const updated = await prisma.user.findUnique({
        where: { id: user.id },
      });

      expect(updated?.lastLogin!.getTime()).toBeGreaterThan(oldDate.getTime());
    });

    it('should not throw error for non-existent user', async () => {
      await expect(authService.updateLastLogin('non-existent-id')).resolves.not.toThrow();
    });
  });

  describe('Role Management', () => {
    it('should distinguish between buyer and seller roles', async () => {
      const buyer = await createTestUser({ isBuyer: true, isSeller: false });
      const seller = await createTestSeller({ isVerifiedSeller: true });

      // Buyer permissions
      expect(await authService.canPurchaseProject(buyer.id)).toBe(true);
      expect(await authService.canCreateProject(buyer.id)).toBe(false);
      expect(await authService.canAccessSellerFeatures(buyer.id)).toBe(false);

      // Seller permissions
      expect(await authService.canPurchaseProject(seller.id)).toBe(true); // Sellers can also buy
      expect(await authService.canCreateProject(seller.id)).toBe(true);
      expect(await authService.canAccessSellerFeatures(seller.id)).toBe(true);
    });

    it('should support dual buyer/seller roles', async () => {
      const user = await createTestUser({
        isBuyer: true,
        isSeller: true,
        isVerifiedSeller: true,
      });

      expect(await authService.canPurchaseProject(user.id)).toBe(true);
      expect(await authService.canCreateProject(user.id)).toBe(true);
      expect(await authService.canAccessSellerFeatures(user.id)).toBe(true);
    });
  });
});
