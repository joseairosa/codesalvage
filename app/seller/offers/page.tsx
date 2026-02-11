/**
 * Seller Dashboard - Offers Management Page
 *
 * Dashboard for sellers to view and manage offers received on their projects.
 * Accept, reject, or counter-offer on buyer proposals.
 *
 * Features:
 * - List all offers received on seller's projects
 * - Filter by status (All, Pending, Accepted, Rejected, Countered, Expired)
 * - Accept, reject, or counter-offer actions
 * - Inline counter-offer form with price and optional message
 * - Status badges with color coding
 * - Pagination
 * - Loading and empty states
 *
 * @example
 * /seller/offers
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Tag,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  MessageCircle,
  ArrowRight,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const componentName = 'SellerOffersPage';

/**
 * Offer status type
 */
type OfferStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'countered'
  | 'withdrawn'
  | 'expired';

/**
 * Offer item shape from the API
 */
interface OfferItem {
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

/**
 * Format price in cents to USD
 */
function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Format date string
 */
function formatDate(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

/**
 * Calculate discount percentage
 */
function calcDiscount(offeredCents: number, originalCents: number): number {
  if (originalCents === 0) return 0;
  return Math.round(((originalCents - offeredCents) / originalCents) * 100);
}

/**
 * Get status badge class names
 */
function getStatusBadgeClasses(status: string): string {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    accepted: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    countered: 'bg-blue-100 text-blue-800',
    withdrawn: 'bg-gray-100 text-gray-800',
    expired: 'bg-gray-100 text-gray-600',
  };
  return map[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Get buyer display name
 */
function getBuyerDisplayName(buyer: OfferItem['buyer']): string {
  return buyer.fullName || buyer.username || buyer.email;
}

/**
 * Get buyer initials for avatar fallback
 */
function getBuyerInitials(buyer: OfferItem['buyer']): string {
  const name = buyer.fullName || buyer.username || buyer.email;
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function SellerOffersPage() {
  console.log(`[${componentName}] Page rendered`);

  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  // State
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

  // Action states
  const [actionStatus, setActionStatus] = React.useState<
    Record<string, 'idle' | 'loading' | 'success' | 'error'>
  >({});
  const [actionError, setActionError] = React.useState<Record<string, string>>({});

  // Counter-offer form state
  const [counterFormOpen, setCounterFormOpen] = React.useState<string | null>(null);
  const [counterPrice, setCounterPrice] = React.useState('');
  const [counterMessage, setCounterMessage] = React.useState('');

  /**
   * Redirect to sign-in if unauthenticated
   */
  React.useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      console.log(`[${componentName}] Unauthenticated, redirecting to sign-in`);
      router.push('/auth/signin');
    }
  }, [sessionStatus, router]);

  /**
   * Fetch offers from API
   */
  const fetchOffers = React.useCallback(
    async (page: number = 1) => {
      if (!session?.user?.id) {
        console.log(`[${componentName}] No session, skipping fetch`);
        return;
      }

      const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      const url = `/api/offers?view=seller${statusParam}&page=${page}&limit=20`;

      console.log(`[${componentName}] Fetching offers:`, url);
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error('Failed to fetch offers');
        }

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

  /**
   * Fetch offers when session is ready or filters change
   */
  React.useEffect(() => {
    if (sessionStatus === 'authenticated') {
      setCurrentPage(1);
      fetchOffers(1);
    }
  }, [sessionStatus, fetchOffers]);

  /**
   * Handle page change
   */
  const handlePageChange = (newPage: number) => {
    console.log(`[${componentName}] Page change:`, newPage);
    setCurrentPage(newPage);
    fetchOffers(newPage);
  };

  /**
   * Handle accept offer
   */
  const handleAccept = async (offerId: string) => {
    console.log(`[${componentName}] Accepting offer:`, offerId);
    setActionStatus((prev) => ({ ...prev, [offerId]: 'loading' }));
    setActionError((prev) => {
      const next = { ...prev };
      delete next[offerId];
      return next;
    });

    try {
      const response = await fetch(`/api/offers/${offerId}/accept`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to accept offer');
      }

      const data = await response.json();
      console.log(`[${componentName}] Offer accepted:`, offerId, data);

      setActionStatus((prev) => ({ ...prev, [offerId]: 'success' }));

      // Refresh offers list
      await fetchOffers(currentPage);
    } catch (err) {
      console.error(`[${componentName}] Accept error:`, err);
      const message = err instanceof Error ? err.message : 'Failed to accept offer';
      setActionStatus((prev) => ({ ...prev, [offerId]: 'error' }));
      setActionError((prev) => ({ ...prev, [offerId]: message }));
    }
  };

  /**
   * Handle reject offer
   */
  const handleReject = async (offerId: string) => {
    console.log(`[${componentName}] Rejecting offer:`, offerId);
    setActionStatus((prev) => ({ ...prev, [offerId]: 'loading' }));
    setActionError((prev) => {
      const next = { ...prev };
      delete next[offerId];
      return next;
    });

    try {
      const response = await fetch(`/api/offers/${offerId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to reject offer');
      }

      console.log(`[${componentName}] Offer rejected:`, offerId);
      setActionStatus((prev) => ({ ...prev, [offerId]: 'success' }));

      // Refresh offers list
      await fetchOffers(currentPage);
    } catch (err) {
      console.error(`[${componentName}] Reject error:`, err);
      const message = err instanceof Error ? err.message : 'Failed to reject offer';
      setActionStatus((prev) => ({ ...prev, [offerId]: 'error' }));
      setActionError((prev) => ({ ...prev, [offerId]: message }));
    }
  };

  /**
   * Handle opening counter-offer form
   */
  const handleCounterOpen = (offerId: string) => {
    console.log(`[${componentName}] Opening counter-offer form for:`, offerId);
    setCounterFormOpen(offerId);
    setCounterPrice('');
    setCounterMessage('');
  };

  /**
   * Handle closing counter-offer form
   */
  const handleCounterClose = () => {
    setCounterFormOpen(null);
    setCounterPrice('');
    setCounterMessage('');
  };

  /**
   * Handle submitting counter-offer
   */
  const handleCounterSubmit = async (offerId: string) => {
    const priceDollars = parseFloat(counterPrice);
    if (isNaN(priceDollars) || priceDollars <= 0) {
      setActionError((prev) => ({
        ...prev,
        [offerId]: 'Please enter a valid price',
      }));
      return;
    }

    const counterPriceCents = Math.round(priceDollars * 100);
    console.log(`[${componentName}] Submitting counter-offer:`, {
      offerId,
      counterPriceCents,
      message: counterMessage,
    });

    setActionStatus((prev) => ({ ...prev, [offerId]: 'loading' }));
    setActionError((prev) => {
      const next = { ...prev };
      delete next[offerId];
      return next;
    });

    try {
      const counterBody: { counterPriceCents: number; message?: string } = {
        counterPriceCents,
      };
      if (counterMessage.trim()) {
        counterBody.message = counterMessage.trim();
      }

      const response = await fetch(`/api/offers/${offerId}/counter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(counterBody),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit counter-offer');
      }

      console.log(`[${componentName}] Counter-offer submitted:`, offerId);
      setActionStatus((prev) => ({ ...prev, [offerId]: 'success' }));
      handleCounterClose();

      // Refresh offers list
      await fetchOffers(currentPage);
    } catch (err) {
      console.error(`[${componentName}] Counter-offer error:`, err);
      const message = err instanceof Error ? err.message : 'Failed to submit counter-offer';
      setActionStatus((prev) => ({ ...prev, [offerId]: 'error' }));
      setActionError((prev) => ({ ...prev, [offerId]: message }));
    }
  };

  /**
   * Render action buttons based on offer status
   */
  const renderActions = (offer: OfferItem) => {
    const status = offer.status as OfferStatus;
    const isActionLoading = actionStatus[offer.id] === 'loading';

    if (status === 'pending') {
      return (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => handleAccept(offer.id)}
            disabled={isActionLoading}
          >
            {isActionLoading ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1 h-3 w-3" />
            )}
            Accept
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleReject(offer.id)}
            disabled={isActionLoading}
          >
            {isActionLoading ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <XCircle className="mr-1 h-3 w-3" />
            )}
            Reject
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleCounterOpen(offer.id)}
            disabled={isActionLoading}
          >
            <ArrowRight className="mr-1 h-3 w-3" />
            Counter
          </Button>
        </div>
      );
    }

    if (status === 'countered') {
      return (
        <p className="text-sm text-muted-foreground italic">Awaiting buyer response</p>
      );
    }

    if (status === 'accepted') {
      return (
        <p className="text-sm text-green-700 font-medium">Buyer can now checkout</p>
      );
    }

    // rejected, withdrawn, expired — no actions
    return null;
  };

  /**
   * Render the counter-offer inline form
   */
  const renderCounterForm = (offer: OfferItem) => {
    if (counterFormOpen !== offer.id) return null;

    return (
      <div className="mt-4 rounded-lg border bg-muted/50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Counter-Offer</span>
        </div>
        <div className="space-y-2">
          <label htmlFor={`counter-price-${offer.id}`} className="text-sm text-muted-foreground">
            Your counter price (USD)
          </label>
          <Input
            id={`counter-price-${offer.id}`}
            type="number"
            min="0.01"
            step="0.01"
            placeholder="e.g. 500.00"
            value={counterPrice}
            onChange={(e) => setCounterPrice(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor={`counter-message-${offer.id}`} className="text-sm text-muted-foreground">
            Message (optional)
          </label>
          <Textarea
            id={`counter-message-${offer.id}`}
            placeholder="Explain your counter-offer..."
            rows={3}
            value={counterMessage}
            onChange={(e) => setCounterMessage(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => handleCounterSubmit(offer.id)}
            disabled={actionStatus[offer.id] === 'loading'}
          >
            {actionStatus[offer.id] === 'loading' ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <ArrowRight className="mr-1 h-3 w-3" />
            )}
            Send Counter-Offer
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCounterClose}>
            Cancel
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto max-w-7xl py-10">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Offers Received</h1>
            <p className="mt-2 text-muted-foreground">
              {isLoading
                ? 'Loading offers...'
                : `${pagination.total} offer(s) total`}
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
                <Button onClick={() => fetchOffers(currentPage)} variant="outline" size="sm">
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
            {offers.map((offer) => {
              const discount = calcDiscount(offer.offeredPriceCents, offer.originalPriceCents);
              const isCounterOffer = !!offer.parentOfferId;

              return (
                <Card key={offer.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {/* Project Thumbnail */}
                        {offer.project.thumbnailImageUrl ? (
                          <img
                            src={offer.project.thumbnailImageUrl}
                            alt={offer.project.title}
                            className="h-12 w-12 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                            <Tag className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-base">
                            {offer.project.title}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            Offer from{' '}
                            <span className="font-medium text-foreground">
                              {getBuyerDisplayName(offer.buyer)}
                            </span>
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isCounterOffer && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700">
                            Counter-offer
                          </Badge>
                        )}
                        <Badge
                          variant="secondary"
                          className={getStatusBadgeClasses(offer.status)}
                        >
                          {offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Price Comparison */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-lg font-bold">
                            {formatPrice(offer.offeredPriceCents)}
                          </span>
                          <span className="ml-2 text-sm text-muted-foreground line-through">
                            {formatPrice(offer.originalPriceCents)}
                          </span>
                        </div>
                      </div>
                      {discount > 0 && (
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                          {discount}% below listing
                        </Badge>
                      )}
                      {discount < 0 && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          {Math.abs(discount)}% above listing
                        </Badge>
                      )}
                    </div>

                    {/* Buyer Info */}
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={offer.buyer.avatarUrl || undefined}
                          alt={getBuyerDisplayName(offer.buyer)}
                        />
                        <AvatarFallback className="text-xs">
                          {getBuyerInitials(offer.buyer)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{getBuyerDisplayName(offer.buyer)}</p>
                        <p className="text-xs text-muted-foreground">{offer.buyer.email}</p>
                      </div>
                    </div>

                    {/* Buyer Message */}
                    {offer.message && (
                      <div className="rounded-md bg-muted/50 p-3">
                        <div className="flex items-center gap-1 mb-1">
                          <MessageCircle className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">
                            Buyer message
                          </span>
                        </div>
                        <p className="text-sm">{offer.message}</p>
                      </div>
                    )}

                    <Separator />

                    {/* Dates */}
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Received {formatDate(offer.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>Expires {formatDate(offer.expiresAt)}</span>
                      </div>
                    </div>

                    {/* Action Error */}
                    {actionError[offer.id] && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{actionError[offer.id]}</AlertDescription>
                      </Alert>
                    )}

                    {/* Actions */}
                    {renderActions(offer)}

                    {/* Counter-offer Form */}
                    {renderCounterForm(offer)}
                  </CardContent>
                </Card>
              );
            })}
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
