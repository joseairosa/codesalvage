/**
 * Project Search Page Tests
 *
 * Tests for the project browse/search page (app/projects/page.tsx).
 *
 * Covers:
 * - Horizontal filter bar renders all filter controls (no sidebar)
 * - URL params initialize filter state on page load
 * - No "Apply Filters" or "Show/Hide Filters" buttons (removed in Task 2)
 * - Sort field value from URL param initializes select label correctly
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ProjectSearchPage from '../page';

// Hoisted so the factory closure can reference them
const { mockSearchParamsGet } = vi.hoisted(() => ({
  mockSearchParamsGet: vi.fn().mockReturnValue(null),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => ({
    get: mockSearchParamsGet,
  }),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) =>
    React.createElement('img', { src, alt, ...props }),
}));

// Mock Select to avoid Radix UI portal/state internals in jsdom
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, children }: { value: string; children: React.ReactNode }) =>
    React.createElement('div', { 'data-value': value }, children),
  SelectTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  SelectValue: ({ placeholder }: { placeholder?: string }) =>
    React.createElement('span', null, placeholder),
  SelectContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) =>
    React.createElement('button', { 'data-value': value }, children),
}));

// Mock Slider to avoid Radix UI pointer/resize internals in jsdom
vi.mock('@/components/ui/slider', () => ({
  Slider: ({
    min,
    max,
    value,
  }: {
    min: number;
    max: number;
    value: number[];
  }) =>
    React.createElement('div', {
      role: 'slider',
      'aria-valuemin': min,
      'aria-valuemax': max,
      'data-value': value?.join('-'),
    }),
}));

describe('ProjectSearchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsGet.mockReturnValue(null);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ projects: [], total: 0, page: 1, pages: 0 }),
    });
  });

  it('should render filter controls in horizontal bar', async () => {
    render(<ProjectSearchPage />);

    // Filter bar section labels
    await waitFor(() => {
      expect(screen.getByText('Category')).toBeInTheDocument();
    });
    expect(screen.getByText('Price')).toBeInTheDocument();
    expect(screen.getByText('Completion')).toBeInTheDocument();
    expect(screen.getByText('Tech Stack')).toBeInTheDocument();

    // Sort control in results header
    expect(screen.getByText('Sort by:')).toBeInTheDocument();

    // Tech stack badge pills rendered in filter bar
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
  });

  it('should not render Apply Filters button or Show/Hide Filters toggle', async () => {
    render(<ProjectSearchPage />);

    await waitFor(() => {
      expect(screen.getByText('Category')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', { name: /apply filters/i })
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /hide filters|show filters/i })
    ).toBeNull();
  });

  it('should initialize category filter from URL param', async () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      if (key === 'category') return 'web_app';
      return null;
    });

    render(<ProjectSearchPage />);

    // Active filters section shows the category badge
    await waitFor(() => {
      expect(screen.getByText('Active filters:')).toBeInTheDocument();
    });
    // "Web App" appears in active filter badge (and possibly in Select internals)
    const webAppEls = screen.getAllByText('Web App');
    expect(webAppEls.length).toBeGreaterThanOrEqual(1);
  });

  it('should initialize tech stack selection from URL param', async () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      if (key === 'techStack') return 'React,TypeScript';
      return null;
    });

    render(<ProjectSearchPage />);

    // Active filters section appears because selectedTechStack.length > 0
    await waitFor(() => {
      expect(screen.getByText('Active filters:')).toBeInTheDocument();
    });

    // Both selected stacks appear as active filter badges (in addition to the pill in the bar)
    const reactEls = screen.getAllByText('React');
    expect(reactEls.length).toBeGreaterThanOrEqual(2); // pill (filled) + active badge

    const tsEls = screen.getAllByText('TypeScript');
    expect(tsEls.length).toBeGreaterThanOrEqual(2);
  });

  it('should initialize sort value from URL param', async () => {
    mockSearchParamsGet.mockImplementation((key: string) => {
      if (key === 'sortBy') return 'priceCents-asc';
      return null;
    });

    render(<ProjectSearchPage />);

    // Sort select reflects URL-initialized value
    await waitFor(() => {
      expect(screen.getByText('Price: Low to High')).toBeInTheDocument();
    });
  });
});
