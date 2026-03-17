/**
 * PayoutManagement Component
 *
 * Admin interface for viewing and managing seller payouts.
 * Supports filtering by status, marking completed, and retrying failed payouts.
 */

'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Clock,
  DollarSign,
} from 'lucide-react';

const componentName = 'PayoutManagement';

interface PayoutRequest {
  id: string;
  transactionId: string;
  sellerId: string;
  amountCents: number;
  commissionCents: number;
  payoutMethod: string;
  payoutEmail: string;
  status: string;
  externalReference: string | null;
  batchId: string | null;
  processedAt: string | null;
  processedBy: string | null;
  failedReason: string | null;
  createdAt: string;
  seller: {
    id: string;
    email: string | null;
    fullName: string | null;
    username: string;
  };
  transaction: {
    id: string;
    projectId: string;
    project: { title: string };
  };
}

interface PayoutListResponse {
  payoutRequests: PayoutRequest[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  processing: Loader2,
  completed: CheckCircle2,
  failed: AlertCircle,
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PayoutManagement() {
  const [payouts, setPayouts] = React.useState<PayoutRequest[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [isLoading, setIsLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [completeRef, setCompleteRef] = React.useState('');
  const [completeId, setCompleteId] = React.useState<string | null>(null);

  const fetchPayouts = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const response = await fetch(`/api/admin/payouts?${params}`);
      if (!response.ok) throw new Error('Failed to fetch payouts');

      const data: PayoutListResponse = await response.json();
      setPayouts(data.payoutRequests);
      setTotal(data.total);
    } catch (err) {
      console.error(`[${componentName}] Fetch error:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  React.useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  const handleAction = async (id: string, action: 'complete' | 'retry', externalReference?: string) => {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/admin/payouts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, externalReference }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Action failed');
      }

      setCompleteId(null);
      setCompleteRef('');
      await fetchPayouts();
    } catch (err) {
      console.error(`[${componentName}] Action error:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2 text-sm text-gray-500">
            <DollarSign className="h-4 w-4" />
            <span>{total} payout{total !== 1 ? 's' : ''}</span>
          </div>
        </CardContent>
      </Card>

      {/* Payouts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : payouts.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              No payout requests found
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4">Seller</th>
                    <th className="pb-3 pr-4">Project</th>
                    <th className="pb-3 pr-4">Amount</th>
                    <th className="pb-3 pr-4">Method</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Created</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => {
                    const StatusIcon = STATUS_ICONS[payout.status] || Clock;
                    return (
                      <tr key={payout.id} className="border-b last:border-0">
                        <td className="py-3 pr-4">
                          <div>
                            <p className="font-medium">{payout.seller.fullName || payout.seller.username}</p>
                            <p className="text-xs text-muted-foreground">{payout.payoutEmail}</p>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-xs">
                          {payout.transaction.project.title}
                        </td>
                        <td className="py-3 pr-4 font-mono">
                          {formatCents(payout.amountCents)}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge variant="outline" className="text-xs">
                            {payout.payoutMethod}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge className={`${STATUS_COLORS[payout.status] || ''} text-xs`}>
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {payout.status}
                          </Badge>
                          {payout.failedReason && (
                            <p className="mt-1 text-xs text-red-600">{payout.failedReason}</p>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-xs text-muted-foreground">
                          {new Date(payout.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            {(payout.status === 'pending' || payout.status === 'processing') && (
                              <>
                                {completeId === payout.id ? (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      placeholder="Reference #"
                                      value={completeRef}
                                      onChange={(e) => setCompleteRef(e.target.value)}
                                      className="h-8 w-32 text-xs"
                                    />
                                    <Button
                                      size="sm"
                                      variant="default"
                                      disabled={actionLoading === payout.id}
                                      onClick={() => handleAction(payout.id, 'complete', completeRef)}
                                    >
                                      {actionLoading === payout.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <CheckCircle2 className="h-3 w-3" />
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => { setCompleteId(null); setCompleteRef(''); }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setCompleteId(payout.id)}
                                  >
                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                    Complete
                                  </Button>
                                )}
                              </>
                            )}

                            {payout.status === 'failed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={actionLoading === payout.id}
                                onClick={() => handleAction(payout.id, 'retry')}
                              >
                                {actionLoading === payout.id ? (
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="mr-1 h-3 w-3" />
                                )}
                                Retry
                              </Button>
                            )}

                            {payout.status === 'completed' && payout.externalReference && (
                              <span className="text-xs text-muted-foreground">
                                Ref: {payout.externalReference}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
