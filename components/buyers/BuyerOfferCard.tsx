/**
 * BuyerOfferCard
 *
 * Individual offer card for the buyer offers page.
 * Shows offer details, status, pricing, and context-aware action buttons:
 * - Accepted + no transaction → "Proceed to Checkout"
 * - Accepted + transaction exists → "View Purchase" (links to transaction)
 * - Pending → "Withdraw"
 * - Countered → Accept / Reject counter-offer
 */

'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Tag,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  ShoppingCart,
  Package,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import type { OfferItem } from '@/app/dashboard/offers/page';

function fmt(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    cents / 100
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

function discountPct(offered: number, original: number) {
  if (original === 0) return 0;
  return Math.round(((original - offered) / original) * 100);
}

function statusClasses(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    accepted: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    countered: 'bg-blue-100 text-blue-800',
    withdrawn: 'bg-gray-100 text-gray-800',
    expired: 'bg-gray-100 text-gray-600',
  };
  return map[status] ?? 'bg-gray-100 text-gray-800';
}

function sellerName(seller: OfferItem['seller']) {
  return seller.fullName ?? seller.username ?? seller.email;
}

function sellerInitials(seller: OfferItem['seller']) {
  return sellerName(seller)
    .split(' ')
    .map((p: string) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export interface BuyerOfferCardProps {
  offer: OfferItem;
  isActionLoading: boolean;
  onWithdraw: (offerId: string) => void;
  onAcceptCounter: (offerId: string) => void;
  onRejectCounter: (offerId: string) => void;
}

export function BuyerOfferCard({
  offer,
  isActionLoading,
  onWithdraw,
  onAcceptCounter,
  onRejectCounter,
}: BuyerOfferCardProps) {
  const router = useRouter();
  const discount = discountPct(offer.offeredPriceCents, offer.originalPriceCents);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 sm:flex-row">
          {/* Thumbnail */}
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

          {/* Details */}
          <div className="flex-1 space-y-3">
            {/* Title + Status */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={() => router.push(`/projects/${offer.project.id}`)}
                className="text-left text-lg font-semibold hover:underline"
              >
                {offer.project.title}
              </button>
              <Badge className={statusClasses(offer.status)}>
                {offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
              </Badge>
            </div>

            {/* Seller */}
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage
                  src={offer.seller.avatarUrl || undefined}
                  alt={sellerName(offer.seller)}
                />
                <AvatarFallback className="text-xs">
                  {sellerInitials(offer.seller)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                {sellerName(offer.seller)}
              </span>
            </div>

            {/* Pricing */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{fmt(offer.offeredPriceCents)}</span>
                <span className="text-sm text-muted-foreground">offered</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <span>vs</span>
                <span className="line-through">{fmt(offer.originalPriceCents)}</span>
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
                <span>Sent {fmtDate(offer.createdAt)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Expires {fmtDate(offer.expiresAt)}</span>
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
                        {fmt(offer.counterOffer.offeredPriceCents)}
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
                        onClick={() => onAcceptCounter(offer.counterOffer!.id)}
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
                        onClick={() => onRejectCounter(offer.counterOffer!.id)}
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
                  onClick={() => onWithdraw(offer.id)}
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

              {offer.status === 'accepted' && offer.transactionId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push(`/transactions/${offer.transactionId}`)}
                >
                  <Package className="mr-2 h-4 w-4" />
                  View Purchase
                </Button>
              )}

              {offer.status === 'accepted' && !offer.transactionId && (
                <Button
                  size="sm"
                  onClick={() =>
                    router.push(`/checkout/${offer.projectId}?offerId=${offer.id}`)
                  }
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
}
