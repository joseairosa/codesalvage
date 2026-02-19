/**
 * TransactionSummaryCard
 *
 * Right-column summary panel for a transaction: pricing breakdown,
 * dates, payment status. Visible to both buyer and seller (seller
 * additionally sees "You Receive" row).
 */

'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface TransactionSummaryData {
  id: string;
  amountCents: number;
  commissionCents: number;
  sellerReceivesCents: number;
  paymentStatus: string;
  escrowStatus: string;
  escrowReleaseDate: string | null;
  createdAt: string;
}

export interface TransactionSummaryCardProps {
  transaction: TransactionSummaryData;
  userRole: 'buyer' | 'seller';
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

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

export function TransactionSummaryCard({
  transaction,
  userRole,
}: TransactionSummaryCardProps) {
  const [copiedId, setCopiedId] = React.useState(false);

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(transaction.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {}
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Amount Paid</p>
          <p className="text-lg font-semibold">{formatPrice(transaction.amountCents)}</p>
        </div>

        <div>
          <p className="text-sm text-muted-foreground">Platform Fee</p>
          <p className="font-semibold">{formatPrice(transaction.commissionCents)}</p>
        </div>

        {userRole === 'seller' && (
          <div>
            <p className="text-sm text-muted-foreground">You Receive</p>
            <p className="font-semibold text-green-600">
              {formatPrice(transaction.sellerReceivesCents)}
            </p>
          </div>
        )}

        <div className="border-t pt-4" />

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

        <div>
          <p className="text-sm text-muted-foreground">Created</p>
          <p className="text-sm font-medium">{formatDate(transaction.createdAt)}</p>
        </div>

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
  );
}
