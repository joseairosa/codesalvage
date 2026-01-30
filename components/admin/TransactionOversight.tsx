/**
 * TransactionOversight Component
 *
 * Responsibilities:
 * - Fetch and display transactions with filters
 * - Provide manual escrow release action
 * - Handle pagination
 * - Show transaction, buyer, seller, and project details
 *
 * Architecture:
 * - Client Component with state management
 * - Table-based layout with action buttons
 * - Dialog for escrow release reason
 * - Real-time updates after actions
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  DollarSign,
  User,
  Package,
  ExternalLink,
  Unlock,
} from 'lucide-react';

/**
 * Transaction Interface (matching API response)
 */
interface Transaction {
  id: string;
  amountCents: number;
  paymentStatus: string;
  escrowStatus: string;
  escrowReleaseDate: Date | null;
  createdAt: Date;
  project: {
    id: string;
    title: string;
    priceCents: number;
  };
  seller: {
    id: string;
    username: string;
    email: string;
    isVerifiedSeller: boolean;
  };
  buyer: {
    id: string;
    username: string;
    email: string;
  };
}

/**
 * TransactionOversight Component
 */
export function TransactionOversight() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [escrowStatusFilter, setEscrowStatusFilter] = useState<string>('all');

  // Pagination
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Release escrow dialog state
  const [releaseDialogOpen, setReleaseDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(
    null
  );
  const [releaseReason, setReleaseReason] = useState('');
  const [releaseError, setReleaseError] = useState<string | null>(null);

  /**
   * Fetch transactions with current filters
   */
  async function fetchTransactions() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (paymentStatusFilter !== 'all') {
        params.append('paymentStatus', paymentStatusFilter);
      }

      if (escrowStatusFilter !== 'all') {
        params.append('escrowStatus', escrowStatusFilter);
      }

      const res = await fetch(`/api/admin/transactions?${params.toString()}`);

      if (!res.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await res.json();
      setTransactions(data.transactions);
      setTotal(data.pagination.total);
    } catch (err) {
      console.error('[TransactionOversight] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Fetch transactions on mount and filter changes
   */
  useEffect(() => {
    fetchTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentStatusFilter, escrowStatusFilter, offset]);

  /**
   * Handle release escrow
   */
  async function handleReleaseEscrow() {
    if (!selectedTransaction || !releaseReason.trim()) {
      setReleaseError('Please provide a release reason (minimum 10 characters)');
      return;
    }

    setActionLoading(selectedTransaction.id);
    setReleaseError(null);

    try {
      const res = await fetch(
        `/api/admin/transactions/${selectedTransaction.id}/release-escrow`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: releaseReason }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to release escrow');
      }

      await fetchTransactions();
      setReleaseDialogOpen(false);
      setSelectedTransaction(null);
      setReleaseReason('');
    } catch (err) {
      console.error('[TransactionOversight] Release error:', err);
      setReleaseError(err instanceof Error ? err.message : 'Failed to release escrow');
    } finally {
      setActionLoading(null);
    }
  }

  /**
   * Open release escrow dialog
   */
  function openReleaseDialog(transaction: Transaction) {
    setSelectedTransaction(transaction);
    setReleaseReason('');
    setReleaseError(null);
    setReleaseDialogOpen(true);
  }

  /**
   * Format currency
   */
  function formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }

  /**
   * Format date
   */
  function formatDate(date: Date | null): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row">
            {/* Filter by payment status */}
            <div className="flex-1">
              <Label className="text-xs">Payment Status</Label>
              <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All payments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All payments</SelectItem>
                  <SelectItem value="succeeded">Succeeded</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter by escrow status */}
            <div className="flex-1">
              <Label className="text-xs">Escrow Status</Label>
              <Select value={escrowStatusFilter} onValueChange={setEscrowStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All escrow" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All escrow</SelectItem>
                  <SelectItem value="held">Held</SelectItem>
                  <SelectItem value="released">Released</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No transactions found with the selected filters.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Escrow</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-gray-400" />
                            <Link
                              href={`/projects/${transaction.project.id}`}
                              className="max-w-[200px] truncate text-sm hover:underline"
                              target="_blank"
                            >
                              {transaction.project.title}
                            </Link>
                            <ExternalLink className="h-3 w-3 text-gray-400" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 font-medium">
                            <DollarSign className="h-4 w-4 text-gray-400" />
                            {formatCurrency(transaction.amountCents)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">{transaction.buyer.username}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">{transaction.seller.username}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              transaction.paymentStatus === 'succeeded'
                                ? 'default'
                                : transaction.paymentStatus === 'failed'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {transaction.paymentStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              transaction.escrowStatus === 'released'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {transaction.escrowStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {formatDate(transaction.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {transaction.escrowStatus === 'held' &&
                          transaction.paymentStatus === 'succeeded' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openReleaseDialog(transaction)}
                              disabled={actionLoading === transaction.id}
                              className="gap-1"
                            >
                              <Unlock className="h-3 w-3" />
                              Release
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-400">No action</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}{' '}
                  transactions
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOffset(offset + limit)}
                    disabled={offset + limit >= total}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Release Escrow Dialog */}
      <Dialog open={releaseDialogOpen} onOpenChange={setReleaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release Escrow Manually</DialogTitle>
            <DialogDescription>
              You are about to release escrow for transaction{' '}
              {selectedTransaction?.id.substring(0, 8)}. This will transfer funds to the
              seller.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg border bg-gray-50 p-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-600">Amount:</div>
                <div className="font-medium">
                  {selectedTransaction && formatCurrency(selectedTransaction.amountCents)}
                </div>
                <div className="text-gray-600">Project:</div>
                <div className="font-medium">{selectedTransaction?.project.title}</div>
                <div className="text-gray-600">Seller:</div>
                <div className="font-medium">{selectedTransaction?.seller.username}</div>
              </div>
            </div>

            <div>
              <Label htmlFor="release-reason">Reason for manual release *</Label>
              <Textarea
                id="release-reason"
                placeholder="Enter reason for releasing escrow (minimum 10 characters)..."
                value={releaseReason}
                onChange={(e) => setReleaseReason(e.target.value)}
                rows={4}
                className="mt-2"
              />
              <p className="mt-1 text-xs text-gray-500">
                This will be recorded in the audit log
              </p>
              {releaseError && (
                <p className="mt-2 text-sm text-red-600">{releaseError}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReleaseDialogOpen(false)}
              disabled={actionLoading === selectedTransaction?.id}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReleaseEscrow}
              disabled={
                actionLoading === selectedTransaction?.id || !releaseReason.trim()
              }
            >
              {actionLoading === selectedTransaction?.id
                ? 'Releasing...'
                : 'Release Escrow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
