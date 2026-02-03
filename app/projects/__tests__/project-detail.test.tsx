/**
 * Project Detail Page Tests
 *
 * Tests for the project detail page (/projects/[id]).
 *
 * Covers:
 * - Sticky sidebar has correct z-index and top offset (below nav)
 * - Contact Seller button navigates to correct messaging URL
 * - Loading and error states
 * - Project data rendering from API
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectDetailPage from '../[id]/page';

// Mock react-markdown to avoid ESM issues in test environment
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) =>
    React.createElement('div', { 'data-testid': 'markdown' }, children),
}));

// Mock ProBadge
vi.mock('@/components/seller/ProBadge', () => ({
  ProBadge: () => null,
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
}));

// Sample project data matching API response shape
const mockProject = {
  id: 'proj-123',
  title: 'Test Project',
  description: '# Test\nA test project description',
  category: 'web_app',
  completionPercentage: 85,
  priceCents: 12000,
  techStack: ['React', 'TypeScript', 'Node.js'],
  primaryLanguage: 'TypeScript',
  frameworks: ['Next.js', 'Express'],
  licenseType: 'mit',
  accessLevel: 'full',
  thumbnailImageUrl: null,
  screenshotUrls: [],
  githubUrl: 'https://github.com/test/repo',
  githubRepoName: 'test/repo',
  demoUrl: null,
  documentationUrl: null,
  demoVideoUrl: null,
  estimatedCompletionHours: 100,
  knownIssues: null,
  isFeatured: false,
  status: 'active',
  viewCount: 42,
  favoriteCount: 5,
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-20T00:00:00.000Z',
  seller: {
    id: 'seller-456',
    username: 'testseller',
    fullName: 'Test Seller',
    avatarUrl: null,
    isVerifiedSeller: true,
    subscription: {
      plan: 'pro',
      status: 'active',
    },
  },
};

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('should show loading spinner while fetching project', () => {
      // Mock fetch that never resolves
      global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;

      render(<ProjectDetailPage params={{ id: 'proj-123' }} />);

      expect(screen.getByText('Loading project...')).toBeDefined();
    });
  });

  describe('error state', () => {
    it('should show error message when project is not found (404)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }) as unknown as typeof fetch;

      render(<ProjectDetailPage params={{ id: 'nonexistent' }} />);

      await waitFor(() => {
        expect(screen.getByText('Project not found')).toBeDefined();
      });
    });

    it('should show generic error for non-404 failures', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }) as unknown as typeof fetch;

      render(<ProjectDetailPage params={{ id: 'proj-123' }} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load project')).toBeDefined();
      });
    });

    it('should show error when fetch throws', async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;

      render(<ProjectDetailPage params={{ id: 'proj-123' }} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load project')).toBeDefined();
      });
    });
  });

  describe('project data rendering', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockProject),
      }) as unknown as typeof fetch;
    });

    it('should render project title and price', async () => {
      render(<ProjectDetailPage params={{ id: 'proj-123' }} />);

      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeDefined();
        expect(screen.getByText('$120')).toBeDefined();
      });
    });

    it('should render seller information', async () => {
      render(<ProjectDetailPage params={{ id: 'proj-123' }} />);

      await waitFor(() => {
        expect(screen.getByText('@testseller')).toBeDefined();
      });
    });

    it('should render tech stack section', async () => {
      render(<ProjectDetailPage params={{ id: 'proj-123' }} />);

      await waitFor(() => {
        expect(screen.getByText('Tech Stack')).toBeDefined();
        expect(screen.getByText('Primary Language')).toBeDefined();
        // TypeScript appears multiple times (primary language + all technologies)
        expect(screen.getAllByText('TypeScript').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('React')).toBeDefined();
        expect(screen.getByText('Node.js')).toBeDefined();
      });
    });
  });

  describe('sticky sidebar positioning', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockProject),
      }) as unknown as typeof fetch;
    });

    it('should have sticky top-20 z-30 on purchase card (below 64px nav)', async () => {
      const { container } = render(<ProjectDetailPage params={{ id: 'proj-123' }} />);

      await waitFor(() => {
        expect(screen.getByText('$120')).toBeDefined();
      });

      // Find the sticky purchase card - it contains the price
      const stickyCard = container.querySelector('.sticky');
      expect(stickyCard).not.toBeNull();
      expect(stickyCard!.classList.contains('top-20')).toBe(true);
      expect(stickyCard!.classList.contains('z-30')).toBe(true);
      // Ensure it does NOT use top-4 (old value that caused overlap)
      expect(stickyCard!.classList.contains('top-4')).toBe(false);
    });
  });

  describe('Contact Seller navigation', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockProject),
      }) as unknown as typeof fetch;
    });

    it('should navigate to /messages/{sellerId}?projectId={projectId}', async () => {
      const user = userEvent.setup();
      render(<ProjectDetailPage params={{ id: 'proj-123' }} />);

      await waitFor(() => {
        expect(screen.getByText('Contact Seller')).toBeDefined();
      });

      await user.click(screen.getByText('Contact Seller'));

      expect(mockPush).toHaveBeenCalledWith('/messages/seller-456?projectId=proj-123');
    });

    it('should NOT navigate to /messages/new (old broken pattern)', async () => {
      const user = userEvent.setup();
      render(<ProjectDetailPage params={{ id: 'proj-123' }} />);

      await waitFor(() => {
        expect(screen.getByText('Contact Seller')).toBeDefined();
      });

      await user.click(screen.getByText('Contact Seller'));

      // Verify the old broken pattern is not used
      const calledUrl = mockPush.mock.calls[0]?.[0] as string;
      expect(calledUrl).not.toContain('/messages/new');
      expect(calledUrl).not.toContain('?seller=');
    });
  });

  describe('Buy Now navigation', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockProject),
      }) as unknown as typeof fetch;
    });

    it('should navigate to checkout page with project ID', async () => {
      const user = userEvent.setup();
      render(<ProjectDetailPage params={{ id: 'proj-123' }} />);

      await waitFor(() => {
        expect(screen.getByText('Buy Now')).toBeDefined();
      });

      await user.click(screen.getByText('Buy Now'));

      expect(mockPush).toHaveBeenCalledWith('/checkout/proj-123');
    });
  });
});
