/**
 * Mock Data Generators
 *
 * Responsibilities:
 * - Generate realistic mock data for tests
 * - Provide factory functions for domain entities
 * - Ensure type-safe test data
 * - DRY principle for test data
 *
 * Architecture:
 * - Factory pattern for creating test data
 * - Type-safe with TypeScript
 * - Matches Prisma schema types
 * - Reusable across all tests
 */

import { type User } from '@prisma/client';
import type { Session } from 'next-auth';
import type { GitHubProfile, AuthUserData } from '@/lib/services/AuthService';
import { vi } from 'vitest';

/**
 * Counter for generating unique IDs in tests
 */
let idCounter = 0;

/**
 * Generate unique test ID
 */
export function generateTestId(prefix: string = 'test'): string {
  idCounter += 1;
  return `${prefix}_${idCounter}_${Date.now()}`;
}

/**
 * Reset ID counter (call in beforeEach if needed)
 */
export function resetIdCounter(): void {
  idCounter = 0;
}

/**
 * Create mock User
 */
export function createMockUser(overrides?: Partial<User>): User {
  const id = generateTestId('user');
  return {
    id,
    email: `user${id}@example.com`,
    emailVerified: null,
    username: `user${id}`,
    fullName: 'Test User',
    bio: null,
    avatarUrl: 'https://example.com/avatar.jpg',
    isSeller: false,
    isBuyer: true,
    githubId: null,
    githubUsername: null,
    githubAvatarUrl: null,
    payoutMethod: null,
    payoutEmail: null,
    stripeAccountId: null,
    taxId: null,
    isVerifiedSeller: false,
    sellerVerificationDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLogin: new Date(),
    ...overrides,
  };
}

/**
 * Create mock Seller User
 */
export function createMockSeller(overrides?: Partial<User>): User {
  return createMockUser({
    isSeller: true,
    isVerifiedSeller: true,
    payoutMethod: 'stripe',
    payoutEmail: 'seller@example.com',
    stripeAccountId: 'acct_test123',
    ...overrides,
  });
}

/**
 * Create mock Verified Seller
 */
export function createMockVerifiedSeller(overrides?: Partial<User>): User {
  return createMockSeller({
    isVerifiedSeller: true,
    sellerVerificationDate: new Date(),
    ...overrides,
  });
}

/**
 * Create mock Session
 */
export function createMockSession(user?: Partial<User>): Session {
  const mockUser = createMockUser(user);

  return {
    user: {
      id: mockUser.id,
      name: mockUser.fullName,
      email: mockUser.email!,
      image: mockUser.avatarUrl,
      username: mockUser.username,
      isSeller: mockUser.isSeller,
      isVerifiedSeller: mockUser.isVerifiedSeller,
    },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  };
}

/**
 * Create mock Seller Session
 */
export function createMockSellerSession(user?: Partial<User>): Session {
  return createMockSession({
    isSeller: true,
    payoutMethod: 'stripe',
    ...user,
  });
}

/**
 * Create mock GitHub Profile (from OAuth)
 */
export function createMockGitHubProfile(
  overrides?: Partial<GitHubProfile>
): GitHubProfile {
  const id = Math.floor(Math.random() * 1000000);
  return {
    id,
    login: `githubuser${id}`,
    email: `github${id}@example.com`,
    name: 'GitHub Test User',
    avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
    bio: 'Test bio from GitHub',
    ...overrides,
  };
}

/**
 * Create mock AuthUserData (transformed from GitHub)
 */
export function createMockAuthUserData(overrides?: Partial<AuthUserData>): AuthUserData {
  const githubProfile = createMockGitHubProfile();
  return {
    email: githubProfile.email.toLowerCase(),
    username: githubProfile.login.toLowerCase(),
    fullName: githubProfile.name,
    bio: githubProfile.bio,
    avatarUrl: githubProfile.avatar_url,
    githubId: githubProfile.id.toString(),
    githubUsername: githubProfile.login,
    githubAvatarUrl: githubProfile.avatar_url,
    ...overrides,
  };
}

/**
 * Create mock Prisma Client response
 * Useful for mocking repository responses
 */
export function createMockPrismaResponse<T>(data: T): Promise<T> {
  return Promise.resolve(data);
}

/**
 * Create mock error for testing error handling
 */
export function createMockError(message: string = 'Test error'): Error {
  return new Error(message);
}

/**
 * Wait for async operations (useful in tests)
 */
export function wait(ms: number = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock console methods (useful for suppressing expected errors)
 */
export function mockConsole() {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };

  const mockLog = vi.fn();
  const mockError = vi.fn();
  const mockWarn = vi.fn();
  const mockInfo = vi.fn();

  console.log = mockLog;
  console.error = mockError;
  console.warn = mockWarn;
  console.info = mockInfo;

  return {
    log: mockLog,
    error: mockError,
    warn: mockWarn,
    info: mockInfo,
    restore: () => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
    },
  };
}
