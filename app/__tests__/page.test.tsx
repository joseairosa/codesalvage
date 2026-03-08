/**
 * Homepage Tests
 *
 * Covers:
 * - Renders live stats from DB (project count, transaction count, avg rating)
 * - Shows "—" when no reviews exist
 * - Hero and CTA sections render correctly
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '../page';

const { mockProjectCount, mockTransactionCount, mockReviewAggregate } = vi.hoisted(
  () => ({
    mockProjectCount: vi.fn(),
    mockTransactionCount: vi.fn(),
    mockReviewAggregate: vi.fn(),
  })
);

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: { count: mockProjectCount },
    transaction: { count: mockTransactionCount },
    review: { aggregate: mockReviewAggregate },
  },
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement('img', { src, alt }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href }, children),
}));

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders live project count and transaction count', async () => {
    mockProjectCount.mockResolvedValue(42);
    mockTransactionCount.mockResolvedValue(17);
    mockReviewAggregate.mockResolvedValue({ _avg: { overallRating: 4.75 } });

    render(await HomePage());

    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('17')).toBeInTheDocument();
    expect(screen.getByText('4.8★')).toBeInTheDocument();
  });

  it('shows "—" when there are no reviews', async () => {
    mockProjectCount.mockResolvedValue(5);
    mockTransactionCount.mockResolvedValue(2);
    mockReviewAggregate.mockResolvedValue({ _avg: { overallRating: null } });

    render(await HomePage());

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Average Rating')).toBeInTheDocument();
  });

  it('queries projects with active and sold status', async () => {
    mockProjectCount.mockResolvedValue(0);
    mockTransactionCount.mockResolvedValue(0);
    mockReviewAggregate.mockResolvedValue({ _avg: { overallRating: null } });

    render(await HomePage());

    expect(mockProjectCount).toHaveBeenCalledWith({
      where: { status: { in: ['active', 'sold'] } },
    });
  });

  it('queries only succeeded transactions', async () => {
    mockProjectCount.mockResolvedValue(0);
    mockTransactionCount.mockResolvedValue(0);
    mockReviewAggregate.mockResolvedValue({ _avg: { overallRating: null } });

    render(await HomePage());

    expect(mockTransactionCount).toHaveBeenCalledWith({
      where: { paymentStatus: 'succeeded' },
    });
  });

  it('renders hero heading', async () => {
    mockProjectCount.mockResolvedValue(0);
    mockTransactionCount.mockResolvedValue(0);
    mockReviewAggregate.mockResolvedValue({ _avg: { overallRating: null } });

    render(await HomePage());

    expect(
      screen.getByText(/incomplete projects/i, { selector: 'span' })
    ).toBeInTheDocument();
  });

  it('renders stat labels', async () => {
    mockProjectCount.mockResolvedValue(1);
    mockTransactionCount.mockResolvedValue(1);
    mockReviewAggregate.mockResolvedValue({ _avg: { overallRating: 5.0 } });

    render(await HomePage());

    expect(screen.getByText('Projects Listed')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('Average Rating')).toBeInTheDocument();
  });
});
