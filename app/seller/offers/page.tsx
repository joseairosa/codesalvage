/**
 * Seller Dashboard - Offers Management Page
 *
 * Dashboard for sellers to view and manage offers received on their projects.
 * Card-level accept / reject / counter-offer logic lives in SellerOfferCard.
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/hooks/useSession';
import { Card, CardContent } from '@/components/ui/card';
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
import { SellerOfferCard } from '@/components/sellers/SellerOfferCard';

const componentName = 'SellerOffersPage';

/**
 * Offer status type
 */
export type OfferStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'countered'
  | 'withdrawn'
  | 'expired';

/**
 * Offer item shape from the API
 */
export interface OfferItem {
  id: string;
  projectId: string;
  buyerId: string;
  sellerId: string;
  offeredPriceCents: number;
  originalPriceCents: number;
  message: string | null;
  status: string;
  respondedAt: string | null;
  expiresAt: string;
  parentOfferId: string | null;
  transactionId: string | null;
  createdAt: string;
  project: {
    id: string;
    title: string;
    priceCents: number;
    thumbnailImageUrl: string | null;
    status: string;
  };
  buyer: {
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    email: string;
  };
}

/**
 * Pagination shape from the API
 */
interface Pagination {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export default function SellerOffersPage() {
  console.log(`[${componentName}] Page rendered`);

  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [offers, setOffers] = React.useState<OfferItem[]>([]);
  const [pagination, setPagination] = React.useState<Pagination>({
    total: 0,
    page: 1,
    limit: 20,
    hasMore: false,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<OfferStatus | 'all'>('all');
  const [currentPage, setCurrentPage] = React.useState(1);

  React.useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      console.log(`[${componentName}] Unauthenticated, redirecting to sign-in`);
      router.push('/auth/signin');
    }
  }, [sessionStatus, router]);

  const fetchOffers = React.useCallback(
    async (page: number = 1) => {
      if (!session?.user?.id) return;

      const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      const url = `/api/offers?view=seller${statusParam}&page=${page}&limit=20`;

      console.log(`[${componentName}] Fetching offers:`, url);
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch offers');

        const data = await response.json();
        console.log(
          `[${componentName}] Fetched ${data.offers.length} offers (total: ${data.pagination.total})`
        );

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
    if (sessionStatus === 'authenticated') {
      setCurrentPage(1);
      fetchOffers(1);
    }
  }, [sessionStatus, fetchOffers]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    fetchOffers(newPage);
  };

  return (
    <div className="container mx-auto max-w-7xl py-10">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Offers Received</h1>
            <p className="mt-2 text-muted-foreground">
              {isLoading ? 'Loading offers...' : `${pagination.total} offer(s) total`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {offers.filter((o) => o.status === 'pending').length} pending
            </span>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex gap-4">
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as OfferStatus | 'all')}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Offers</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="countered">Countered</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span>{error}</span>
                <Button
                  onClick={() => fetchOffers(currentPage)}
                  variant="outline"
                  size="sm"
                >
                  Try Again
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">Loading offers...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && offers.length === 0 && !error && (
          <Card>
            <CardContent className="py-16">
              <div className="text-center">
                <Tag className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">No offers yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {statusFilter !== 'all'
                    ? `No ${statusFilter} offers found. Try changing the filter.`
                    : 'When buyers make offers on your projects, they will appear here.'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Offer Cards */}
        {!isLoading && offers.length > 0 && (
          <div className="space-y-4">
            {offers.map((offer) => (
              <SellerOfferCard
                key={offer.id}
                offer={offer}
                onRefresh={() => fetchOffers(currentPage)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && pagination.total > pagination.limit && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} of {Math.ceil(pagination.total / pagination.limit)}
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
