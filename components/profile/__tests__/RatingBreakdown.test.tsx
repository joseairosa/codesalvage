/**
 * RatingBreakdown Component Tests
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RatingBreakdown } from '../RatingBreakdown';

const defaultStats = {
  averageRating: 4.2,
  totalReviews: 10,
  ratingBreakdown: { 5: 5, 4: 3, 3: 1, 2: 1, 1: 0 },
};

describe('RatingBreakdown', () => {
  it('should show "No reviews yet" when totalReviews is 0', () => {
    render(
      <RatingBreakdown
        averageRating={0}
        totalReviews={0}
        ratingBreakdown={{ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }}
      />
    );
    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
  });

  it('should display average rating', () => {
    render(<RatingBreakdown {...defaultStats} />);
    expect(screen.getByText('4.2')).toBeInTheDocument();
  });

  it('should display total review count', () => {
    render(<RatingBreakdown {...defaultStats} />);
    expect(screen.getByText('10 reviews')).toBeInTheDocument();
  });

  it('should display singular "review" for 1 review', () => {
    render(
      <RatingBreakdown
        averageRating={5}
        totalReviews={1}
        ratingBreakdown={{ 5: 1, 4: 0, 3: 0, 2: 0, 1: 0 }}
      />
    );
    expect(screen.getByText('1 review')).toBeInTheDocument();
  });

  it('should render 5 star labels (5 through 1)', () => {
    render(<RatingBreakdown {...defaultStats} />);
    // Each star label is a number in the breakdown
    const starLabels = ['5', '4', '3', '2', '1'];
    starLabels.forEach((label) => {
      // The breakdown rows have the star number as text
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
    });
  });
});
