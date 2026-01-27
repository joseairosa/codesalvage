/**
 * UserRepository Integration Tests
 *
 * Tests actual database operations with real PostgreSQL test database.
 * These tests verify that database queries work correctly end-to-end.
 *
 * Prerequisites:
 * - Test database must be running: `npm run test:db:setup`
 * - Migrations must be applied to test database
 *
 * Pattern:
 * - beforeAll: Setup database connection
 * - beforeEach: Clean database for test isolation
 * - afterAll: Disconnect from database
 * - Tests use real database operations (not mocks)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, cleanDatabase } from '@/tests/helpers/db';
import { createTestUser } from '@/tests/helpers/fixtures';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { prisma } from '@/lib/prisma';

describe('UserRepository (Integration)', () => {
  let userRepository: UserRepository;

  // Setup test database connection before all tests
  beforeAll(async () => {
    await setupTestDatabase();
    userRepository = new UserRepository(prisma);
  });

  // Clean database before each test for isolation
  beforeEach(async () => {
    await cleanDatabase();
  });

  // Disconnect after all tests complete
  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('createUser', () => {
    it('should create user in database', async () => {
      const userData = {
        email: 'test@example.com',
        username: 'testuser',
        fullName: 'Test User',
        bio: null,
        avatarUrl: 'https://example.com/avatar.jpg',
        githubId: '12345',
        githubUsername: 'testuser',
        githubAvatarUrl: 'https://example.com/avatar.jpg',
      };

      const user = await userRepository.createUser(userData);

      // Verify user object
      expect(user.id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(user.username).toBe(userData.username);
      expect(user.fullName).toBe(userData.fullName);
      expect(user.githubId).toBe(userData.githubId);

      // Verify user exists in database
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(dbUser).toBeTruthy();
      expect(dbUser?.email).toBe(userData.email);
    });

    it('should throw error when email already exists', async () => {
      const email = 'duplicate@example.com';

      // Create first user
      await createTestUser({ email });

      // Attempt to create user with same email
      await expect(
        userRepository.createUser({
          email,
          username: 'differentuser',
          fullName: 'Different User',
          bio: null,
          avatarUrl: 'https://example.com/avatar.jpg',
          githubId: '67890',
          githubUsername: 'differentuser',
          githubAvatarUrl: 'https://example.com/avatar.jpg',
        })
      ).rejects.toThrow();
    });

    it('should handle username conflicts by appending number', async () => {
      const username = 'duplicateuser';

      // Create first user
      await createTestUser({ username });

      // Create user with same username - should append number
      const secondUser = await userRepository.createUser({
        email: 'different@example.com',
        username,
        fullName: 'Different User',
        bio: null,
        avatarUrl: 'https://example.com/avatar.jpg',
        githubId: '99999',
        githubUsername: username,
        githubAvatarUrl: 'https://example.com/avatar.jpg',
      });

      expect(secondUser.username).not.toBe(username);
      expect(secondUser.username).toMatch(/^duplicateuser\d+$/);
      expect(secondUser.email).toBe('different@example.com');
    });

    it('should create user with default values', async () => {
      const user = await userRepository.createUser({
        email: 'minimal@example.com',
        username: 'minimaluser',
        fullName: null,
        bio: null,
        avatarUrl: 'https://example.com/avatar.jpg',
        githubId: '11111',
        githubUsername: 'minimaluser',
        githubAvatarUrl: 'https://example.com/avatar.jpg',
      });

      expect(user.isBuyer).toBe(true);
      expect(user.isSeller).toBe(false);
      expect(user.isVerifiedSeller).toBe(false);
      expect(user.fullName).toBeNull();
      expect(user.bio).toBeNull();
    });
  });

  describe('findById', () => {
    it('should find existing user by id', async () => {
      const createdUser = await createTestUser();

      const foundUser = await userRepository.findById(createdUser.id);

      expect(foundUser).toBeTruthy();
      expect(foundUser?.id).toBe(createdUser.id);
      expect(foundUser?.email).toBe(createdUser.email);
    });

    it('should return null for non-existent user', async () => {
      const user = await userRepository.findById('non-existent-id');
      expect(user).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find existing user by email', async () => {
      const email = 'findme@example.com';
      const createdUser = await createTestUser({ email });

      const foundUser = await userRepository.findByEmail(email);

      expect(foundUser).toBeTruthy();
      expect(foundUser?.id).toBe(createdUser.id);
      expect(foundUser?.email).toBe(email);
    });

    it('should return null for non-existent email', async () => {
      const user = await userRepository.findByEmail('nonexistent@example.com');
      expect(user).toBeNull();
    });

    it('should be case-insensitive', async () => {
      const email = 'CaseSensitive@Example.COM';
      await createTestUser({ email: email.toLowerCase() });

      const foundUser = await userRepository.findByEmail(email);
      expect(foundUser).toBeTruthy();
    });
  });

  describe('findByGitHubId', () => {
    it('should find existing user by GitHub ID', async () => {
      const githubId = '987654321';
      const createdUser = await createTestUser({ githubId });

      const foundUser = await userRepository.findByGitHubId(githubId);

      expect(foundUser).toBeTruthy();
      expect(foundUser?.id).toBe(createdUser.id);
      expect(foundUser?.githubId).toBe(githubId);
    });

    it('should return null for non-existent GitHub ID', async () => {
      const user = await userRepository.findByGitHubId('non-existent-gh-id');
      expect(user).toBeNull();
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile fields', async () => {
      const user = await createTestUser();

      const updateData = {
        fullName: 'Updated Name',
        bio: 'Updated bio text',
      };

      const updatedUser = await userRepository.updateUserProfile(user.id, updateData);

      expect(updatedUser.fullName).toBe(updateData.fullName);
      expect(updatedUser.bio).toBe(updateData.bio);

      // Verify in database
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.fullName).toBe(updateData.fullName);
      expect(dbUser?.bio).toBe(updateData.bio);
    });

    it('should update seller status', async () => {
      const user = await createTestUser({ isSeller: false });

      const updatedUser = await userRepository.updateUserProfile(user.id, {
        isSeller: true,
      });

      expect(updatedUser.isSeller).toBe(true);
    });

    it('should throw error for non-existent user', async () => {
      await expect(
        userRepository.updateUserProfile('non-existent-id', {
          fullName: 'Test',
        })
      ).rejects.toThrow();
    });
  });

  describe('updateStripeAccount', () => {
    it('should update Stripe account ID', async () => {
      const user = await createTestUser();
      const stripeAccountId = 'acct_test123456';

      const updatedUser = await userRepository.updateStripeAccount(user.id, stripeAccountId);

      expect(updatedUser.stripeAccountId).toBe(stripeAccountId);

      // Verify in database
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.stripeAccountId).toBe(stripeAccountId);
    });
  });

  describe('deleteUser', () => {
    it('should delete user from database', async () => {
      const user = await createTestUser();

      await userRepository.deleteUser(user.id);

      // Verify user is deleted
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser).toBeNull();
    });

    it('should throw error for non-existent user', async () => {
      await expect(userRepository.deleteUser('non-existent-id')).rejects.toThrow();
    });
  });

  describe('getVerifiedSellers', () => {
    it('should return all verified sellers', async () => {
      // Create mix of users
      await createTestUser({ isSeller: false }); // Buyer only
      const seller1 = await createTestUser({ isSeller: true, isVerifiedSeller: true });
      const seller2 = await createTestUser({ isSeller: true, isVerifiedSeller: true });
      await createTestUser({ isSeller: true, isVerifiedSeller: false }); // Unverified seller

      const sellers = await userRepository.getVerifiedSellers();

      expect(sellers).toHaveLength(2);
      expect(sellers.map((s) => s.id)).toContain(seller1.id);
      expect(sellers.map((s) => s.id)).toContain(seller2.id);
      expect(sellers.every((s) => s.isVerifiedSeller)).toBe(true);
    });

    it('should return empty array when no sellers exist', async () => {
      await createTestUser({ isSeller: false });

      const sellers = await userRepository.getVerifiedSellers();
      expect(sellers).toHaveLength(0);
    });
  });

  describe('User Statistics', () => {
    it('should track user creation timestamps', async () => {
      const user = await createTestUser();

      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
      expect(user.createdAt.getTime()).toBeLessThanOrEqual(user.updatedAt.getTime());
    });

    it('should update updatedAt on profile update', async () => {
      const user = await createTestUser();
      const originalUpdatedAt = user.updatedAt;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      const updatedUser = await userRepository.updateUserProfile(user.id, {
        fullName: 'New Name',
      });

      expect(updatedUser.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});
