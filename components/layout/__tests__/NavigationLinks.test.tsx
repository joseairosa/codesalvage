import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NavigationLinks } from '../NavigationLinks';

let mockPathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement('a', { href, ...props }, children),
}));

describe('NavigationLinks', () => {
  describe('active state', () => {
    it('marks Dashboard active on exact /dashboard match', () => {
      mockPathname = '/dashboard';
      render(<NavigationLinks isAuthenticated={true} isSeller={false} />);
      const link = screen.getByRole('link', { name: 'Dashboard' });
      expect(link).toHaveAttribute('aria-current', 'page');
    });

    it('does not mark Dashboard active when on /dashboard/offers', () => {
      mockPathname = '/dashboard/offers';
      render(<NavigationLinks isAuthenticated={true} isSeller={false} />);
      const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
      expect(dashboardLink).not.toHaveAttribute('aria-current', 'page');
    });

    it('does not show My Offers in the top nav (moved to dashboard)', () => {
      mockPathname = '/dashboard/offers';
      render(<NavigationLinks isAuthenticated={true} isSeller={false} />);
      expect(screen.queryByRole('link', { name: 'My Offers' })).not.toBeInTheDocument();
    });

    it('marks Browse Projects active on /projects', () => {
      mockPathname = '/projects';
      render(<NavigationLinks isAuthenticated={false} isSeller={false} />);
      const link = screen.getByRole('link', { name: 'Browse Projects' });
      expect(link).toHaveAttribute('aria-current', 'page');
    });

    it('marks Browse Projects active on a sub-path like /projects/some-id', () => {
      mockPathname = '/projects/some-id';
      render(<NavigationLinks isAuthenticated={false} isSeller={false} />);
      const link = screen.getByRole('link', { name: 'Browse Projects' });
      expect(link).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('link visibility', () => {
    it('does not show My Purchases in the top nav (moved to dashboard)', () => {
      mockPathname = '/';
      render(<NavigationLinks isAuthenticated={true} isSeller={false} />);
      expect(
        screen.queryByRole('link', { name: 'My Purchases' })
      ).not.toBeInTheDocument();
    });

    it('does not show My Purchases for sellers in the top nav either', () => {
      mockPathname = '/';
      render(<NavigationLinks isAuthenticated={true} isSeller={true} />);
      expect(
        screen.queryByRole('link', { name: 'My Purchases' })
      ).not.toBeInTheDocument();
    });

    it('does not show My Purchases when unauthenticated', () => {
      mockPathname = '/';
      render(<NavigationLinks isAuthenticated={false} isSeller={false} />);
      expect(
        screen.queryByRole('link', { name: 'My Purchases' })
      ).not.toBeInTheDocument();
    });

    it('shows only Browse Projects, How It Works, and Dashboard when authenticated', () => {
      mockPathname = '/';
      render(<NavigationLinks isAuthenticated={true} isSeller={true} />);
      expect(screen.getByRole('link', { name: 'Browse Projects' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'How It Works' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
      expect(screen.getAllByRole('link')).toHaveLength(3);
    });

    it('shows only Browse Projects and How It Works when unauthenticated', () => {
      mockPathname = '/';
      render(<NavigationLinks isAuthenticated={false} isSeller={false} />);
      expect(screen.getByRole('link', { name: 'Browse Projects' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'How It Works' })).toBeInTheDocument();
      expect(screen.getAllByRole('link')).toHaveLength(2);
    });
  });
});
