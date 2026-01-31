/**
 * Sign Up Page Tests
 *
 * Tests the sign-up page handles null Firebase auth gracefully.
 *
 * Same class of bug as sign-in page: `auth` is null when NEXT_PUBLIC_
 * env vars are missing at build time, causing crashes on user interaction.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignUpPage from '../signup/page';

// Mock firebase/auth module
vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  GithubAuthProvider: vi.fn(),
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

describe('SignUpPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth = null;
  });

  describe('when Firebase is not configured (auth is null)', () => {
    beforeEach(() => {
      mockAuth = null;
    });

    it('should render without crashing', () => {
      render(<SignUpPage />);
      expect(screen.getByText('CodeSalvage')).toBeDefined();
    });

    it('should show error when clicking Sign up with GitHub', async () => {
      render(<SignUpPage />);
      await userEvent.click(screen.getByText('Sign up with GitHub'));

      await waitFor(() => {
        expect(
          screen.getByText('Authentication is not configured. Please contact support.')
        ).toBeDefined();
      });
    });

    it('should show error when clicking Sign up with Google', async () => {
      render(<SignUpPage />);
      await userEvent.click(screen.getByText('Sign up with Google'));

      await waitFor(() => {
        expect(
          screen.getByText('Authentication is not configured. Please contact support.')
        ).toBeDefined();
      });
    });

    it('should show error when submitting email/password form', async () => {
      render(<SignUpPage />);

      await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
      await userEvent.type(screen.getByLabelText('Password'), 'password123');
      await userEvent.type(screen.getByLabelText('Confirm Password'), 'password123');
      await userEvent.click(screen.getByText('Create Account'));

      await waitFor(() => {
        expect(
          screen.getByText('Authentication is not configured. Please contact support.')
        ).toBeDefined();
      });
    });

    it('should not call any Firebase auth functions', async () => {
      const { createUserWithEmailAndPassword, signInWithPopup } =
        await import('firebase/auth');

      render(<SignUpPage />);
      await userEvent.click(screen.getByText('Sign up with GitHub'));

      expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
      expect(signInWithPopup).not.toHaveBeenCalled();
    });
  });

  describe('when Firebase is configured', () => {
    beforeEach(() => {
      mockAuth = { app: { name: 'test' } };
    });

    it('should call signInWithPopup when clicking Sign up with GitHub', async () => {
      const { signInWithPopup } = await import('firebase/auth');
      (signInWithPopup as any).mockResolvedValue({ user: { uid: 'test-uid' } });

      render(<SignUpPage />);
      await userEvent.click(screen.getByText('Sign up with GitHub'));

      await waitFor(() => {
        expect(signInWithPopup).toHaveBeenCalledWith(mockAuth, expect.any(Object));
      });
    });
  });
});
