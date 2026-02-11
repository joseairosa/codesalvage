/**
 * Buyer Offers Page (Protected Route - Buyer View)
 *
 * Dashboard for buyers to view and manage offers they've sent.
 * View, withdraw, accept counter-offers, and proceed to checkout.
 *
 * Features:
 * - List all buyer's sent offers
 * - Filter by status (All, Pending, Accepted, Rejected, Countered, Withdrawn, Expired)
 * - Offer cards with project details, seller info, pricing
 * - Status-based action buttons (Withdraw, Accept, Reject, Proceed to Checkout)
 * - Counter-offer display and response
 * - Pagination
 * - Loading and empty states
 *
 * @example
 * /dashboard/offers
 */

'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/hooks/useSession';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  ShoppingCart,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';

const componentName = 'BuyerOffersPage';

/**
 * Offer status type
 */
type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'countered' | 'withdrawn' | 'expired';

/**
 * Offer item from the API
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

/**
 * Pagination from the API
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
  if (isNaN(d.getTime())) return '\u2014';
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
  if (originalCents <= 0) return 0;
  return Math.round(((originalCents - offeredCents) / originalCents) * 100);
}

/**
 * Get status badge classes
 */
function getStatusClasses(status: string): string {
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
 * Get status label
 */
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    accepted: 'Accepted',
    rejected: 'Rejected',
    countered: 'Countered',
    withdrawn: 'Withdrawn',
    expired: 'Expired',
  };
  return labels[status] || status;
}

/**
 * Get seller display name
 */
function getSellerDisplayName(seller: OfferItem['seller']): string {
  return seller.fullName || seller.username || seller.email;
}

/**
 * Get seller initials for avatar fallback
 */
function getSellerInitials(seller: OfferItem['seller']): string {
  const name = seller.fullName || seller.username || seller.email;
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const ITEMS_PER_PAGE = 20;

export default function BuyerOffersPage() {
  console.log(`[${componentName}] Page rendered`);

  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  // State
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
   * Fetch buyer's offers from API
   */
  const fetchOffers = React.useCallback(
    async (page: number = 1) => {
      if (!session?.user?.id) {
        console.log(`[${componentName}] No session, skipping fetch`);
        return;
      }

      console.log(`[${componentName}] Fetching buyer offers, page:`, page, 'filter:', statusFilter);
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          view: 'buyer',
          page: String(page),
          limit: String(ITEMS_PER_PAGE),
        });

        if (statusFilter !== 'all') {
          params.set('status', statusFilter);
        }

        const response = await fetch(`/api/offers?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Failed to fetch offers');
        }

        const data = await response.json();
        console.log(`[${componentName}] Fetched ${data.offers.length} offers, total: ${data.pagination.total}`);

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
   * Fetch offers when session is ready or filter/page changes
   */
  React.useEffect(() => {
    if (sessionStatus === 'authenticated') {
      fetchOffers(currentPage);
    }
  }, [sessionStatus, fetchOffers, currentPage]);

  /**
   * Reset to page 1 when filter changes
   */
  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  /**
   * Handle withdraw offer
   */
  const handleWithdraw = async (offerId: string) => {
    console.log(`[${componentName}] Withdraw offer:`, offerId);
    setActionLoading(offerId);

    try {
      const response = await fetch(`/api/offers/${offerId}/withdraw`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to withdraw offer');
      }

      console.log(`[${componentName}] Offer withdrawn successfully`);
      await fetchOffers(currentPage);
    } catch (err) {
      console.error(`[${componentName}] Withdraw error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to withdraw offer');
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * Handle accept counter-offer
   */
  const handleAcceptCounter = async (offerId: string) => {
    console.log(`[${componentName}] Accept counter-offer:`, offerId);
    setActionLoading(offerId);

    try {
      const response = await fetch(`/api/offers/${offerId}/accept`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to accept counter-offer');
      }

      console.log(`[${componentName}] Counter-offer accepted successfully`);
      await fetchOffers(currentPage);
    } catch (err) {
      console.error(`[${componentName}] Accept error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to accept counter-offer');
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * Handle reject counter-offer
   */
  const handleRejectCounter = async (offerId: string) => {
    console.log(`[${componentName}] Reject counter-offer:`, offerId);
    setActionLoading(offerId);

    try {
      const response = await fetch(`/api/offers/${offerId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to reject counter-offer');
      }

      console.log(`[${componentName}] Counter-offer rejected successfully`);
      await fetchOffers(currentPage);
    } catch (err) {
      console.error(`[${componentName}] Reject error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to reject counter-offer');
    } finally {
      setActionLoading(null);
    }
  };

  /**
   * Handle proceed to checkout
   */
  const handleCheckout = (projectId: string, offerId: string) => {
    console.log(`[${componentName}] Proceed to checkout, project:`, projectId, 'offer:', offerId);
    router.push(`/checkout/${projectId}?offerId=${offerId}`);
  };

  /**
   * Handle page change
   */
  const handlePageChange = (newPage: number) => {
    console.log(`[${componentName}] Page change:`, newPage);
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Show loading while session resolves
  if (sessionStatus === 'loading') {
    return (
      <div className="container mx-auto max-w-7xl py-10">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Don't render if unauthenticated (redirect is happening)
  if (sessionStatus === 'unauthenticated') {
    return null;
  }

  return (
    <div className="container mx-auto max-w-7xl py-10">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Offers</h1>
            <p className="mt-2 text-muted-foreground">
              {isLoading
                ? 'Loading your offers...'
                : `${pagination.total} offer${pagination.total !== 1 ? 's' : ''} total`}
            </p>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex gap-4">
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
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
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

        {/* Offers List */}
        {!isLoading && offers.length > 0 && (
          <div className="space-y-4">
            {offers.map((offer) => {
              const discount = calcDiscount(offer.offeredPriceCents, offer.originalPriceCents);
              const isActionLoading = actionLoading === offer.id;

              return (
                <Card key={offer.id}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col gap-4 sm:flex-row">
                      {/* Project Thumbnail */}
                      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                        {offer.project.thumbnailImageUrl ? (
                          <Image
                            src={offer.project.thumbnailImageUrl}
                            alt={offer.project.title}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Tag className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Offer Details */}
                      <div className="flex-1 space-y-3">
                        {/* Top Row: Title + Status */}
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <button
                            onClick={() => router.push(`/projects/${offer.project.id}`)}
                            className="text-left text-lg font-semibold hover:underline"
                          >
                            {offer.project.title}
                          </button>
                          <Badge className={getStatusClasses(offer.status)}>
                            {getStatusLabel(offer.status)}
                          </Badge>
                        </div>

                        {/* Seller Info */}
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage
                              src={offer.seller.avatarUrl || undefined}
                              alt={getSellerDisplayName(offer.seller)}
                            />
                            <AvatarFallback className="text-xs">
                              {getSellerInitials(offer.seller)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-muted-foreground">
                            {getSellerDisplayName(offer.seller)}
                          </span>
                        </div>

                        {/* Pricing */}
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">
                              {formatPrice(offer.offeredPriceCents)}
                            </span>
                            <span className="text-sm text-muted-foreground">offered</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <span>vs</span>
                            <span className="line-through">
                              {formatPrice(offer.originalPriceCents)}
                            </span>
                            <span>listed</span>
                          </div>
                          {discount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {discount}% off
                            </Badge>
                          )}
                        </div>

                        {/* Message */}
                        {offer.message && (
                          <p className="text-sm text-muted-foreground">
                            &ldquo;{offer.message}&rdquo;
                          </p>
                        )}

                        {/* Dates */}
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Sent {formatDate(offer.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Expires {formatDate(offer.expiresAt)}</span>
                          </div>
                        </div>

                        {/* Counter-Offer Section */}
                        {offer.status === 'countered' &&
                          offer.counterOffer &&
                          offer.parentOfferId === null && (
                            <>
                              <Separator />
                              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                                <div className="mb-2 flex items-center gap-2">
                                  <ArrowRight className="h-4 w-4 text-blue-600" />
                                  <span className="font-medium text-blue-800">
                                    Counter-Offer Received
                                  </span>
                                </div>
                                <div className="mb-2 flex items-center gap-2">
                                  <DollarSign className="h-4 w-4 text-blue-600" />
                                  <span className="text-lg font-bold text-blue-900">
                                    {formatPrice(offer.counterOffer.offeredPriceCents)}
                                  </span>
                                </div>
                                {offer.counterOffer.message && (
                                  <p className="mb-3 text-sm text-blue-700">
                                    &ldquo;{offer.counterOffer.message}&rdquo;
                                  </p>
                                )}
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleAcceptCounter(offer.counterOffer!.id)}
                                    disabled={isActionLoading}
                                  >
                                    {isActionLoading ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="mr-2 h-4 w-4" />
                                    )}
                                    Accept
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRejectCounter(offer.counterOffer!.id)}
                                    disabled={isActionLoading}
                                  >
                                    {isActionLoading ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <XCircle className="mr-2 h-4 w-4" />
                                    )}
                                    Reject
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-1">
                          {offer.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleWithdraw(offer.id)}
                              disabled={isActionLoading}
                            >
                              {isActionLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="mr-2 h-4 w-4" />
                              )}
                              Withdraw
                            </Button>
                          )}

                          {offer.status === 'accepted' && (
                            <Button
                              size="sm"
                              onClick={() => handleCheckout(offer.projectId, offer.id)}
                            >
                              <ShoppingCart className="mr-2 h-4 w-4" />
                              Proceed to Checkout
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Empty State */}
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
              {Math.min(currentPage * ITEMS_PER_PAGE, pagination.total)} of {pagination.total}{' '}
              offers
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
