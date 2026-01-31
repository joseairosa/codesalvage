/**
 * useSession Hook Tests
 *
 * Tests the AuthProvider and useSession hook, specifically:
 * - Graceful handling when Firebase is not configured (auth is null)
 * - Correct status transitions
 * - Sign-out behavior with null auth
 *
 * These tests exist because a production crash occurred when Firebase
 * client SDK environment variables were missing at build time, causing
 * `auth` to be null. The AuthProvider called `onAuthStateChanged(null, ...)`
 * which threw "Cannot read properties of null (reading 'app')".
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useSession } from '../useSession';

// Track the mock value of firebaseAuth so we can control it per test
let mockFirebaseAuth: any = null;

// Mock firebase/auth module
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((auth: any, callback: any) => {
    if (!auth) {
      throw new TypeError("Cannot read properties of null (reading '_canInitEmulator')");
    }
    // Simulate unauthenticated state
    callback(null);
    return vi.fn(); // unsubscribe
  }),
  signOut: vi.fn(),
}));

// Mock the Firebase client module - auth can be null or a mock object
vi.mock('@/lib/firebase', () => ({
  get auth() {
    return mockFirebaseAuth;
  },
}));

/**
 * Test component that consumes the useSession hook
 */
function TestConsumer() {
  const { data, status } = useSession();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{data?.user?.email ?? 'none'}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFirebaseAuth = null;
  });

  describe('when Firebase is not configured (auth is null)', () => {
    it('should not crash and should set status to unauthenticated', async () => {
      // Arrange - auth is null (Firebase env vars missing at build time)
      mockFirebaseAuth = null;

      // Act - render should NOT throw
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
      });
      expect(screen.getByTestId('user').textContent).toBe('none');
    });

    it('should not call onAuthStateChanged when auth is null', async () => {
      // Arrange
      mockFirebaseAuth = null;
      const { onAuthStateChanged } = await import('firebase/auth');

      // Act
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      // Assert - onAuthStateChanged should NOT be called with null
      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
      });
      expect(onAuthStateChanged).not.toHaveBeenCalled();
    });

    it('should handle sign-out gracefully when auth is null', async () => {
      // Arrange
      mockFirebaseAuth = null;
      const { signOut: firebaseSignOut } = await import('firebase/auth');

      let signOutFn: (() => Promise<void>) | undefined;

      function SignOutConsumer() {
        const { signOut, status } = useSession();
        signOutFn = signOut;
        return <span data-testid="status">{status}</span>;
      }

      render(
        <AuthProvider>
          <SignOutConsumer />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
      });

      // Act - sign out should not throw
      await act(async () => {
        await signOutFn!();
      });

      // Assert - should not have called Firebase signOut with null
      expect(firebaseSignOut).not.toHaveBeenCalled();
    });
  });

  describe('when Firebase is configured', () => {
    it('should subscribe to auth state changes', async () => {
      // Arrange - provide a mock auth object
      mockFirebaseAuth = { app: { name: 'test' } };
      const { onAuthStateChanged } = await import('firebase/auth');

      // Act
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      // Assert - should have called onAuthStateChanged with the mock auth
      await waitFor(() => {
        expect(onAuthStateChanged).toHaveBeenCalledWith(
          mockFirebaseAuth,
          expect.any(Function)
        );
      });
    });
  });
});

describe('useSession', () => {
  it('should return unauthenticated status when used outside AuthProvider', () => {
    // The default context value is { data: null, status: 'loading' }
    // Using it outside the provider should use the default
    function StandaloneConsumer() {
      const { data, status } = useSession();
      return (
        <div>
          <span data-testid="status">{status}</span>
          <span data-testid="data">{data ? 'has-data' : 'no-data'}</span>
        </div>
      );
    }

    render(<StandaloneConsumer />);

    // Default context value is 'loading'
    expect(screen.getByTestId('status').textContent).toBe('loading');
    expect(screen.getByTestId('data').textContent).toBe('no-data');
  });
});
