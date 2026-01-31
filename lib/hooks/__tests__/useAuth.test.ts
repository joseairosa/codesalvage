/**
 * useAuth Hook Tests
 *
 * Tests the useAuth hook, specifically:
 * - Graceful handling when Firebase is not configured (auth is null)
 * - Loading state management
 * - Sign-out behavior with null auth
 *
 * These tests exist because a production crash occurred when Firebase
 * client SDK environment variables were missing at build time, causing
 * `auth` to be null. Calling `onAuthStateChanged(null, ...)` threw
 * "Cannot read properties of null (reading 'app')".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../useAuth';

// Track the mock value of auth
let mockAuth: any = null;
const mockPush = vi.fn();

// Mock firebase/auth module
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((auth: any, callback: any) => {
    if (!auth) {
      throw new TypeError("Cannot read properties of null (reading '_canInitEmulator')");
    }
    callback(null);
    return vi.fn(); // unsubscribe
  }),
  signOut: vi.fn(),
}));

// Mock the Firebase client module
vi.mock('@/lib/firebase', () => ({
  get auth() {
    return mockAuth;
  },
}));

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth = null;
    mockPush.mockClear();
  });

  describe('when Firebase is not configured (auth is null)', () => {
    it('should not crash and should set loading to false', async () => {
      // Arrange
      mockAuth = null;

      // Act
      const { result } = renderHook(() => useAuth());

      // Assert
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.user).toBeNull();
    });

    it('should not call onAuthStateChanged when auth is null', async () => {
      // Arrange
      mockAuth = null;
      const { onAuthStateChanged } = await import('firebase/auth');

      // Act
      renderHook(() => useAuth());

      // Assert
      await waitFor(() => {
        expect(onAuthStateChanged).not.toHaveBeenCalled();
      });
    });

    it('should handle sign-out gracefully when auth is null', async () => {
      // Arrange
      mockAuth = null;
      const { signOut: firebaseSignOut } = await import('firebase/auth');

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act - sign out should not throw (fetch will fail in jsdom, but it's caught)
      await act(async () => {
        await result.current.signOut();
      });

      // Assert - Firebase signOut should not be called with null auth
      expect(firebaseSignOut).not.toHaveBeenCalled();
    });
  });

  describe('when Firebase is configured', () => {
    it('should subscribe to auth state changes', async () => {
      // Arrange
      mockAuth = { app: { name: 'test' } };
      const { onAuthStateChanged } = await import('firebase/auth');

      // Act
      renderHook(() => useAuth());

      // Assert
      await waitFor(() => {
        expect(onAuthStateChanged).toHaveBeenCalledWith(mockAuth, expect.any(Function));
      });
    });
  });
});
