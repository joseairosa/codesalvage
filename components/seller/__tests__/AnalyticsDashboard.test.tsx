/**
 * AnalyticsDashboard Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));

vi.stubGlobal('fetch', mockFetch);

// Mock recharts (dynamic imports not resolved in jsdom)
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Line: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('next/dynamic', () => ({
  default: (fn: any) => {
    const Component = React.lazy(fn);
    return (props: any) => (
      <React.Suspense fallback={null}>
        <Component {...props} />
      </React.Suspense>
    );
  },
}));

const makeAnalyticsResponse = (overrides = {}) => ({
  userId: 'user-1',
  summary: {
    totalProjects: 3,
    totalSold: 2,
    totalRevenue: 20000,
    averageRevenue: 10000,
    totalViews: 400,
    totalFavorites: 15,
    conversionRate: 0.05, // 5% — stored as decimal
  },
  revenueOverTime: [],
  viewsOverTime: [],
  topProjects: [],
  ...overrides,
});

import { AnalyticsDashboard } from '../AnalyticsDashboard';

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays conversion rate as a percentage (multiplied by 100)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        makeAnalyticsResponse({
          summary: {
            conversionRate: 0.05,
            totalProjects: 3,
            totalSold: 2,
            totalRevenue: 20000,
            averageRevenue: 10000,
            totalViews: 400,
            totalFavorites: 15,
          },
        }),
    });

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('5.0%')).toBeInTheDocument();
    });
  });

  it('displays zero conversion rate correctly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () =>
        makeAnalyticsResponse({
          summary: {
            conversionRate: 0,
            totalProjects: 1,
            totalSold: 0,
            totalRevenue: 0,
            averageRevenue: 5000,
            totalViews: 100,
            totalFavorites: 5,
          },
        }),
    });

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });
  });

  it('shows error state when API fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Unauthorized' }),
    });

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    });
  });

  it('renders summary stat cards', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => makeAnalyticsResponse(),
    });

    render(<AnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Revenue')).toBeInTheDocument();
      expect(screen.getByText('Total Views')).toBeInTheDocument();
      expect(screen.getByText('Conversion Rate')).toBeInTheDocument();
    });
  });
});
