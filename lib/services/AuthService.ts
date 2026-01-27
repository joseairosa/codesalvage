/**
 * AuthService - Authentication Business Logic
 *
 * Responsibilities:
 * - Validate and transform OAuth provider profiles
 * - Handle user creation/update logic for authentication
 * - Manage authentication state and session data
 * - Validate authentication requirements
 *
 * Architecture:
 * - Service layer (business logic only)
 * - Does NOT directly interact with database (delegates to UserRepository)
 * - Follows Single Responsibility Principle
 * - Dependency injection for testability
 *
 * @example
 * const authService = new AuthService(userRepository);
 * const user = await authService.handleGitHubSignIn(profile);
 */

import type { UserRepository } from '@/lib/repositories/UserRepository';

/**
 * GitHub OAuth Profile (from Auth.js provider)
 */
export interface GitHubProfile {
  id: number;
  login: string;
  email: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
}

/**
 * User data for authentication (normalized across providers)
 */
export interface AuthUserData {
  email: string;
  username: string;
  fullName: string | null;
  bio: string | null;
  avatarUrl: string;
  githubId: string;
  githubUsername: string;
  githubAvatarUrl: string;
}

/**
 * AuthService class
 */
export class AuthService {
  private userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
    console.log('[AuthService] Initialized');
  }

  /**
   * Handle GitHub OAuth sign-in
   *
   * Validates GitHub profile and creates/updates user account
   *
   * @param profile - GitHub OAuth profile from Auth.js
   * @returns Object with user record and isNewUser flag
   * @throws Error if profile is invalid or database operation fails
   *
   * @example
   * const { user, isNewUser } = await authService.handleGitHubSignIn(githubProfile);
   */
  async handleGitHubSignIn(profile: GitHubProfile): Promise<{ user: any; isNewUser: boolean }> {
    console.log('[AuthService] handleGitHubSignIn called:', {
      githubId: profile.id,
      username: profile.login,
    });

    // Validate required fields
    this.validateGitHubProfile(profile);

    // Transform GitHub profile to AuthUserData
    const userData = this.transformGitHubProfile(profile);

    // Check if user exists by GitHub ID
    const existingUser = await this.userRepository.findByGitHubId(userData.githubId);

    if (existingUser) {
      console.log('[AuthService] Existing user found, updating profile');
      // Update user profile with latest GitHub data
      const user = await this.userRepository.updateUserProfile(existingUser.id, {
        fullName: userData.fullName,
        bio: userData.bio,
        avatarUrl: userData.avatarUrl,
        githubUsername: userData.githubUsername,
        githubAvatarUrl: userData.githubAvatarUrl,
        lastLogin: new Date(),
      });
      return { user, isNewUser: false };
    }

    console.log('[AuthService] New user, creating account');
    // Create new user account
    const user = await this.userRepository.createUser(userData);
    return { user, isNewUser: true };
  }

  /**
   * Validate GitHub profile has required fields
   *
   * @param profile - GitHub OAuth profile
   * @throws Error if required fields are missing
   */
  private validateGitHubProfile(profile: GitHubProfile): void {
    const requiredFields: (keyof GitHubProfile)[] = [
      'id',
      'login',
      'email',
      'avatar_url',
    ];

    for (const field of requiredFields) {
      if (!profile[field]) {
        throw new Error(`[AuthService] Invalid GitHub profile: missing ${field}`);
      }
    }

    // Validate email format
    if (!this.isValidEmail(profile.email)) {
      throw new Error('[AuthService] Invalid email format from GitHub profile');
    }

    console.log('[AuthService] GitHub profile validation passed');
  }

  /**
   * Transform GitHub profile to normalized AuthUserData
   *
   * @param profile - GitHub OAuth profile
   * @returns Normalized user data
   */
  private transformGitHubProfile(profile: GitHubProfile): AuthUserData {
    return {
      email: profile.email.toLowerCase(), // Normalize email to lowercase
      username: profile.login.toLowerCase(), // Normalize username to lowercase
      fullName: profile.name,
      bio: profile.bio,
      avatarUrl: profile.avatar_url,
      githubId: profile.id.toString(),
      githubUsername: profile.login,
      githubAvatarUrl: profile.avatar_url,
    };
  }

  /**
   * Validate email format using regex
   *
   * @param email - Email address to validate
   * @returns true if email is valid
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check if user is authenticated
   *
   * @param userId - User ID from session
   * @returns true if user exists and is active
   */
  async isAuthenticated(userId: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findById(userId);
      return !!user; // User exists
    } catch (error) {
      console.error('[AuthService] isAuthenticated failed:', error);
      return false;
    }
  }

  /**
   * Validate user can access seller features
   *
   * @param userId - User ID to check
   * @returns true if user is a verified seller
   */
  async canAccessSellerFeatures(userId: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return false;
      }

      return user.isSeller && user.isVerifiedSeller;
    } catch (error) {
      console.error('[AuthService] canAccessSellerFeatures failed:', error);
      return false;
    }
  }

  /**
   * Validate user can create projects (seller-only feature)
   *
   * @param userId - User ID to check
   * @returns true if user is a seller and can create projects
   */
  async canCreateProject(userId: string): Promise<boolean> {
    return await this.canAccessSellerFeatures(userId);
  }

  /**
   * Validate user can purchase projects (buyer feature)
   *
   * @param userId - User ID to check
   * @returns true if user is a buyer
   */
  async canPurchaseProject(userId: string): Promise<boolean> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return false;
      }

      return user.isBuyer;
    } catch (error) {
      console.error('[AuthService] canPurchaseProject failed:', error);
      return false;
    }
  }

  /**
   * Update user's last login timestamp
   *
   * @param userId - User ID to update
   */
  async updateLastLogin(userId: string): Promise<void> {
    try {
      await this.userRepository.updateUserProfile(userId, {
        lastLogin: new Date(),
      });
      console.log('[AuthService] Updated last login for user:', userId);
    } catch (error) {
      console.error('[AuthService] updateLastLogin failed:', error);
      // Don't throw - this is non-critical
    }
  }
}
