/**
 * RatingBreakdown Component
 *
 * Displays a 5-star rating distribution as horizontal bars.
 * Server-renderable (no client state).
 *
 * @example
 * <RatingBreakdown stats={ratingStats} />
 */

import { Star } from 'lucide-react';

interface RatingBreakdownProps {
  averageRating: number;
  totalReviews: number;
  ratingBreakdown: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export function RatingBreakdown({
  averageRating,
  totalReviews,
  ratingBreakdown,
}: RatingBreakdownProps) {
  if (totalReviews === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground">No reviews yet</div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Average summary */}
      <div className="flex items-center gap-3">
        <span className="text-4xl font-bold">{averageRating.toFixed(1)}</span>
        <div>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-4 w-4 ${
                  star <= Math.round(averageRating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-muted-foreground'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {totalReviews} review{totalReviews !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Bar breakdown */}
      <div className="space-y-1.5">
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const count = ratingBreakdown[star];
          const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-2 text-sm">
              <span className="w-4 text-right text-muted-foreground">{star}</span>
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <div className="h-2 flex-1 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-yellow-400 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-6 text-right text-muted-foreground">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
