/**
 * Sign In Page Tests
 *
 * Tests the sign-in page handles null Firebase auth gracefully.
 *
 * These tests exist because a production crash occurred when clicking
 * "Continue with GitHub" on the deployed site. The Firebase `auth` export
 * was null (NEXT_PUBLIC_ env vars missing at build time), causing
 * `signInWithPopup(null, provider)` to throw
 * "Cannot read properties of null (reading 'app')".
 *
 * The fix adds null guards that show a user-friendly error message.
 * These tests verify the guards work correctly.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignInPage from '../signin/page';

// Mock firebase/auth module
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  GithubAuthProvider: vi.fn(),
  sendSignInLinkToEmail: vi.fn(),
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

describe('SignInPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth = null;
  });

  describe('when Firebase is not configured (auth is null)', () => {
    beforeEach(() => {
      mockAuth = null;
    });

    it('should render without crashing', () => {
      // Act - should NOT throw
      render(<SignInPage />);

      // Assert - page renders
      expect(screen.getByText('CodeSalvage')).toBeDefined();
    });

    it('should show error when clicking Continue with GitHub', async () => {
      // Arrange
      render(<SignInPage />);
      const githubButton = screen.getByText('Continue with GitHub');

      // Act
      await userEvent.click(githubButton);

      // Assert
      await waitFor(() => {
        expect(
          screen.getByText('Authentication is not configured. Please contact support.')
        ).toBeDefined();
      });
    });

    it('should show error when clicking Continue with Google', async () => {
      // Arrange
      render(<SignInPage />);
      const googleButton = screen.getByText('Continue with Google');

      // Act
      await userEvent.click(googleButton);

      // Assert
      await waitFor(() => {
        expect(
          screen.getByText('Authentication is not configured. Please contact support.')
        ).toBeDefined();
      });
    });

    it('should show error when submitting email/password form', async () => {
      // Arrange
      render(<SignInPage />);
      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByText('Sign in with Email');

      // Act
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'password123');
      await userEvent.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(
          screen.getByText('Authentication is not configured. Please contact support.')
        ).toBeDefined();
      });
    });

    it('should show error when sending magic link', async () => {
      // Arrange
      render(<SignInPage />);
      const emailInput = screen.getByLabelText('Email');
      const magicLinkButton = screen.getByText('Send Magic Link');

      // Act - fill email first (magic link button is disabled without email)
      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(magicLinkButton);

      // Assert
      await waitFor(() => {
        expect(
          screen.getByText('Authentication is not configured. Please contact support.')
        ).toBeDefined();
      });
    });

    it('should not call any Firebase auth functions', async () => {
      // Arrange
      const { signInWithEmailAndPassword, signInWithPopup, sendSignInLinkToEmail } =
        await import('firebase/auth');

      render(<SignInPage />);

      // Act - click all buttons
      await userEvent.click(screen.getByText('Continue with GitHub'));

      // Assert - no Firebase functions called
      expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
      expect(signInWithPopup).not.toHaveBeenCalled();
      expect(sendSignInLinkToEmail).not.toHaveBeenCalled();
    });
  });

  describe('when Firebase is configured', () => {
    beforeEach(() => {
      mockAuth = { app: { name: 'test' } };
    });

    it('should call signInWithPopup when clicking Continue with GitHub', async () => {
      // Arrange
      const { signInWithPopup } = await import('firebase/auth');
      (signInWithPopup as any).mockResolvedValue({
        user: { uid: 'test-uid', getIdToken: vi.fn().mockResolvedValue('mock-token') },
      });

      render(<SignInPage />);
      const githubButton = screen.getByText('Continue with GitHub');

      // Act
      await userEvent.click(githubButton);

      // Assert
      await waitFor(() => {
        expect(signInWithPopup).toHaveBeenCalledWith(mockAuth, expect.any(Object));
      });
    });

    it('should call signInWithPopup when clicking Continue with Google', async () => {
      // Arrange
      const { signInWithPopup } = await import('firebase/auth');
      (signInWithPopup as any).mockResolvedValue({
        user: { uid: 'test-uid', getIdToken: vi.fn().mockResolvedValue('mock-token') },
      });

      render(<SignInPage />);
      const googleButton = screen.getByText('Continue with Google');

      // Act
      await userEvent.click(googleButton);

      // Assert
      await waitFor(() => {
        expect(signInWithPopup).toHaveBeenCalledWith(mockAuth, expect.any(Object));
      });
    });
  });
});
