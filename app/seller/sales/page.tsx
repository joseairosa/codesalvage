/**
 * Seller Sales Page
 *
 * Lists all projects sold by the authenticated seller.
 * Shows transaction status, buyer info, escrow details, and links
 * to individual transaction details.
 *
 * @example
 * /seller/sales
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
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
} from 'lucide-react';

const componentName = 'SellerSalesPage';

interface Sale {
  id: string;
  amountCents: number;
  sellerReceivesCents: number;
  paymentStatus: string;
  escrowStatus: string;
  escrowReleaseDate: string | null;
  releasedToSellerAt: string | null;
  createdAt: string;
  project: {
    id: string;
    title: string;
    description: string;
    thumbnailImageUrl: string | null;
    status: string;
  };
  buyer: {
    id: string;
    username: string | null;
    fullName: string | null;
  };
}

interface SalesResponse {
  transactions: Sale[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

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

export default function SellerSalesPage() {
  const router = useRouter();
  const { status: sessionStatus } = useSession();

  const [sales, setSales] = React.useState<Sale[]>([]);
  const [pagination, setPagination] = React.useState({
    page: 1,
    totalPages: 1,
    total: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchSales = React.useCallback(async (page: number) => {
    setIsLoading(true);
    setError(null);

    console.log(`[${componentName}] Fetching sales page:`, page);

    try {
      const response = await fetch(`/api/transactions?view=seller&page=${page}&limit=10`);

      if (!response.ok) {
        throw new Error('Failed to load sales');
      }

      const data: SalesResponse = await response.json();

      setSales(data.transactions);
      setPagination({
        page: data.page,
        totalPages: data.totalPages,
        total: data.total,
        hasNext: data.hasNext,
        hasPrev: data.hasPrev,
      });

      console.log(`[${componentName}] Loaded ${data.transactions.length} sales`);
    } catch (err) {
      console.error(`[${componentName}] Fetch error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load sales');
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
      fetchSales(1);
    }
  }, [sessionStatus, router, fetchSales]);

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

  const getBuyerName = (buyer: Sale['buyer']) =>
    buyer.fullName || buyer.username || 'Unknown buyer';

  return (
    <div className="container mx-auto max-w-5xl py-10">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Sales</h1>
            <p className="text-muted-foreground">
              {pagination.total > 0
                ? `${pagination.total} project${pagination.total !== 1 ? 's' : ''} sold`
                : 'Projects you have sold through the marketplace'}
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/seller/projects')}>
            <ShoppingBag className="mr-2 h-4 w-4" />
            My Projects
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
        {!isLoading && !error && sales.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
              <DollarSign className="h-12 w-12 text-muted-foreground" />
              <div className="text-center">
                <h3 className="text-lg font-semibold">No sales yet</h3>
                <p className="text-sm text-muted-foreground">
                  When a buyer purchases one of your projects, it will appear here.
                </p>
              </div>
              <Button onClick={() => router.push('/seller/projects')}>
                View My Projects
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Sales list */}
        {!isLoading && !error && sales.length > 0 && (
          <div className="space-y-4">
            {sales.map((sale) => {
              const escrow = escrowStatusInfo(sale.escrowStatus);
              const payment = paymentStatusInfo(sale.paymentStatus);

              return (
                <Card key={sale.id} className="transition-shadow hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <CardTitle className="truncate text-lg">
                          {sale.project.title}
                        </CardTitle>
                        <CardDescription className="mt-1 line-clamp-2">
                          {sale.project.description}
                        </CardDescription>
                      </div>

                      {/* Pricing */}
                      <div className="shrink-0 text-right">
                        <p className="text-xl font-bold">
                          {formatPrice(sale.amountCents)}
                        </p>
                        <p className="text-xs font-medium text-green-600">
                          You receive {formatPrice(sale.sellerReceivesCents)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(sale.createdAt)}
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

                        {/* Escrow held */}
                        {sale.escrowStatus === 'held' && sale.escrowReleaseDate && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Releases {formatDate(sale.escrowReleaseDate)}
                          </span>
                        )}

                        {/* Escrow released */}
                        {sale.escrowStatus === 'released' && (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Funds released{' '}
                            {sale.releasedToSellerAt
                              ? formatDate(sale.releasedToSellerAt)
                              : ''}
                          </span>
                        )}
                      </div>

                      {/* Buyer info + actions */}
                      <div className="flex items-center gap-3">
                        <p className="text-sm text-muted-foreground">
                          Bought by{' '}
                          <span className="font-medium text-foreground">
                            {getBuyerName(sale.buyer)}
                          </span>
                        </p>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/transactions/${sale.id}`)}
                        >
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          View Details
                        </Button>
                      </div>
                    </div>
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
                onClick={() => fetchSales(pagination.page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasNext}
                onClick={() => fetchSales(pagination.page + 1)}
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
