/**
 * Transaction Detail Page
 *
 * Displays full transaction details including timeline, repository transfer,
 * review period, inline chat, and a summary card.
 * Accessible by both buyer and seller.
 *
 * @example
 * /transactions/txn_abc123
 */

'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from '@/lib/hooks/useSession';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { TransactionTimeline } from '@/components/transactions/TransactionTimeline';
import { RepositoryTransferCard } from '@/components/transactions/RepositoryTransferCard';
import { ReviewPeriodCard } from '@/components/transactions/ReviewPeriodCard';
import { TransactionSummaryCard } from '@/components/transactions/TransactionSummaryCard';
import { TransactionChat } from '@/components/transactions/TransactionChat';
import type { TimelineStage } from '@/lib/services/RepositoryTransferService';

const componentName = 'TransactionDetailPage';
const POLL_INTERVAL_MS = 30_000;

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

function TransactionDetailContent() {
  const router = useRouter();
  const params = useParams();
  const transactionId = params['id'] as string;
  const { data: session, status: sessionStatus } = useSession();

  const [transaction, setTransaction] = React.useState<TransactionData | null>(null);
  const [timeline, setTimeline] = React.useState<TimelineStage[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [existingReview, setExistingReview] = React.useState<{
    id: string;
    overallRating: number;
  } | null>(null);

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

  const fetchData = React.useCallback(async () => {
    if (!transactionId) return;
    console.log(`[${componentName}] Fetching transaction data:`, transactionId);

    try {
      const [txnResponse, timelineResponse, reviewResponse] = await Promise.all([
        fetch(`/api/transactions/${transactionId}`),
        fetch(`/api/transactions/${transactionId}/timeline`),
        fetch(`/api/reviews?transactionId=${transactionId}`),
      ]);

      if (!txnResponse.ok) {
        if (txnResponse.status === 404) throw new Error('Transaction not found');
        if (txnResponse.status === 403)
          throw new Error('You do not have access to this transaction');
        throw new Error('Failed to load transaction');
      }

      const txnData = await txnResponse.json();
      setTransaction(txnData.transaction);

      if (timelineResponse.ok) {
        const timelineData = await timelineResponse.json();
        setTimeline(timelineData);
      }

      if (reviewResponse.ok) {
        const reviewData = await reviewResponse.json();
        setExistingReview(reviewData.review ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transaction');
    } finally {
      setIsLoading(false);
    }
  }, [transactionId]);

  React.useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.push('/auth/signin');
  }, [sessionStatus, router]);

  React.useEffect(() => {
    if (sessionStatus === 'authenticated' && transactionId) fetchData();
  }, [sessionStatus, transactionId, fetchData]);

  React.useEffect(() => {
    if (!hasActiveStage || sessionStatus !== 'authenticated') return;
    const intervalId = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [hasActiveStage, sessionStatus, fetchData]);

  const handleActionComplete = () => fetchData();

  if (sessionStatus === 'loading') {
    return (
      <div className="container mx-auto max-w-6xl py-10">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (sessionStatus === 'unauthenticated') return null;

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

  const backHref = userRole === 'buyer' ? '/buyer/purchases' : '/seller/sales';
  const backLabel = userRole === 'buyer' ? 'Back to Purchases' : 'Back to Sales';

  if (error) {
    return (
      <div className="container mx-auto max-w-6xl py-10">
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => router.push(backHref)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="container mx-auto max-w-6xl py-10">
        <div className="space-y-4">
          <Button variant="ghost" size="sm" onClick={() => router.push(backHref)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
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

  return (
    <div className="container mx-auto max-w-6xl py-10">
      <div className="space-y-6">
        {/* Back link */}
        <Button variant="ghost" size="sm" onClick={() => router.push(backHref)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {backLabel}
        </Button>

        {/* Project header */}
        <div className="flex items-start gap-4">
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
            {timeline.length > 0 && (
              <TransactionTimeline
                stages={timeline}
                userRole={userRole}
                transactionId={transaction.id}
                onActionComplete={handleActionComplete}
              />
            )}

            {showRepoTransferCard && repoTransferStage && (
              <RepositoryTransferCard
                stage={repoTransferStage}
                userRole={userRole}
                transactionId={transaction.id}
                onActionComplete={handleActionComplete}
              />
            )}

            {showReviewPeriodCard && reviewPeriodStage && (
              <ReviewPeriodCard
                stage={reviewPeriodStage}
                userRole={userRole}
                transactionId={transaction.id}
                existingReview={existingReview}
              />
            )}

            {/* Inline chat between buyer and seller */}
            {otherParty?.id && session?.user?.id && (
              <TransactionChat
                otherUserId={otherParty.id}
                projectId={transaction.projectId}
                currentUserId={session.user.id}
              />
            )}
          </div>

          {/* Right column (1/3) */}
          <div>
            <TransactionSummaryCard transaction={transaction} userRole={userRole} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TransactionDetailPage() {
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
