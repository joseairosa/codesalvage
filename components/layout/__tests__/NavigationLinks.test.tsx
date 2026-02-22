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

    it('marks My Offers active on /dashboard/offers', () => {
      mockPathname = '/dashboard/offers';
      render(<NavigationLinks isAuthenticated={true} isSeller={false} />);
      const offersLink = screen.getByRole('link', { name: 'My Offers' });
      expect(offersLink).toHaveAttribute('aria-current', 'page');
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
});
