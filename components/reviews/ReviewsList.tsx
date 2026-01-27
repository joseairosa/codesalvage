/**
 * Reviews List Component
 *
 * Displays a list of reviews with ratings and comments.
 * Can be used on project detail pages or seller profiles.
 *
 * Features:
 * - Star ratings display
 * - Reviewer info (or anonymous)
 * - Review text
 * - Timestamps
 * - Pagination
 *
 * @example
 * <ReviewsList sellerId="user123" />
 */

'use client';

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Star, Loader2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const componentName = 'ReviewsList';

interface User {
  id: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
}

interface Project {
  id: string;
  title: string;
}

interface Transaction {
  id: string;
  projectId: string;
  project: Project;
}

interface Review {
  id: string;
  overallRating: number;
  comment: string | null;
  codeQualityRating: number | null;
  documentationRating: number | null;
  responsivenessRating: number | null;
  accuracyRating: number | null;
  isAnonymous: boolean;
  createdAt: string;
  buyer: User;
  transaction: Transaction;
}

interface ReviewsListProps {
  sellerId: string;
  limit?: number;
}

export function ReviewsList({ sellerId, limit = 10 }: ReviewsListProps) {
  const [reviews, setReviews] = React.useState<Review[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [total, setTotal] = React.useState(0);
  const [offset, setOffset] = React.useState(0);

  /**
   * Fetch reviews
   */
  const fetchReviews = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/reviews?sellerId=${sellerId}&limit=${limit}&offset=${offset}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch reviews');
      }

      const data = await response.json();
      setReviews(data.reviews);
      setTotal(data.total);

      console.log(`[${componentName}] Loaded ${data.reviews.length} reviews`);
    } catch (err) {
      console.error(`[${componentName}] Fetch error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to fetch reviews');
    } finally {
      setIsLoading(false);
    }
  }, [sellerId, limit, offset]);

  React.useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  /**
   * Star Rating Display
   */
  const StarRating = ({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) => {
    const starClass = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';

    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${starClass} ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
            }`}
          />
        ))}
      </div>
    );
  };

  /**
   * Get initials for avatar
   */
  const getInitials = (name: string | null, username: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return username.slice(0, 2).toUpperCase();
  };

  /**
   * Format timestamp
   */
  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
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
          <Button onClick={() => fetchReviews()} variant="outline" className="mt-4">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (reviews.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>No reviews yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <Card key={review.id}>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage
                      src={review.buyer.avatarUrl || undefined}
                      alt={review.buyer.username}
                    />
                    <AvatarFallback>
                      {getInitials(review.buyer.fullName, review.buyer.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">
                      {review.buyer.fullName || review.buyer.username}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatTime(review.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <StarRating rating={review.overallRating} size="lg" />
                  <p className="mt-1 text-sm text-muted-foreground">
                    {review.overallRating}.0 / 5.0
                  </p>
                </div>
              </div>

              {/* Project Context */}
              <p className="text-sm text-muted-foreground">
                Purchased: {review.transaction.project.title}
              </p>

              {/* Comment */}
              {review.comment && (
                <p className="whitespace-pre-wrap text-sm">{review.comment}</p>
              )}

              {/* Detailed Ratings */}
              {(review.codeQualityRating ||
                review.documentationRating ||
                review.responsivenessRating ||
                review.accuracyRating) && (
                <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 md:grid-cols-4">
                  {review.codeQualityRating && (
                    <div>
                      <p className="text-xs text-muted-foreground">Code Quality</p>
                      <div className="mt-1 flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-semibold">
                          {review.codeQualityRating}.0
                        </span>
                      </div>
                    </div>
                  )}
                  {review.documentationRating && (
                    <div>
                      <p className="text-xs text-muted-foreground">Documentation</p>
                      <div className="mt-1 flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-semibold">
                          {review.documentationRating}.0
                        </span>
                      </div>
                    </div>
                  )}
                  {review.responsivenessRating && (
                    <div>
                      <p className="text-xs text-muted-foreground">Responsiveness</p>
                      <div className="mt-1 flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-semibold">
                          {review.responsivenessRating}.0
                        </span>
                      </div>
                    </div>
                  )}
                  {review.accuracyRating && (
                    <div>
                      <p className="text-xs text-muted-foreground">Accuracy</p>
                      <div className="mt-1 flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-semibold">
                          {review.accuracyRating}.0
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {offset + 1} - {Math.min(offset + limit, total)} of {total} reviews
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
              disabled={offset === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOffset((prev) => prev + limit)}
              disabled={offset + limit >= total}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
