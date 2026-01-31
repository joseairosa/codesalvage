/**
 * Verify Page Tests
 *
 * Tests the magic link verification page handles null Firebase auth gracefully.
 *
 * Same class of bug: `auth` is null when NEXT_PUBLIC_ env vars are missing
 * at build time, causing `isSignInWithEmailLink(null, ...)` to crash.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import VerifyPage from '../verify/page';

// Mock firebase/auth module
vi.mock('firebase/auth', () => ({
  isSignInWithEmailLink: vi.fn((auth: any) => {
    if (!auth) {
      throw new TypeError("Cannot read properties of null (reading 'app')");
    }
    return false;
  }),
  signInWithEmailLink: vi.fn(),
}));

// Track the mock value of auth
let mockAuth: any = null;

vi.mock('@/lib/firebase', () => ({
  get auth() {
    return mockAuth;
  },
}));

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

describe('VerifyPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth = null;
  });

  describe('when Firebase is not configured (auth is null)', () => {
    beforeEach(() => {
      mockAuth = null;
    });

    it('should render without crashing', () => {
      render(<VerifyPage />);
      // Should show error state, not crash
      expect(screen.getByText('Verification Failed')).toBeDefined();
    });

    it('should show configuration error message', async () => {
      render(<VerifyPage />);

      await waitFor(() => {
        expect(
          screen.getByText('Authentication is not configured. Please contact support.')
        ).toBeDefined();
      });
    });

    it('should not call isSignInWithEmailLink with null auth', async () => {
      const { isSignInWithEmailLink } = await import('firebase/auth');

      render(<VerifyPage />);

      await waitFor(() => {
        expect(screen.getByText('Verification Failed')).toBeDefined();
      });

      expect(isSignInWithEmailLink).not.toHaveBeenCalled();
    });

    it('should show Back to Sign In button', async () => {
      render(<VerifyPage />);

      await waitFor(() => {
        expect(screen.getByText('Back to Sign In')).toBeDefined();
      });
    });
  });

  describe('when Firebase is configured', () => {
    beforeEach(() => {
      mockAuth = { app: { name: 'test' } };
    });

    it('should call isSignInWithEmailLink with auth', async () => {
      const { isSignInWithEmailLink } = await import('firebase/auth');
      (isSignInWithEmailLink as any).mockReturnValue(false);

      render(<VerifyPage />);

      await waitFor(() => {
        expect(isSignInWithEmailLink).toHaveBeenCalledWith(mockAuth, expect.any(String));
      });
    });
  });
});
