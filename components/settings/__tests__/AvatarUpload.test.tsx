/**
 * AvatarUpload Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AvatarUpload } from '../AvatarUpload';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('AvatarUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial render', () => {
    it('shows user initials when no avatar URL provided', () => {
      render(<AvatarUpload currentAvatarUrl={null} userInitials="JD" />);
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('shows avatar image when URL is provided', () => {
      render(
        <AvatarUpload
          currentAvatarUrl="https://r2.example.com/avatar.png"
          userInitials="JD"
        />
      );
      const img = screen.getByRole('img', { name: 'Profile avatar' });
      expect(img).toHaveAttribute('src', 'https://r2.example.com/avatar.png');
    });

    it('renders the Change photo button', () => {
      render(<AvatarUpload currentAvatarUrl={null} userInitials="AB" />);
      expect(screen.getByRole('button', { name: 'Change photo' })).toBeInTheDocument();
    });

    it('shows file type hint text', () => {
      render(<AvatarUpload currentAvatarUrl={null} userInitials="AB" />);
      expect(screen.getByText(/JPEG, PNG, or WebP/i)).toBeInTheDocument();
    });
  });

  describe('file validation', () => {
    it('shows error for invalid file type', async () => {
      render(<AvatarUpload currentAvatarUrl={null} userInitials="JD" />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/only jpeg, png, and webp/i)).toBeInTheDocument();
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('shows error for file exceeding 5MB', async () => {
      render(<AvatarUpload currentAvatarUrl={null} userInitials="JD" />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const largeContent = new Uint8Array(6 * 1024 * 1024); // 6MB
      const file = new File([largeContent], 'big.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/smaller than 5mb/i)).toBeInTheDocument();
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('successful upload', () => {
    it('updates displayed avatar after successful upload', async () => {
      const newAvatarUrl = 'https://r2.example.com/new-avatar.png';

      mockFetch
        // Step 1: presign
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            uploadUrl: 'https://r2.upload.com/presign',
            publicUrl: newAvatarUrl,
          }),
        })
        // Step 2: PUT to R2
        .mockResolvedValueOnce({ ok: true })
        // Step 3: save avatar URL
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ avatarUrl: newAvatarUrl }),
        });

      render(<AvatarUpload currentAvatarUrl={null} userInitials="JD" />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['img'], 'avatar.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        const img = screen.getByRole('img', { name: 'Profile avatar' });
        expect(img).toHaveAttribute('src', newAvatarUrl);
      });
    });
  });

  describe('upload error handling', () => {
    it('shows error when presign request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Upload service unavailable' }),
      });

      render(<AvatarUpload currentAvatarUrl={null} userInitials="JD" />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['img'], 'avatar.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/upload service unavailable/i)).toBeInTheDocument();
      });
    });

    it('shows error when R2 upload fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            uploadUrl: 'https://r2.upload.com/presign',
            publicUrl: 'https://r2.example.com/avatar.png',
          }),
        })
        .mockResolvedValueOnce({ ok: false }); // R2 PUT fails

      render(<AvatarUpload currentAvatarUrl={null} userInitials="JD" />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['img'], 'avatar.png', { type: 'image/png' });
      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/failed to upload image/i)).toBeInTheDocument();
      });
    });
  });
});
