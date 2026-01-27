/**
 * Seller Rating Component
 *
 * Displays seller's aggregated rating statistics.
 * Shows average rating, total reviews, and rating distribution.
 *
 * Features:
 * - Average rating with stars
 * - Total review count
 * - Rating distribution bar chart (1-5 stars)
 * - Detailed ratings breakdown
 *
 * @example
 * <SellerRating sellerId="user123" />
 */

'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, Loader2, AlertCircle } from 'lucide-react';

const componentName = 'SellerRating';

interface RatingStats {
  sellerId: string;
  totalReviews: number;
  averageRating: number | null;
  ratingDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  detailedAverages: {
    codeQuality: number | null;
    documentation: number | null;
    responsiveness: number | null;
    accuracy: number | null;
  };
}

interface SellerRatingProps {
  sellerId: string;
}

export function SellerRating({ sellerId }: SellerRatingProps) {
  const [stats, setStats] = React.useState<RatingStats | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Fetch rating stats
   */
  React.useEffect(() => {
    async function fetchStats() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/reviews/stats/${sellerId}`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch stats');
        }

        const data = await response.json();
        setStats(data);

        console.log(`[${componentName}] Loaded stats for seller:`, sellerId);
      } catch (err) {
        console.error(`[${componentName}] Fetch error:`, err);
        setError(err instanceof Error ? err.message : 'Failed to fetch stats');
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, [sellerId]);

  /**
   * Star Rating Display
   */
  const StarRating = ({ rating }: { rating: number }) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-6 w-6 ${
            star <= Math.round(rating)
              ? 'fill-yellow-400 text-yellow-400'
              : 'text-muted-foreground'
          }`}
        />
      ))}
    </div>
  );

  /**
   * Rating Distribution Bar
   */
  const RatingBar = ({
    stars,
    count,
    total,
  }: {
    stars: number;
    count: number;
    total: number;
  }) => {
    const percentage = total > 0 ? (count / total) * 100 : 0;

    return (
      <div className="flex items-center gap-2">
        <div className="flex w-12 items-center gap-1">
          <span className="text-sm font-medium">{stars}</span>
          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
        </div>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-yellow-400 transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="w-12 text-right text-sm text-muted-foreground">{count}</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <p className="font-medium">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.totalReviews === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Seller Rating</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">No reviews yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Seller Rating</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Rating */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-5xl font-bold">
              {stats.averageRating?.toFixed(1) || 'N/A'}
            </div>
            <div className="mt-2">
              {stats.averageRating && <StarRating rating={stats.averageRating} />}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {stats.totalReviews} {stats.totalReviews === 1 ? 'review' : 'reviews'}
            </p>
          </div>

          {/* Rating Distribution */}
          <div className="flex-1 space-y-2">
            <RatingBar
              stars={5}
              count={stats.ratingDistribution[5]}
              total={stats.totalReviews}
            />
            <RatingBar
              stars={4}
              count={stats.ratingDistribution[4]}
              total={stats.totalReviews}
            />
            <RatingBar
              stars={3}
              count={stats.ratingDistribution[3]}
              total={stats.totalReviews}
            />
            <RatingBar
              stars={2}
              count={stats.ratingDistribution[2]}
              total={stats.totalReviews}
            />
            <RatingBar
              stars={1}
              count={stats.ratingDistribution[1]}
              total={stats.totalReviews}
            />
          </div>
        </div>

        {/* Detailed Averages */}
        {(stats.detailedAverages.codeQuality ||
          stats.detailedAverages.documentation ||
          stats.detailedAverages.responsiveness ||
          stats.detailedAverages.accuracy) && (
          <div className="space-y-3 border-t pt-6">
            <h4 className="font-semibold">Detailed Ratings</h4>
            <div className="grid grid-cols-2 gap-4">
              {stats.detailedAverages.codeQuality && (
                <div>
                  <p className="text-sm text-muted-foreground">Code Quality</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">
                      {stats.detailedAverages.codeQuality.toFixed(1)}
                    </span>
                  </div>
                </div>
              )}
              {stats.detailedAverages.documentation && (
                <div>
                  <p className="text-sm text-muted-foreground">Documentation</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">
                      {stats.detailedAverages.documentation.toFixed(1)}
                    </span>
                  </div>
                </div>
              )}
              {stats.detailedAverages.responsiveness && (
                <div>
                  <p className="text-sm text-muted-foreground">Responsiveness</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">
                      {stats.detailedAverages.responsiveness.toFixed(1)}
                    </span>
                  </div>
                </div>
              )}
              {stats.detailedAverages.accuracy && (
                <div>
                  <p className="text-sm text-muted-foreground">Accuracy</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">
                      {stats.detailedAverages.accuracy.toFixed(1)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
