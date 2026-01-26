/**
 * Vitest Global Setup
 *
 * Responsibilities:
 * - Configure testing environment
 * - Setup React Testing Library
 * - Add custom matchers
 * - Mock environment variables
 * - Setup global test utilities
 *
 * This file runs before all tests.
 */

import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Cleanup after each test
 * Automatically unmount React components
 */
afterEach(() => {
  cleanup();
});

/**
 * Mock environment variables for tests
 * Uses dedicated test database from docker-compose.test.yml
 */
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3011';
process.env.DATABASE_URL = 'postgresql://projectfinish_test:password_test@localhost:5445/projectfinish_test';
process.env.REDIS_URL = 'redis://localhost:6391';
process.env.AUTH_SECRET = 'test-secret-key-for-testing-only';
process.env.AUTH_GITHUB_ID = 'test-github-id';
process.env.AUTH_GITHUB_SECRET = 'test-github-secret';
process.env.NEXTAUTH_URL = 'http://localhost:3011';

/**
 * Mock Next.js router
 */
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

/**
 * Mock Next.js link
 */
vi.mock('next/link', () => ({
  default: ({ children }: { children: any }) => children,
}));

/**
 * Mock Next-Auth
 */
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: null,
    status: 'unauthenticated',
  })),
  signIn: vi.fn(),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: any }) => children,
}));

/**
 * Console error/warn suppression for expected errors in tests
 * Uncomment if you want to suppress console noise during tests
 */
// const originalError = console.error;
// const originalWarn = console.warn;
//
// beforeAll(() => {
//   console.error = (...args: any[]) => {
//     if (
//       typeof args[0] === 'string' &&
//       args[0].includes('Warning: ReactDOM.render')
//     ) {
//       return;
//     }
//     originalError.call(console, ...args);
//   };
//
//   console.warn = (...args: any[]) => {
//     if (
//       typeof args[0] === 'string' &&
//       args[0].includes('componentWillReceiveProps')
//     ) {
//       return;
//     }
//     originalWarn.call(console, ...args);
//   };
// });
//
// afterAll(() => {
//   console.error = originalError;
//   console.warn = originalWarn;
// });

console.log('[Vitest] Test environment setup complete');
