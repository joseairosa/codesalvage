/**
 * Seller Projects Page Tests
 *
 * Tests for the seller dashboard project listing page.
 *
 * Covers:
 * - Status badge colors: each status gets a distinct color class
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SellerProjectsPage from '../page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('@/lib/hooks/useSession', () => ({
  useSession: () => ({
    data: { user: { id: 'user-123', name: 'Test Seller' } },
    status: 'authenticated',
  }),
}));

const mockProjects = [
  {
    id: 'p1',
    title: 'Draft Project',
    category: 'web_app',
    status: 'draft',
    completionPercentage: 60,
    priceCents: 10000,
    viewCount: 0,
    favoriteCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'p2',
    title: 'Active Project',
    category: 'web_app',
    status: 'active',
    completionPercentage: 80,
    priceCents: 50000,
    viewCount: 10,
    favoriteCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'p3',
    title: 'Sold Project',
    category: 'web_app',
    status: 'sold',
    completionPercentage: 85,
    priceCents: 75000,
    viewCount: 50,
    favoriteCount: 8,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'p4',
    title: 'Delisted Project',
    category: 'web_app',
    status: 'delisted',
    completionPercentage: 70,
    priceCents: 30000,
    viewCount: 5,
    favoriteCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z',
  },
];

describe('SellerProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ projects: mockProjects, total: mockProjects.length }),
    }) as unknown as typeof fetch;
  });

  describe('status badge colors', () => {
    it('should render all four project statuses', async () => {
      render(<SellerProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Draft Project')).toBeDefined();
      });

      expect(screen.getByText('Draft')).toBeDefined();
      expect(screen.getByText('Active')).toBeDefined();
      expect(screen.getByText('Sold')).toBeDefined();
      expect(screen.getByText('Delisted')).toBeDefined();
    });

    it('should apply blue classes to Sold badge', async () => {
      render(<SellerProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Sold')).toBeDefined();
      });

      const soldBadge = screen.getByText('Sold');
      expect(soldBadge.className).toContain('bg-blue-100');
      expect(soldBadge.className).toContain('text-blue-700');
    });

    it('should apply green classes to Active badge', async () => {
      render(<SellerProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeDefined();
      });

      const activeBadge = screen.getByText('Active');
      expect(activeBadge.className).toContain('bg-green-100');
      expect(activeBadge.className).toContain('text-green-700');
    });

    it('should apply slate classes to Draft badge', async () => {
      render(<SellerProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Draft')).toBeDefined();
      });

      const draftBadge = screen.getByText('Draft');
      expect(draftBadge.className).toContain('bg-slate-100');
      expect(draftBadge.className).toContain('text-slate-600');
    });

    it('should apply red classes to Delisted badge', async () => {
      render(<SellerProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Delisted')).toBeDefined();
      });

      const delistedBadge = screen.getByText('Delisted');
      expect(delistedBadge.className).toContain('bg-red-100');
      expect(delistedBadge.className).toContain('text-red-700');
    });

    it('should give each status a distinct color (no two statuses share the same background class)', async () => {
      render(<SellerProjectsPage />);

      await waitFor(() => {
        expect(screen.getByText('Sold')).toBeDefined();
      });

      const soldClass = screen.getByText('Sold').className;
      const activeClass = screen.getByText('Active').className;
      const draftClass = screen.getByText('Draft').className;
      const delistedClass = screen.getByText('Delisted').className;

      const bgClasses = [soldClass, activeClass, draftClass, delistedClass].map(
        (cls) => cls.match(/bg-\w+-100/)?.[0]
      );
      const uniqueBgClasses = new Set(bgClasses);
      expect(uniqueBgClasses.size).toBe(4);
    });
  });
});
