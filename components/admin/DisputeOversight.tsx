'use client';

/**
 * DisputeOversight Component
 *
 * Responsibilities:
 * - Fetch and display disputes with status filter
 * - Provide resolve action with status + resolution notes
 * - Trigger escrow release or refund on resolution
 */

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';

interface DisputeTransaction {
  id: string;
  amountCents: number;
  project: { id: string; title: string };
}

interface DisputeBuyer {
  id: string;
  username: string;
  fullName: string | null;
  email: string;
}

interface Dispute {
  id: string;
  reason: string;
  description: string;
  status: string;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
  buyer: DisputeBuyer;
  transaction: DisputeTransaction;
}

const REASON_LABELS: Record<string, string> = {
  description_mismatch: "Doesn't match description",
  code_not_functional: 'Code not functional',
  missing_features: 'Missing features',
  access_issues: 'Access issues',
  other: 'Other',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  reviewing: 'bg-blue-100 text-blue-800',
  resolved_refund: 'bg-green-100 text-green-800',
  resolved_no_refund: 'bg-gray-100 text-gray-800',
  resolved_partial: 'bg-purple-100 text-purple-800',
};

function fmtCents(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    cents / 100
  );
}

export function DisputeOversight() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  // 'all' is the sentinel for no filter; maps to undefined when fetching
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve dialog state
  const [resolving, setResolving] = useState<Dispute | null>(null);
  const [resolveStatus, setResolveStatus] = useState<string>('');
  const [resolveAction, setResolveAction] = useState<string>('');
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolveSubmitting, setResolveSubmitting] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  async function fetchDisputes(status?: string) {
    setLoading(true);
    setError(null);
    try {
      const url = status
        ? `/api/admin/disputes?status=${encodeURIComponent(status)}`
        : '/api/admin/disputes';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch disputes');
      const data = await res.json();
      setDisputes(data.disputes ?? []);
    } catch {
      setError('Could not load disputes. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDisputes(statusFilter === 'all' ? undefined : statusFilter);
  }, [statusFilter]);

  function openResolveDialog(dispute: Dispute) {
    setResolving(dispute);
    setResolveStatus('');
    setResolveAction('none');
    setResolveNotes('');
    setResolveError(null);
  }

  function closeResolveDialog() {
    if (resolveSubmitting) return;
    setResolving(null);
  }

  async function submitResolve() {
    if (!resolving) return;
    setResolveError(null);
    setResolveSubmitting(true);

    try {
      const res = await fetch(`/api/admin/disputes/${resolving.id}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: resolveStatus,
          resolution: resolveNotes,
          action: resolveAction,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResolveError(data.message ?? data.error ?? 'Failed to resolve dispute');
        return;
      }

      setResolving(null);
      await fetchDisputes(statusFilter === 'all' ? undefined : statusFilter);
    } catch {
      setResolveError('Network error. Please try again.');
    } finally {
      setResolveSubmitting(false);
    }
  }

  const canSubmitResolve =
    resolveStatus.length > 0 &&
    resolveNotes.trim().length >= 10 &&
    resolveAction.length > 0;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-lg">Disputes</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewing">Reviewing</SelectItem>
                <SelectItem value="resolved_refund">Resolved — Refund</SelectItem>
                <SelectItem value="resolved_no_refund">Resolved — No Refund</SelectItem>
                <SelectItem value="resolved_partial">Resolved — Partial</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {error && (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading disputes…
            </div>
          ) : disputes.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No disputes found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dispute</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Filed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.map((dispute) => {
                  const isPending =
                    dispute.status === 'pending' || dispute.status === 'reviewing';
                  return (
                    <TableRow key={dispute.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {dispute.id.slice(-8)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/projects/${dispute.transaction.project.id}`}
                          target="_blank"
                          className="flex items-center gap-1 text-sm font-medium hover:underline"
                        >
                          {dispute.transaction.project.title}
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{dispute.buyer.fullName ?? dispute.buyer.username}</div>
                        <div className="text-xs text-muted-foreground">
                          {dispute.buyer.email}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {fmtCents(dispute.transaction.amountCents)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {REASON_LABELS[dispute.reason] ?? dispute.reason}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={STATUS_COLORS[dispute.status] ?? 'bg-gray-100'}
                          variant="outline"
                        >
                          {dispute.status.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(dispute.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {isPending ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openResolveDialog(dispute)}
                          >
                            Resolve
                          </Button>
                        ) : (
                          <CheckCircle2 className="ml-auto h-4 w-4 text-green-500" />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Resolve Dialog */}
      <Dialog open={!!resolving} onOpenChange={(open) => !open && closeResolveDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resolve Dispute</DialogTitle>
            <DialogDescription>
              {resolving && (
                <>
                  <strong>{resolving.transaction.project.title}</strong> —{' '}
                  {fmtCents(resolving.transaction.amountCents)}
                  <br />
                  <span className="mt-1 block text-xs italic">
                    {resolving.description}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="resolve-status">Resolution outcome</Label>
              <Select value={resolveStatus} onValueChange={setResolveStatus}>
                <SelectTrigger id="resolve-status">
                  <SelectValue placeholder="Select outcome…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resolved_refund">Refund buyer (full)</SelectItem>
                  <SelectItem value="resolved_no_refund">
                    No refund — seller wins
                  </SelectItem>
                  <SelectItem value="resolved_partial">Partial resolution</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resolve-action">Escrow action</Label>
              <Select value={resolveAction} onValueChange={setResolveAction}>
                <SelectTrigger id="resolve-action">
                  <SelectValue placeholder="Select action…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="issue_refund">Issue refund to buyer</SelectItem>
                  <SelectItem value="release_escrow">Release escrow to seller</SelectItem>
                  <SelectItem value="none">No escrow action (manual)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resolve-notes">Resolution notes (min 10 chars)</Label>
              <Textarea
                id="resolve-notes"
                rows={3}
                placeholder="Describe the resolution and reasoning…"
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
              />
              <p className="text-right text-xs text-muted-foreground">
                {resolveNotes.length} chars
              </p>
            </div>

            {resolveError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{resolveError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={closeResolveDialog}
              disabled={resolveSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={submitResolve}
              disabled={!canSubmitResolve || resolveSubmitting}
            >
              {resolveSubmitting ? 'Resolving…' : 'Confirm Resolution'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
