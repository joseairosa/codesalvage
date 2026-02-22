import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReviewPeriodCard } from '../ReviewPeriodCard';
import type { TimelineStage } from '@/lib/services/RepositoryTransferService';

const activeStage: TimelineStage = {
  name: 'Review Period',
  status: 'active',
  description: 'Buyer has 7 days to review the project.',
  actions: [],
  metadata: {
    daysRemaining: 5,
    escrowReleaseDate: '2026-03-01T00:00:00Z',
  },
};

const completedStage: TimelineStage = {
  name: 'Review Period',
  status: 'completed',
  description: 'Review period complete.',
  actions: [],
  metadata: { daysRemaining: 0 },
};

const upcomingStage: TimelineStage = {
  name: 'Review Period',
  status: 'upcoming',
  description: 'Review period has not started yet.',
  actions: [],
};

describe('ReviewPeriodCard', () => {
  describe('buyer — active stage — no existing review', () => {
    it('shows Leave a Review link', () => {
      render(
        <ReviewPeriodCard
          stage={activeStage}
          userRole="buyer"
          transactionId="txn-1"
        />
      );
      expect(screen.getByRole('link', { name: /leave a review/i })).toBeInTheDocument();
    });

    it('links to the review page', () => {
      render(
        <ReviewPeriodCard
          stage={activeStage}
          userRole="buyer"
          transactionId="txn-1"
        />
      );
      expect(screen.getByRole('link', { name: /leave a review/i })).toHaveAttribute(
        'href',
        '/transactions/txn-1/review'
      );
    });

    it('does not show Edit Review', () => {
      render(
        <ReviewPeriodCard
          stage={activeStage}
          userRole="buyer"
          transactionId="txn-1"
        />
      );
      expect(screen.queryByRole('link', { name: /edit review/i })).not.toBeInTheDocument();
    });

    it('does not show star rating', () => {
      render(
        <ReviewPeriodCard
          stage={activeStage}
          userRole="buyer"
          transactionId="txn-1"
        />
      );
      expect(screen.queryByText(/your rating/i)).not.toBeInTheDocument();
    });
  });

  describe('buyer — active stage — with existing review', () => {
    const existingReview = { id: 'rev-1', overallRating: 4 };

    it('shows Edit Review link instead of Leave a Review', () => {
      render(
        <ReviewPeriodCard
          stage={activeStage}
          userRole="buyer"
          transactionId="txn-1"
          existingReview={existingReview}
        />
      );
      expect(screen.getByRole('link', { name: /edit review/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /leave a review/i })).not.toBeInTheDocument();
    });

    it('displays the rating text', () => {
      render(
        <ReviewPeriodCard
          stage={activeStage}
          userRole="buyer"
          transactionId="txn-1"
          existingReview={existingReview}
        />
      );
      expect(screen.getByText(/your rating: 4\/5/i)).toBeInTheDocument();
    });

    it('links to the review page', () => {
      render(
        <ReviewPeriodCard
          stage={activeStage}
          userRole="buyer"
          transactionId="txn-1"
          existingReview={existingReview}
        />
      );
      expect(screen.getByRole('link', { name: /edit review/i })).toHaveAttribute(
        'href',
        '/transactions/txn-1/review'
      );
    });
  });

  describe('seller — active stage', () => {
    it('does not show a review link', () => {
      render(
        <ReviewPeriodCard
          stage={activeStage}
          userRole="seller"
          transactionId="txn-1"
        />
      );
      expect(screen.queryByRole('link', { name: /review/i })).not.toBeInTheDocument();
    });

    it('shows informational escrow message', () => {
      render(
        <ReviewPeriodCard
          stage={activeStage}
          userRole="seller"
          transactionId="txn-1"
        />
      );
      expect(screen.getByText(/the buyer has until/i)).toBeInTheDocument();
    });
  });

  describe('upcoming stage', () => {
    it('does not show a review link', () => {
      render(
        <ReviewPeriodCard
          stage={upcomingStage}
          userRole="buyer"
          transactionId="txn-1"
        />
      );
      expect(screen.queryByRole('link', { name: /review/i })).not.toBeInTheDocument();
    });
  });

  describe('completed stage', () => {
    it('shows "Review period complete" text', () => {
      render(
        <ReviewPeriodCard
          stage={completedStage}
          userRole="buyer"
          transactionId="txn-1"
        />
      );
      expect(screen.getByText('Review period complete')).toBeInTheDocument();
    });

    it('does not show a review link when completed', () => {
      render(
        <ReviewPeriodCard
          stage={completedStage}
          userRole="buyer"
          transactionId="txn-1"
        />
      );
      expect(screen.queryByRole('link', { name: /review/i })).not.toBeInTheDocument();
    });
  });
});
