/**
 * UserRepository - User Data Access Layer
 *
 * Responsibilities:
 * - Handle ALL direct database interactions for User model
 * - Provide clean interface for user CRUD operations
 * - Abstract Prisma implementation details from business logic
 * - Handle database errors and return clean results
 *
 * Architecture:
 * - Repository Pattern (data access layer)
 * - Single Responsibility Principle (database operations only)
 * - Dependency injection (receives Prisma client)
 * - Returns domain models, not Prisma types
 *
 * @example
 * const userRepo = new UserRepository(prisma);
 * const user = await userRepo.findByEmail('user@example.com');
 */

import { PrismaClient, User } from '@prisma/client';
import type { AuthUserData } from '@/lib/services/AuthService';

/**
 * User profile update data
 */
export interface UserProfileUpdate {
  fullName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  githubUsername?: string | null;
  githubAvatarUrl?: string | null;
  lastLogin?: Date;
  isSeller?: boolean;
  isBuyer?: boolean;
  payoutMethod?: string | null;
  payoutEmail?: string | null;
}

/**
 * UserRepository class
 */
export class UserRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    console.log('[UserRepository] Initialized');
  }

  /**
   * Create new user account
   *
   * @param userData - User data from auth provider
   * @returns Created user record
   * @throws Error if email or username already exists
   *
   * @example
   * const user = await userRepo.createUser(authUserData);
   */
  async createUser(userData: AuthUserData): Promise<User> {
    console.log('[UserRepository] createUser called:', {
      email: userData.email,
      username: userData.username,
    });

    try {
      const user = await this.prisma.user.create({
        data: {
          email: userData.email,
          username: userData.username,
          fullName: userData.fullName,
          bio: userData.bio,
          avatarUrl: userData.avatarUrl,
          githubId: userData.githubId,
          githubUsername: userData.githubUsername,
          githubAvatarUrl: userData.githubAvatarUrl,
          isSeller: false, // Default to non-seller, user can enable later
          isBuyer: true, // All users can buy by default
          lastLogin: new Date(),
        },
      });

      console.log('[UserRepository] User created successfully:', user.id);
      return user;
    } catch (error) {
      console.error('[UserRepository] createUser failed:', error);
      throw new Error(
        '[UserRepository] Failed to create user - email or username may already exist'
      );
    }
  }

  /**
   * Find user by ID
   *
   * @param id - User ID (CUID)
   * @returns User record or null if not found
   *
   * @example
   * const user = await userRepo.findById('clfxyz123');
   */
  async findById(id: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        console.log('[UserRepository] User not found by ID:', id);
      }

      return user;
    } catch (error) {
      console.error('[UserRepository] findById failed:', error);
      throw new Error('[UserRepository] Failed to find user by ID');
    }
  }

  /**
   * Find user by email address
   *
   * @param email - User email (case-insensitive)
   * @returns User record or null if not found
   *
   * @example
   * const user = await userRepo.findByEmail('user@example.com');
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        console.log('[UserRepository] User not found by email:', email);
      }

      return user;
    } catch (error) {
      console.error('[UserRepository] findByEmail failed:', error);
      throw new Error('[UserRepository] Failed to find user by email');
    }
  }

  /**
   * Find user by GitHub ID
   *
   * @param githubId - GitHub user ID
   * @returns User record or null if not found
   *
   * @example
   * const user = await userRepo.findByGitHubId('12345678');
   */
  async findByGitHubId(githubId: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { githubId },
      });

      if (!user) {
        console.log('[UserRepository] User not found by GitHub ID:', githubId);
      }

      return user;
    } catch (error) {
      console.error('[UserRepository] findByGitHubId failed:', error);
      throw new Error('[UserRepository] Failed to find user by GitHub ID');
    }
  }

  /**
   * Find user by username
   *
   * @param username - Username (case-insensitive)
   * @returns User record or null if not found
   *
   * @example
   * const user = await userRepo.findByUsername('johndoe');
   */
  async findByUsername(username: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username: username.toLowerCase() },
      });

      if (!user) {
        console.log('[UserRepository] User not found by username:', username);
      }

      return user;
    } catch (error) {
      console.error('[UserRepository] findByUsername failed:', error);
      throw new Error('[UserRepository] Failed to find user by username');
    }
  }

  /**
   * Update user profile
   *
   * @param id - User ID
   * @param data - Profile data to update (partial)
   * @returns Updated user record
   * @throws Error if user not found
   *
   * @example
   * const user = await userRepo.updateUserProfile(userId, { bio: 'New bio' });
   */
  async updateUserProfile(id: string, data: UserProfileUpdate): Promise<User> {
    console.log('[UserRepository] updateUserProfile called:', {
      userId: id,
      fields: Object.keys(data),
    });

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data,
      });

      console.log('[UserRepository] User profile updated successfully:', id);
      return user;
    } catch (error) {
      console.error('[UserRepository] updateUserProfile failed:', error);
      throw new Error(
        '[UserRepository] Failed to update user profile - user may not exist'
      );
    }
  }

  /**
   * Enable seller mode for user
   *
   * @param id - User ID
   * @returns Updated user record
   * @throws Error if user not found
   *
   * @example
   * const user = await userRepo.enableSellerMode(userId);
   */
  async enableSellerMode(id: string): Promise<User> {
    console.log('[UserRepository] enableSellerMode called:', id);

    return await this.updateUserProfile(id, { isSeller: true });
  }

  /**
   * Update user's Stripe Connect account ID
   *
   * @param id - User ID
   * @param stripeAccountId - Stripe Connect account ID
   * @returns Updated user record
   * @throws Error if user not found
   *
   * @example
   * const user = await userRepo.updateStripeAccount(userId, 'acct_123');
   */
  async updateStripeAccount(id: string, stripeAccountId: string): Promise<User> {
    console.log('[UserRepository] updateStripeAccount called:', {
      userId: id,
      stripeAccountId,
    });

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: { stripeAccountId },
      });

      console.log('[UserRepository] Stripe account updated successfully:', id);
      return user;
    } catch (error) {
      console.error('[UserRepository] updateStripeAccount failed:', error);
      throw new Error('[UserRepository] Failed to update Stripe account');
    }
  }

  /**
   * Delete user account (soft delete - could be extended)
   *
   * IMPORTANT: This is a hard delete. Consider implementing soft delete
   * for production (add `deletedAt` field to schema).
   *
   * @param id - User ID to delete
   * @throws Error if user not found or has related data
   *
   * @example
   * await userRepo.deleteUser(userId);
   */
  async deleteUser(id: string): Promise<void> {
    console.log('[UserRepository] deleteUser called:', id);

    try {
      await this.prisma.user.delete({
        where: { id },
      });

      console.log('[UserRepository] User deleted successfully:', id);
    } catch (error) {
      console.error('[UserRepository] deleteUser failed:', error);
      throw new Error('[UserRepository] Failed to delete user - may have related data');
    }
  }

  /**
   * Get all sellers (for admin/listing purposes)
   *
   * @param limit - Maximum number of sellers to return
   * @param offset - Pagination offset
   * @returns Array of seller users
   *
   * @example
   * const sellers = await userRepo.getAllSellers(20, 0);
   */
  async getAllSellers(limit: number = 20, offset: number = 0): Promise<User[]> {
    try {
      const sellers = await this.prisma.user.findMany({
        where: { isSeller: true },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      });

      console.log('[UserRepository] Found sellers:', sellers.length);
      return sellers;
    } catch (error) {
      console.error('[UserRepository] getAllSellers failed:', error);
      throw new Error('[UserRepository] Failed to get sellers');
    }
  }

  /**
   * Get verified sellers only
   *
   * @param limit - Maximum number of sellers to return
   * @param offset - Pagination offset
   * @returns Array of verified seller users
   *
   * @example
   * const verifiedSellers = await userRepo.getVerifiedSellers(20, 0);
   */
  async getVerifiedSellers(limit: number = 20, offset: number = 0): Promise<User[]> {
    try {
      const sellers = await this.prisma.user.findMany({
        where: {
          isSeller: true,
          isVerifiedSeller: true,
        },
        take: limit,
        skip: offset,
        orderBy: { sellerVerificationDate: 'desc' },
      });

      console.log('[UserRepository] Found verified sellers:', sellers.length);
      return sellers;
    } catch (error) {
      console.error('[UserRepository] getVerifiedSellers failed:', error);
      throw new Error('[UserRepository] Failed to get verified sellers');
    }
  }
}
