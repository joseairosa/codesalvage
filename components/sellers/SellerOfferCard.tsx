/**
 * SellerOfferCard
 *
 * Individual offer card for the seller offers page.
 * Manages its own accept / reject / counter-offer action state.
 * Shows a "View Sale" link once an offer has a linked transaction.
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
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
  ExternalLink,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { OfferItem } from '@/app/seller/offers/page';

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

function buyerName(buyer: OfferItem['buyer']) {
  return buyer.fullName ?? buyer.username ?? buyer.email;
}

function buyerInitials(buyer: OfferItem['buyer']) {
  return buyerName(buyer)
    .split(' ')
    .map((p: string) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export interface SellerOfferCardProps {
  offer: OfferItem;
  onRefresh: () => void;
}

export function SellerOfferCard({ offer, onRefresh }: SellerOfferCardProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [counterOpen, setCounterOpen] = React.useState(false);
  const [counterPrice, setCounterPrice] = React.useState('');
  const [counterMsg, setCounterMsg] = React.useState('');

  const doPost = async (url: string, body?: object) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        ...(body
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }
          : {}),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? 'Action failed');
      }
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => doPost(`/api/offers/${offer.id}/accept`);
  const handleReject = () => doPost(`/api/offers/${offer.id}/reject`, {});

  const handleCounter = async () => {
    const priceDollars = parseFloat(counterPrice);
    if (isNaN(priceDollars) || priceDollars <= 0) {
      setError('Please enter a valid price');
      return;
    }
    const body: { counterPriceCents: number; message?: string } = {
      counterPriceCents: Math.round(priceDollars * 100),
    };
    if (counterMsg.trim()) body.message = counterMsg.trim();
    await doPost(`/api/offers/${offer.id}/counter`, body);
    setCounterOpen(false);
    setCounterPrice('');
    setCounterMsg('');
  };

  const disc = discountPct(offer.offeredPriceCents, offer.originalPriceCents);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
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
              <CardTitle className="text-base">{offer.project.title}</CardTitle>
              <CardDescription className="mt-1">
                Offer from{' '}
                <span className="font-medium text-foreground">
                  {buyerName(offer.buyer)}
                </span>
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {offer.parentOfferId && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                Counter-offer
              </Badge>
            )}
            <Badge variant="secondary" className={statusClasses(offer.status)}>
              {offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Price */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-lg font-bold">{fmt(offer.offeredPriceCents)}</span>
            <span className="ml-1 text-sm text-muted-foreground line-through">
              {fmt(offer.originalPriceCents)}
            </span>
          </div>
          {disc > 0 && (
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              {disc}% below listing
            </Badge>
          )}
          {disc < 0 && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {Math.abs(disc)}% above listing
            </Badge>
          )}
        </div>

        {/* Buyer */}
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={offer.buyer.avatarUrl ?? undefined}
              alt={buyerName(offer.buyer)}
            />
            <AvatarFallback className="text-xs">
              {buyerInitials(offer.buyer)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{buyerName(offer.buyer)}</p>
            <p className="text-xs text-muted-foreground">{offer.buyer.email}</p>
          </div>
        </div>

        {/* Buyer message */}
        {offer.message && (
          <div className="rounded-md bg-muted/50 p-3">
            <div className="mb-1 flex items-center gap-1">
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
            <span>Received {fmtDate(offer.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Expires {fmtDate(offer.expiresAt)}</span>
          </div>
        </div>

        {/* Action error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Actions: pending */}
        {offer.status === 'pending' && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleAccept} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1 h-3 w-3" />
              )}
              Accept
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleReject}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <XCircle className="mr-1 h-3 w-3" />
              )}
              Reject
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCounterOpen(true)}
              disabled={loading}
            >
              <ArrowRight className="mr-1 h-3 w-3" />
              Counter
            </Button>
          </div>
        )}

        {/* Actions: countered */}
        {offer.status === 'countered' && (
          <p className="text-sm italic text-muted-foreground">Awaiting buyer response</p>
        )}

        {/* Actions: accepted — show View Sale if transaction exists */}
        {offer.status === 'accepted' && (
          <div className="flex items-center gap-3">
            <p className="text-sm font-medium text-green-700">Buyer can now checkout</p>
            {offer.transactionId && (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/transactions/${offer.transactionId}`}>
                  <ExternalLink className="mr-1 h-3 w-3" />
                  View Sale
                </Link>
              </Button>
            )}
          </div>
        )}

        {/* Counter-offer form */}
        {counterOpen && (
          <div className="mt-4 space-y-3 rounded-lg border bg-muted/50 p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Counter-Offer</span>
            </div>
            <div className="space-y-2">
              <label
                htmlFor={`counter-price-${offer.id}`}
                className="text-sm text-muted-foreground"
              >
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
              <label
                htmlFor={`counter-message-${offer.id}`}
                className="text-sm text-muted-foreground"
              >
                Message (optional)
              </label>
              <Textarea
                id={`counter-message-${offer.id}`}
                placeholder="Explain your counter-offer..."
                rows={3}
                value={counterMsg}
                onChange={(e) => setCounterMsg(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCounter} disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <ArrowRight className="mr-1 h-3 w-3" />
                )}
                Send Counter-Offer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCounterOpen(false);
                  setCounterPrice('');
                  setCounterMsg('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
