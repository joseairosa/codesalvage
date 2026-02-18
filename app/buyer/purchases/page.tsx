/**
 * Buyer Purchases Page
 *
 * Lists all projects purchased by the authenticated buyer.
 * Shows transaction status, escrow info, repo access, and links
 * to individual transaction details.
 *
 * @example
 * /buyer/purchases
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/hooks/useSession';
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
import {
  Loader2,
  AlertCircle,
  ShoppingBag,
  ExternalLink,
  Github,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const componentName = 'BuyerPurchasesPage';

interface Purchase {
  id: string;
  amountCents: number;
  paymentStatus: string;
  escrowStatus: string;
  escrowReleaseDate: string | null;
  createdAt: string;
  project: {
    id: string;
    title: string;
    description: string;
    thumbnailImageUrl: string | null;
    status: string;
  };
  seller: {
    id: string;
    username: string | null;
    fullName: string | null;
  };
}

interface PurchasesResponse {
  transactions: Purchase[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Returns a human-readable label and badge variant for escrow status
 */
function escrowStatusInfo(status: string): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  switch (status) {
    case 'held':
      return { label: 'In Escrow', variant: 'secondary' };
    case 'released':
      return { label: 'Released', variant: 'default' };
    case 'refunded':
      return { label: 'Refunded', variant: 'destructive' };
    case 'disputed':
      return { label: 'Disputed', variant: 'destructive' };
    default:
      return { label: status, variant: 'outline' };
  }
}

/**
 * Returns a human-readable label and badge variant for payment status
 */
function paymentStatusInfo(status: string): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  switch (status) {
    case 'succeeded':
      return { label: 'Paid', variant: 'default' };
    case 'pending':
      return { label: 'Pending', variant: 'secondary' };
    case 'failed':
      return { label: 'Failed', variant: 'destructive' };
    case 'refunded':
      return { label: 'Refunded', variant: 'destructive' };
    default:
      return { label: status, variant: 'outline' };
  }
}

export default function BuyerPurchasesPage() {
  const router = useRouter();
  const { status: sessionStatus } = useSession();

  const [purchases, setPurchases] = React.useState<Purchase[]>([]);
  const [pagination, setPagination] = React.useState({
    page: 1,
    totalPages: 1,
    total: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchPurchases = React.useCallback(async (page: number) => {
    setIsLoading(true);
    setError(null);

    console.log(`[${componentName}] Fetching purchases page:`, page);

    try {
      const response = await fetch(`/api/transactions?view=buyer&page=${page}&limit=10`);

      if (!response.ok) {
        throw new Error('Failed to load purchases');
      }

      const data: PurchasesResponse = await response.json();

      setPurchases(data.transactions);
      setPagination({
        page: data.page,
        totalPages: data.totalPages,
        total: data.total,
        hasNext: data.hasNext,
        hasPrev: data.hasPrev,
      });

      console.log(`[${componentName}] Loaded ${data.transactions.length} purchases`);
    } catch (err) {
      console.error(`[${componentName}] Fetch error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load purchases');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (sessionStatus === 'authenticated') {
      fetchPurchases(1);
    }
  }, [sessionStatus, router, fetchPurchases]);

  const formatPrice = (cents: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(cents / 100);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(dateStr));
  };

  return (
    <div className="container mx-auto max-w-5xl py-10">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Purchases</h1>
            <p className="text-muted-foreground">
              {pagination.total > 0
                ? `${pagination.total} project${pagination.total !== 1 ? 's' : ''} purchased`
                : 'Projects you have purchased'}
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/projects')}>
            <ShoppingBag className="mr-2 h-4 w-4" />
            Browse Projects
          </Button>
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading */}
        {isLoading && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!isLoading && !error && purchases.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
              <ShoppingBag className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <h3 className="text-lg font-semibold">No purchases yet</h3>
                <p className="text-sm text-muted-foreground">
                  Browse the marketplace to find your next project.
                </p>
              </div>
              <Button onClick={() => router.push('/projects')}>Browse Projects</Button>
            </CardContent>
          </Card>
        )}

        {/* Purchase list */}
        {!isLoading && !error && purchases.length > 0 && (
          <div className="space-y-4">
            {purchases.map((purchase) => {
              const escrow = escrowStatusInfo(purchase.escrowStatus);
              const payment = paymentStatusInfo(purchase.paymentStatus);

              return (
                <Card key={purchase.id} className="transition-shadow hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="truncate text-lg">
                          {purchase.project.title}
                        </CardTitle>
                        <CardDescription className="mt-1 line-clamp-2">
                          {purchase.project.description}
                        </CardDescription>
                      </div>

                      {/* Price */}
                      <div className="shrink-0 text-right">
                        <p className="text-xl font-bold">
                          {formatPrice(purchase.amountCents)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(purchase.createdAt)}
                        </p>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      {/* Status badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={payment.variant}>{payment.label}</Badge>
                        <Badge variant={escrow.variant}>{escrow.label}</Badge>

                        {/* Escrow release date */}
                        {purchase.escrowStatus === 'held' &&
                          purchase.escrowReleaseDate && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              Releases {formatDate(purchase.escrowReleaseDate)}
                            </span>
                          )}

                        {/* Escrow released */}
                        {purchase.escrowStatus === 'released' && (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Funds released to seller
                          </span>
                        )}
                      </div>

                      {/* Seller info + actions */}
                      <div className="flex items-center gap-3">
                        <p className="text-sm text-muted-foreground">
                          Sold by{' '}
                          <span className="font-medium text-foreground">
                            {purchase.seller.fullName ||
                              purchase.seller.username ||
                              'Unknown seller'}
                          </span>
                        </p>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/transactions/${purchase.id}`)}
                        >
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          View Details
                        </Button>
                      </div>
                    </div>

                    {/* GitHub access note */}
                    {purchase.project.status === 'sold' && (
                      <div className="mt-3 flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                        <Github className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          Need repository access?{' '}
                          <button
                            className="font-medium text-foreground underline-offset-2 hover:underline"
                            onClick={() =>
                              router.push(
                                `/checkout/success?transactionId=${purchase.id}`
                              )
                            }
                          >
                            Set up GitHub access
                          </button>
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasPrev}
                onClick={() => fetchPurchases(pagination.page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasNext}
                onClick={() => fetchPurchases(pagination.page + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
