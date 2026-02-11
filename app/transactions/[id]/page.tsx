/**
 * Transaction Detail Page
 *
 * Displays full transaction details including timeline, repository transfer,
 * review period, and a summary card. Accessible by both buyer and seller.
 *
 * Features:
 * - Transaction timeline with stage progression
 * - Repository transfer card (when stage 3 is active)
 * - Review period card (when stage 4 is active or completed)
 * - Transaction summary with pricing breakdown
 * - Auto-polling every 30 seconds when any stage is active
 * - Role-based UI (buyer vs seller)
 *
 * @example
 * /transactions/txn_abc123
 */

'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from '@/lib/hooks/useSession';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, AlertCircle, Copy, Check } from 'lucide-react';
import { TransactionTimeline } from '@/components/transactions/TransactionTimeline';
import { RepositoryTransferCard } from '@/components/transactions/RepositoryTransferCard';
import { ReviewPeriodCard } from '@/components/transactions/ReviewPeriodCard';
import type { TimelineStage } from '@/lib/services/RepositoryTransferService';

const componentName = 'TransactionDetailPage';

// ---------- Types ----------

interface TransactionData {
  id: string;
  projectId: string;
  sellerId: string;
  buyerId: string;
  amountCents: number;
  commissionCents: number;
  sellerReceivesCents: number;
  paymentStatus: string;
  escrowStatus: string;
  escrowReleaseDate: string | null;
  releasedToSellerAt: string | null;
  codeDeliveryStatus: string;
  createdAt: string;
  updatedAt: string;
  project: {
    id: string;
    title: string;
    description: string;
    thumbnailImageUrl: string | null;
    priceCents: number;
    status: string;
    githubUrl: string | null;
    githubRepoName: string | null;
  };
  seller: {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  buyer: {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
}

// ---------- Constants ----------

const POLL_INTERVAL_MS = 30_000;

// ---------- Helpers ----------

/**
 * Format price in cents to USD currency string.
 */
function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Format a date string into a human-readable format.
 */
function formatDate(date: string | null | undefined): string {
  if (!date) return '\u2014';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '\u2014';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

// ---------- Inner content component ----------

function TransactionDetailContent() {
  const router = useRouter();
  const params = useParams();
  const transactionId = params['id'] as string;
  const { data: session, status: sessionStatus } = useSession();

  // State
  const [transaction, setTransaction] = React.useState<TransactionData | null>(null);
  const [timeline, setTimeline] = React.useState<TimelineStage[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState(false);

  // ---------- Derived values ----------

  const userRole: 'buyer' | 'seller' =
    session?.user?.id === transaction?.buyerId ? 'buyer' : 'seller';

  const otherParty = userRole === 'buyer' ? transaction?.seller : transaction?.buyer;

  const hasActiveStage = timeline.some((stage) => stage.status === 'active');

  const repoTransferStage = timeline.find((s) => s.name === 'Repository Transfer');
  const reviewPeriodStage = timeline.find((s) => s.name === 'Review Period');

  const showRepoTransferCard = repoTransferStage && repoTransferStage.status === 'active';
  const showReviewPeriodCard =
    reviewPeriodStage &&
    (reviewPeriodStage.status === 'active' || reviewPeriodStage.status === 'completed');

  // ---------- Fetch functions ----------

  /**
   * Fetch transaction details and timeline data in parallel.
   */
  const fetchData = React.useCallback(async () => {
    if (!transactionId) return;

    console.log(`[${componentName}] Fetching transaction data:`, transactionId);

    try {
      const [txnResponse, timelineResponse] = await Promise.all([
        fetch(`/api/transactions/${transactionId}`),
        fetch(`/api/transactions/${transactionId}/timeline`),
      ]);

      if (!txnResponse.ok) {
        if (txnResponse.status === 404) {
          throw new Error('Transaction not found');
        }
        if (txnResponse.status === 403) {
          throw new Error('You do not have access to this transaction');
        }
        throw new Error('Failed to load transaction');
      }

      const txnData = await txnResponse.json();
      setTransaction(txnData.transaction);

      if (timelineResponse.ok) {
        const timelineData = await timelineResponse.json();
        setTimeline(timelineData);
        console.log(`[${componentName}] Timeline loaded:`, timelineData.length, 'stages');
      } else {
        console.warn(`[${componentName}] Timeline fetch failed, continuing without it`);
      }

      console.log(`[${componentName}] Transaction loaded:`, txnData.transaction.id);
    } catch (err) {
      console.error(`[${componentName}] Fetch error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load transaction');
    } finally {
      setIsLoading(false);
    }
  }, [transactionId]);

  // ---------- Effects ----------

  /**
   * Redirect to sign-in if unauthenticated.
   */
  React.useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      console.log(`[${componentName}] Unauthenticated, redirecting to sign-in`);
      router.push('/auth/signin');
    }
  }, [sessionStatus, router]);

  /**
   * Initial data fetch when session is ready.
   */
  React.useEffect(() => {
    if (sessionStatus === 'authenticated' && transactionId) {
      fetchData();
    }
  }, [sessionStatus, transactionId, fetchData]);

  /**
   * Poll every 30 seconds when any stage is active.
   */
  React.useEffect(() => {
    if (!hasActiveStage || sessionStatus !== 'authenticated') return;

    console.log(`[${componentName}] Starting polling (active stage detected)`);
    const intervalId = setInterval(() => {
      console.log(`[${componentName}] Poll tick`);
      fetchData();
    }, POLL_INTERVAL_MS);

    return () => {
      console.log(`[${componentName}] Stopping polling`);
      clearInterval(intervalId);
    };
  }, [hasActiveStage, sessionStatus, fetchData]);

  // ---------- Handlers ----------

  /**
   * Copy transaction ID to clipboard.
   */
  const handleCopyId = async () => {
    if (!transaction) return;
    try {
      await navigator.clipboard.writeText(transaction.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      console.error(`[${componentName}] Failed to copy transaction ID`);
    }
  };

  /**
   * Callback for child components after a successful action (e.g. transfer, confirm).
   */
  const handleActionComplete = () => {
    console.log(`[${componentName}] Action completed, refetching data`);
    fetchData();
  };

  // ---------- Render: session loading ----------

  if (sessionStatus === 'loading') {
    return (
      <div className="container mx-auto max-w-6xl py-10">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Don't render anything while redirecting unauthenticated user
  if (sessionStatus === 'unauthenticated') {
    return null;
  }

  // ---------- Render: loading ----------

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-6xl py-10">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---------- Render: error ----------

  if (error) {
    return (
      <div className="container mx-auto max-w-6xl py-10">
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // ---------- Render: not found ----------

  if (!transaction) {
    return (
      <div className="container mx-auto max-w-6xl py-10">
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <CardTitle className="mb-2">Transaction not found</CardTitle>
              <CardDescription>
                This transaction does not exist or you do not have access to view it.
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---------- Render: success ----------

  return (
    <div className="container mx-auto max-w-6xl py-10">
      <div className="space-y-6">
        {/* Back link */}
        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {userRole === 'buyer' ? 'Back to Purchases' : 'Back to Sales'}
        </Button>

        {/* Project header */}
        <div className="flex items-start gap-4">
          {/* Thumbnail */}
          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
            {transaction.project.thumbnailImageUrl ? (
              <Image
                src={transaction.project.thumbnailImageUrl}
                alt={transaction.project.title}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <span className="text-2xl font-bold">
                  {transaction.project.title.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{transaction.project.title}</h1>
            <p className="text-sm text-muted-foreground">
              Transaction with{' '}
              <span className="font-medium">@{otherParty?.username || 'unknown'}</span>
            </p>
          </div>
        </div>

        {/* Two column layout */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column (2/3) */}
          <div className="space-y-6 lg:col-span-2">
            {/* Timeline */}
            {timeline.length > 0 && (
              <TransactionTimeline
                stages={timeline}
                userRole={userRole}
                transactionId={transaction.id}
                onActionComplete={handleActionComplete}
              />
            )}

            {/* Repository Transfer expanded card */}
            {showRepoTransferCard && repoTransferStage && (
              <RepositoryTransferCard
                stage={repoTransferStage}
                userRole={userRole}
                transactionId={transaction.id}
                onActionComplete={handleActionComplete}
              />
            )}

            {/* Review Period expanded card */}
            {showReviewPeriodCard && reviewPeriodStage && (
              <ReviewPeriodCard
                stage={reviewPeriodStage}
                userRole={userRole}
                transactionId={transaction.id}
              />
            )}
          </div>

          {/* Right column (1/3) — Transaction Summary */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Transaction Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Amount Paid */}
                <div>
                  <p className="text-sm text-muted-foreground">Amount Paid</p>
                  <p className="text-lg font-semibold">
                    {formatPrice(transaction.amountCents)}
                  </p>
                </div>

                {/* Platform Fee */}
                <div>
                  <p className="text-sm text-muted-foreground">Platform Fee</p>
                  <p className="font-semibold">
                    {formatPrice(transaction.commissionCents)}
                  </p>
                </div>

                {/* Seller Receives — only visible to seller */}
                {userRole === 'seller' && (
                  <div>
                    <p className="text-sm text-muted-foreground">You Receive</p>
                    <p className="font-semibold text-green-600">
                      {formatPrice(transaction.sellerReceivesCents)}
                    </p>
                  </div>
                )}

                {/* Separator */}
                <div className="border-t pt-4" />

                {/* Transaction ID */}
                <div>
                  <p className="text-sm text-muted-foreground">Transaction ID</p>
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm">{transaction.id.slice(0, 8)}...</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={handleCopyId}
                    >
                      {copiedId ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Created Date */}
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="text-sm font-medium">
                    {formatDate(transaction.createdAt)}
                  </p>
                </div>

                {/* Escrow Release Date */}
                <div>
                  <p className="text-sm text-muted-foreground">Escrow Release</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">
                      {formatDate(transaction.escrowReleaseDate)}
                    </p>
                    {transaction.escrowStatus === 'released' && (
                      <Badge className="bg-green-100 text-green-800">Released</Badge>
                    )}
                  </div>
                </div>

                {/* Payment Status */}
                <div>
                  <p className="text-sm text-muted-foreground">Payment Status</p>
                  <Badge
                    className={
                      transaction.paymentStatus === 'succeeded'
                        ? 'bg-green-100 text-green-800'
                        : transaction.paymentStatus === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                    }
                  >
                    {transaction.paymentStatus.charAt(0).toUpperCase() +
                      transaction.paymentStatus.slice(1)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Main export with Suspense boundary ----------

/**
 * Main page component with Suspense boundary.
 * Required for client-side hooks in Next.js 15 App Router.
 */
export default function TransactionDetailPage() {
  console.log(`[${componentName}] Page rendered`);

  return (
    <React.Suspense
      fallback={
        <div className="container mx-auto max-w-6xl py-10">
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <TransactionDetailContent />
    </React.Suspense>
  );
}
