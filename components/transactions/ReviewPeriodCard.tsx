/**
 * ReviewPeriodCard (Project Review)
 *
 * Displays the 7-day project review period countdown for a transaction.
 * Shows a progress bar, days remaining, and role-specific controls:
 *   - Buyer: informational only (the Trade Review timeline stage handles the rating)
 *   - Seller: "Transfer Ownership" button to end the review period early,
 *     protected by an irreversible-action confirmation dialog.
 *
 * @example
 * <ReviewPeriodCard
 *   stage={projectReviewStage}
 *   userRole="seller"
 *   transactionId="txn_abc"
 *   onActionComplete={() => refetch()}
 * />
 */

'use client';

import * as React from 'react';
import { Shield, Clock, CheckCircle2, ArrowRightLeft, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { TimelineStage } from '@/lib/services/RepositoryTransferService';

const componentName = 'ReviewPeriodCard';

export interface ReviewPeriodCardProps {
  stage: TimelineStage;
  userRole: 'buyer' | 'seller';
  transactionId: string;
  onActionComplete?: () => void;
}

const REVIEW_PERIOD_DAYS = 7;

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
  onActionComplete,
}: ReviewPeriodCardProps) {
  const [isTransferring, setIsTransferring] = React.useState(false);
  const [transferError, setTransferError] = React.useState<string | null>(null);

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
  });

  const handleEarlyRelease = async () => {
    setIsTransferring(true);
    setTransferError(null);
    console.log(`[${componentName}] Initiating early release for:`, transactionId);
    try {
      const response = await fetch(`/api/transactions/${transactionId}/early-release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to transfer ownership');
      }
      console.log(`[${componentName}] Early release successful`);
      onActionComplete?.();
    } catch (err) {
      console.error(`[${componentName}] Early release failed:`, err);
      setTransferError(
        err instanceof Error ? err.message : 'Failed to transfer ownership'
      );
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-base">Project Review</CardTitle>
        </div>
        <CardDescription>{stage.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress bar */}
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

        {/* Scheduled release date */}
        {formattedReleaseDate && !isCompleted && (
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold">Scheduled release:</span>{' '}
              {formattedReleaseDate}
            </p>
          </div>
        )}

        {/* Seller: Transfer Ownership early + informational text */}
        {userRole === 'seller' && isActive && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              The buyer has until{' '}
              {formattedReleaseDate ? (
                <span className="font-semibold">{formattedReleaseDate}</span>
              ) : (
                'the end of the review period'
              )}{' '}
              to raise any disputes. After the review period, ownership transfer will be
              initiated automatically.
            </p>

            <div className="space-y-1">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isTransferring}>
                    {isTransferring ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                    )}
                    Transfer Ownership Now
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Transfer ownership now?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>
                          This will immediately end the review period and complete the
                          transaction:
                        </p>
                        <ul className="list-disc space-y-1 pl-4">
                          <li>The repository will be transferred to the buyer.</li>
                          <li>Escrow funds will be released to you.</li>
                          <li>The buyer will no longer be able to raise a dispute.</li>
                        </ul>
                        <p className="font-semibold text-foreground">
                          This action cannot be undone.
                        </p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleEarlyRelease}>
                      Yes, transfer ownership
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {transferError && (
                <p className="text-xs text-destructive">{transferError}</p>
              )}
            </div>
          </div>
        )}

        {/* Upcoming state */}
        {isUpcoming && (
          <p className="text-sm text-muted-foreground">{stage.description}</p>
        )}
      </CardContent>
    </Card>
  );
}
