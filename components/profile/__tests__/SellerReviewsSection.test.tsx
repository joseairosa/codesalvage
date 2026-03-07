/**
 * SellerReviewsSection Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SellerReviewsSection } from '../SellerReviewsSection';

const mockReview = {
  id: 'rev-1',
  sellerId: 'seller-1',
  buyerId: 'buyer-1',
  overallRating: 5,
  comment: 'Excellent work!',
  isAnonymous: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  buyer: { id: 'buyer-1', username: 'buyer1', fullName: 'Buyer One', avatarUrl: null },
  transaction: {
    id: 'txn-1',
    projectId: 'proj-1',
    project: { id: 'proj-1', title: 'My Project' },
  },
};

const defaultPagination = {
  total: 1,
  page: 1,
  limit: 10,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

describe('SellerReviewsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render initial reviews without fetching', () => {
    render(
      <SellerReviewsSection
        username="testseller"
        initialReviews={[mockReview]}
        initialPagination={defaultPagination}
      />
    );
    expect(screen.getByText('Excellent work!')).toBeInTheDocument();
  });

  it('should show empty state when no reviews', () => {
    render(
      <SellerReviewsSection
        username="testseller"
        initialReviews={[]}
        initialPagination={{ ...defaultPagination, total: 0 }}
      />
    );
    expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument();
  });

  it('should show "Anonymous Buyer" for anonymous reviews', () => {
    const anonReview = {
      ...mockReview,
      isAnonymous: true,
      buyer: { id: 'buyer-1', username: 'Anonymous', fullName: null, avatarUrl: null },
    };
    render(
      <SellerReviewsSection
        username="testseller"
        initialReviews={[anonReview]}
        initialPagination={defaultPagination}
      />
    );
    expect(screen.getByText('Anonymous Buyer')).toBeInTheDocument();
  });

  it('should show project title for each review', () => {
    render(
      <SellerReviewsSection
        username="testseller"
        initialReviews={[mockReview]}
        initialPagination={defaultPagination}
      />
    );
    expect(screen.getByText('My Project')).toBeInTheDocument();
  });

  it('should hide pagination when only 1 page', () => {
    render(
      <SellerReviewsSection
        username="testseller"
        initialReviews={[mockReview]}
        initialPagination={defaultPagination}
      />
    );
    expect(screen.queryByRole('button', { name: /previous/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument();
  });

  it('should show pagination controls when multiple pages', () => {
    render(
      <SellerReviewsSection
        username="testseller"
        initialReviews={[mockReview]}
        initialPagination={{
          ...defaultPagination,
          total: 25,
          totalPages: 3,
          hasNext: true,
        }}
      />
    );
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });
});
