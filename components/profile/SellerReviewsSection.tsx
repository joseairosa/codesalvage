/**
 * SellerReviewsSection Component
 *
 * Client component for paginated seller reviews on public profile pages.
 * Receives initial data server-side, paginates via /api/u/[username]/reviews.
 */

'use client';

import * as React from 'react';
import { Star, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ReviewBuyer {
  id: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
}

interface ReviewItem {
  id: string;
  overallRating: number;
  comment: string | null;
  isAnonymous: boolean;
  createdAt: string;
  buyer: ReviewBuyer;
  transaction: {
    id: string;
    projectId: string;
    project: { id: string; title: string };
  };
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface SellerReviewsSectionProps {
  username: string;
  initialReviews: ReviewItem[];
  initialPagination: Pagination;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3.5 w-3.5 ${
            star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
          }`}
        />
      ))}
    </div>
  );
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]![0]!.toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(
    new Date(iso)
  );
}

export function SellerReviewsSection({
  username,
  initialReviews,
  initialPagination,
}: SellerReviewsSectionProps) {
  const [reviews, setReviews] = React.useState<ReviewItem[]>(initialReviews);
  const [pagination, setPagination] = React.useState<Pagination>(initialPagination);
  const [isLoading, setIsLoading] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  const fetchPage = async (page: number) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(
        `/api/u/${username}/reviews?page=${page}&limit=${pagination.limit}`
      );
      if (!res.ok) {
        setFetchError('Failed to load reviews. Please try again.');
        return;
      }
      const data = await res.json();
      setReviews(data.reviews);
      setPagination(data.pagination);
    } catch {
      setFetchError('Failed to load reviews. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (reviews.length === 0 && pagination.total === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">No reviews yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {fetchError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {fetchError}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => {
            const buyerName =
              review.isAnonymous || review.buyer.username === 'Anonymous'
                ? 'Anonymous Buyer'
                : review.buyer.fullName || review.buyer.username;
            const avatarSrc =
              review.isAnonymous || review.buyer.username === 'Anonymous'
                ? undefined
                : review.buyer.avatarUrl || undefined;

            return (
              <Card key={review.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={avatarSrc} alt={buyerName} />
                      <AvatarFallback className="text-xs">
                        {getInitials(buyerName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{buyerName}</span>
                        <StarRating rating={review.overallRating} />
                        <span className="text-xs text-muted-foreground">
                          {formatDate(review.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {review.transaction.project.title}
                      </p>
                      {review.comment && (
                        <p className="mt-2 text-sm text-foreground">{review.comment}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPage(pagination.page - 1)}
              disabled={!pagination.hasPrev || isLoading}
              aria-label="Previous"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPage(pagination.page + 1)}
              disabled={!pagination.hasNext || isLoading}
              aria-label="Next"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
