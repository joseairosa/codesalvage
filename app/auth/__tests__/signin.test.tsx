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

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  GithubAuthProvider: vi.fn(),
  sendSignInLinkToEmail: vi.fn(),
  onAuthStateChanged: vi.fn(() => vi.fn()),
}));

let mockAuth: any = null;

vi.mock('@/lib/firebase', () => ({
  get auth() {
    return mockAuth;
  },
}));

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
      render(<SignInPage />);

      expect(screen.getByText('CodeSalvage')).toBeDefined();
    });

    it('should show error when clicking Continue with GitHub', async () => {
      render(<SignInPage />);
      const githubButton = screen.getByText('Continue with GitHub');

      await userEvent.click(githubButton);

      await waitFor(() => {
        expect(
          screen.getByText('Authentication is not configured. Please contact support.')
        ).toBeDefined();
      });
    });

    it('should show error when clicking Continue with Google', async () => {
      render(<SignInPage />);
      const googleButton = screen.getByText('Continue with Google');

      await userEvent.click(googleButton);

      await waitFor(() => {
        expect(
          screen.getByText('Authentication is not configured. Please contact support.')
        ).toBeDefined();
      });
    });

    it('should show error when submitting email/password form', async () => {
      render(<SignInPage />);
      const emailInput = screen.getByLabelText('Email');
      const passwordInput = screen.getByLabelText('Password');
      const submitButton = screen.getByText('Sign in with Email');

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'password123');
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText('Authentication is not configured. Please contact support.')
        ).toBeDefined();
      });
    });

    it('should show error when sending magic link', async () => {
      render(<SignInPage />);
      const emailInput = screen.getByLabelText('Email');
      const magicLinkButton = screen.getByText('Send Magic Link');

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.click(magicLinkButton);

      await waitFor(() => {
        expect(
          screen.getByText('Authentication is not configured. Please contact support.')
        ).toBeDefined();
      });
    });

    it('should not call any Firebase auth functions', async () => {
      const { signInWithEmailAndPassword, signInWithPopup, sendSignInLinkToEmail } =
        await import('firebase/auth');

      render(<SignInPage />);

      await userEvent.click(screen.getByText('Continue with GitHub'));

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
      const { signInWithPopup } = await import('firebase/auth');
      (signInWithPopup as any).mockResolvedValue({
        user: { uid: 'test-uid', getIdToken: vi.fn().mockResolvedValue('mock-token') },
      });

      render(<SignInPage />);
      const githubButton = screen.getByText('Continue with GitHub');

      await userEvent.click(githubButton);

      await waitFor(() => {
        expect(signInWithPopup).toHaveBeenCalledWith(mockAuth, expect.any(Object));
      });
    });

    it('should call signInWithPopup when clicking Continue with Google', async () => {
      const { signInWithPopup } = await import('firebase/auth');
      (signInWithPopup as any).mockResolvedValue({
        user: { uid: 'test-uid', getIdToken: vi.fn().mockResolvedValue('mock-token') },
      });

      render(<SignInPage />);
      const googleButton = screen.getByText('Continue with Google');

      await userEvent.click(googleButton);

      await waitFor(() => {
        expect(signInWithPopup).toHaveBeenCalledWith(mockAuth, expect.any(Object));
      });
    });
  });
});
