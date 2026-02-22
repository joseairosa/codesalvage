/**
 * Buyer Offers Page (Protected Route - Buyer View)
 *
 * Dashboard for buyers to view and manage offers they've sent.
 *
 * @example /dashboard/offers
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/hooks/useSession';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tag, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { BuyerOfferCard } from '@/components/buyers/BuyerOfferCard';

const componentName = 'BuyerOffersPage';

type OfferStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'countered'
  | 'withdrawn'
  | 'expired';

export interface OfferItem {
  id: string;
  projectId: string;
  buyerId: string;
  sellerId: string;
  offeredPriceCents: number;
  originalPriceCents: number;
  message: string | null;
  status: string;
  transactionId: string | null;
  respondedAt: string | null;
  expiresAt: string;
  parentOfferId: string | null;
  createdAt: string;
  project: {
    id: string;
    title: string;
    priceCents: number;
    thumbnailImageUrl: string | null;
    status: string;
  };
  seller: {
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    email: string;
  };
  counterOffer?: {
    id: string;
    offeredPriceCents: number;
    status: string;
    message: string | null;
  } | null;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const ITEMS_PER_PAGE = 20;

export default function BuyerOffersPage() {
  console.log(`[${componentName}] Page rendered`);

  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [offers, setOffers] = React.useState<OfferItem[]>([]);
  const [pagination, setPagination] = React.useState<Pagination>({
    total: 0,
    page: 1,
    limit: ITEMS_PER_PAGE,
    hasMore: false,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<OfferStatus | 'all'>('all');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [sessionStatus, router]);

  const fetchOffers = React.useCallback(
    async (page: number = 1) => {
      if (!session?.user?.id) return;

      console.log(
        `[${componentName}] Fetching offers, page:`,
        page,
        'filter:',
        statusFilter
      );
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          view: 'buyer',
          page: String(page),
          limit: String(ITEMS_PER_PAGE),
        });
        if (statusFilter !== 'all') params.set('status', statusFilter);

        const response = await fetch(`/api/offers?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch offers');

        const data = await response.json();
        setOffers(data.offers);
        setPagination(data.pagination);
      } catch (err) {
        console.error(`[${componentName}] Fetch error:`, err);
        setError(err instanceof Error ? err.message : 'Failed to fetch offers');
        setOffers([]);
      } finally {
        setIsLoading(false);
      }
    },
    [session?.user?.id, statusFilter]
  );

  React.useEffect(() => {
    if (sessionStatus === 'authenticated') fetchOffers(currentPage);
  }, [sessionStatus, fetchOffers, currentPage]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  const handleWithdraw = async (offerId: string) => {
    setActionLoading(offerId);
    try {
      const response = await fetch(`/api/offers/${offerId}/withdraw`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to withdraw offer');
      await fetchOffers(currentPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to withdraw offer');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptCounter = async (offerId: string) => {
    setActionLoading(offerId);
    try {
      const response = await fetch(`/api/offers/${offerId}/accept`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to accept counter-offer');
      await fetchOffers(currentPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept counter-offer');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectCounter = async (offerId: string) => {
    setActionLoading(offerId);
    try {
      const response = await fetch(`/api/offers/${offerId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Failed to reject counter-offer');
      await fetchOffers(currentPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject counter-offer');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (sessionStatus === 'loading') {
    return (
      <div className="container mx-auto max-w-7xl py-10">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (sessionStatus === 'unauthenticated') return null;

  return (
    <div className="container mx-auto max-w-7xl py-10">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">My Offers</h1>
          <p className="mt-2 text-muted-foreground">
            {isLoading
              ? 'Loading your offers...'
              : `${pagination.total} offer${pagination.total !== 1 ? 's' : ''} total`}
          </p>
        </div>

        {/* Status Filter */}
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as OfferStatus | 'all')}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="countered">Countered</SelectItem>
            <SelectItem value="withdrawn">Withdrawn</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <div className="flex gap-4">
                    <div className="h-20 w-20 animate-pulse rounded bg-muted" />
                    <div className="flex-1 space-y-3">
                      <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Offers list */}
        {!isLoading && offers.length > 0 && (
          <div className="space-y-4">
            {offers.map((offer) => (
              <BuyerOfferCard
                key={offer.id}
                offer={offer}
                isActionLoading={actionLoading === offer.id}
                onWithdraw={handleWithdraw}
                onAcceptCounter={handleAcceptCounter}
                onRejectCounter={handleRejectCounter}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && offers.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Tag className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <CardTitle className="mb-2">No offers found</CardTitle>
                <CardDescription>
                  {statusFilter !== 'all'
                    ? `You don't have any ${statusFilter} offers.`
                    : "You haven't sent any offers yet. Browse projects and make an offer!"}
                </CardDescription>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => router.push('/projects')}
                >
                  Browse Projects
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {!isLoading && pagination.total > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
              {Math.min(currentPage * ITEMS_PER_PAGE, pagination.total)} of{' '}
              {pagination.total} offers
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!pagination.hasMore}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
