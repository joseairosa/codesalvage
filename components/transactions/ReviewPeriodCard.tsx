/**
 * ReviewPeriodCard
 *
 * Displays the 7-day review period countdown for a transaction.
 * Shows a progress bar, days remaining, escrow release date, and
 * role-specific messaging (buyer: "Leave a Review", seller:
 * "Funds will be released on {date}").
 *
 * Responsibilities:
 * - Render progress bar based on days elapsed out of 7
 * - Show formatted escrow release date
 * - Buyer: link to leave a review
 * - Seller: informational text about fund release
 *
 * @example
 * <ReviewPeriodCard
 *   stage={reviewPeriodStage}
 *   userRole="buyer"
 *   transactionId="txn_abc"
 * />
 */

'use client';

import * as React from 'react';
import { Shield, Star, Clock, CheckCircle2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { TimelineStage } from '@/lib/services/RepositoryTransferService';

const componentName = 'ReviewPeriodCard';

export interface ExistingReview {
  id: string;
  overallRating: number;
}

export interface ReviewPeriodCardProps {
  stage: TimelineStage;
  userRole: 'buyer' | 'seller';
  transactionId: string;
  existingReview?: ExistingReview | null;
}

const REVIEW_PERIOD_DAYS = 7;

/**
 * Format a date into a human-readable string like "Feb 18, 2026 at 3:45 PM".
 */
function formatDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export function ReviewPeriodCard({
  stage,
  userRole,
  transactionId,
  existingReview,
}: ReviewPeriodCardProps) {
  const daysRemaining = (stage.metadata?.['daysRemaining'] as number) ?? 0;
  const escrowReleaseDate = stage.metadata?.['escrowReleaseDate']
    ? new Date(stage.metadata['escrowReleaseDate'] as string)
    : null;

  const daysElapsed = REVIEW_PERIOD_DAYS - daysRemaining;
  const progressPercent = Math.min(
    100,
    Math.max(0, (daysElapsed / REVIEW_PERIOD_DAYS) * 100)
  );

  const formattedReleaseDate = formatDate(escrowReleaseDate);
  const isCompleted = stage.status === 'completed';
  const isActive = stage.status === 'active';
  const isUpcoming = stage.status === 'upcoming';

  console.log(`[${componentName}] Rendering:`, {
    transactionId,
    userRole,
    status: stage.status,
    daysRemaining,
    progressPercent,
    escrowReleaseDate,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Review Period</CardTitle>
        </div>
        <CardDescription>{stage.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar — shown when active or completed */}
        {(isActive || isCompleted) && (
          <div className="space-y-2">
            <Progress value={isCompleted ? 100 : progressPercent} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {isCompleted ? (
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-green-700">Review period complete</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                  </span>
                </div>
              )}
              <span>
                {daysElapsed} of {REVIEW_PERIOD_DAYS} days
              </span>
            </div>
          </div>
        )}

        {/* Escrow release date */}
        {formattedReleaseDate && (
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold">Escrow release date:</span>{' '}
              {formattedReleaseDate}
            </p>
          </div>
        )}

        {/* Buyer: leave or edit a review */}
        {userRole === 'buyer' && isActive && (
          <div className="space-y-2">
            {existingReview && (
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${
                      i < existingReview.overallRating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-muted-foreground'
                    }`}
                  />
                ))}
                <span className="ml-1 text-sm text-muted-foreground">
                  Your rating: {existingReview.overallRating}/5
                </span>
              </div>
            )}
            <Button variant="outline" size="sm" asChild>
              <a href={`/transactions/${transactionId}/review`}>
                <Star className="mr-2 h-4 w-4" />
                {existingReview ? 'Edit Review' : 'Leave a Review'}
              </a>
            </Button>
          </div>
        )}

        {/* Seller: informational message */}
        {userRole === 'seller' && isActive && (
          <p className="text-sm text-muted-foreground">
            The buyer has until{' '}
            {formattedReleaseDate ? (
              <span className="font-semibold">{formattedReleaseDate}</span>
            ) : (
              'the end of the review period'
            )}{' '}
            to review the project and raise any disputes. After the review period,
            ownership transfer will be initiated automatically.
          </p>
        )}

        {/* Upcoming state */}
        {isUpcoming && (
          <p className="text-sm text-muted-foreground">{stage.description}</p>
        )}
      </CardContent>
    </Card>
  );
}
