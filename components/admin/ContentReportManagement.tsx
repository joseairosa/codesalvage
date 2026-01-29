/**
 * ContentReportManagement Component
 *
 * Responsibilities:
 * - Fetch and display content reports with filters
 * - Provide resolve/dismiss actions
 * - Handle pagination
 * - Show reporter, content, and report details
 *
 * Architecture:
 * - Client Component with state management
 * - Card-based layout with action buttons
 * - Dialog for resolution input
 * - Real-time updates after actions
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  User,
  Flag,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
} from 'lucide-react';

/**
 * Content Report Interface (matching API response)
 */
interface ContentReport {
  id: string;
  reporterId: string;
  contentType: string;
  contentId: string;
  reason: string;
  description: string;
  status: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  resolution: string | null;
  createdAt: Date;
  reporter: {
    id: string;
    username: string;
    email: string;
  };
}

/**
 * ContentReportManagement Component
 */
export function ContentReportManagement() {
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('all');

  // Pagination
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Resolve dialog state
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ContentReport | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<'resolved' | 'dismissed'>(
    'resolved'
  );
  const [resolutionText, setResolutionText] = useState('');
  const [resolveError, setResolveError] = useState<string | null>(null);

  /**
   * Fetch reports with current filters
   */
  async function fetchReports() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      if (contentTypeFilter !== 'all') {
        params.append('contentType', contentTypeFilter);
      }

      const res = await fetch(`/api/admin/reports?${params.toString()}`);

      if (!res.ok) {
        throw new Error('Failed to fetch reports');
      }

      const data = await res.json();
      setReports(data.reports);
      setTotal(data.pagination.total);
    } catch (err) {
      console.error('[ContentReportManagement] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Fetch reports on mount and filter changes
   */
  useEffect(() => {
    fetchReports();
  }, [statusFilter, contentTypeFilter, offset]);

  /**
   * Handle resolve report
   */
  async function handleResolveReport() {
    if (!selectedReport || !resolutionText.trim()) {
      setResolveError('Please provide a resolution (minimum 10 characters)');
      return;
    }

    setActionLoading(selectedReport.id);
    setResolveError(null);

    try {
      const res = await fetch(`/api/admin/reports/${selectedReport.id}/resolve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: resolutionStatus,
          resolution: resolutionText,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to resolve report');
      }

      await fetchReports();
      setResolveDialogOpen(false);
      setSelectedReport(null);
      setResolutionText('');
      setResolutionStatus('resolved');
    } catch (err) {
      console.error('[ContentReportManagement] Resolve error:', err);
      setResolveError(err instanceof Error ? err.message : 'Failed to resolve report');
    } finally {
      setActionLoading(null);
    }
  }

  /**
   * Open resolve dialog
   */
  function openResolveDialog(
    report: ContentReport,
    status: 'resolved' | 'dismissed'
  ) {
    setSelectedReport(report);
    setResolutionStatus(status);
    setResolutionText('');
    setResolveError(null);
    setResolveDialogOpen(true);
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
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Get reason badge variant
   */
  function getReasonBadgeVariant(
    reason: string
  ): 'default' | 'destructive' | 'secondary' {
    if (reason === 'spam' || reason === 'scam') {
      return 'destructive';
    }
    if (reason === 'inappropriate' || reason === 'copyright') {
      return 'default';
    }
    return 'secondary';
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Content Reports</CardTitle>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row">
            {/* Filter by status */}
            <div className="flex-1">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All reports" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All reports</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter by content type */}
            <div className="flex-1">
              <Label className="text-xs">Content Type</Label>
              <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="message">Message</SelectItem>
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
                <div key={i} className="h-24 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : reports.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No reports found with the selected filters.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="rounded-lg border bg-white p-4 transition-shadow hover:shadow-md"
                  >
                    {/* Header */}
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Flag className="h-4 w-4 text-orange-500" />
                        <Badge variant={getReasonBadgeVariant(report.reason)}>
                          {report.reason}
                        </Badge>
                        <Badge variant="outline">{report.contentType}</Badge>
                        <Badge
                          variant={
                            report.status === 'pending'
                              ? 'default'
                              : report.status === 'resolved'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {report.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(report.createdAt)}
                      </div>
                    </div>

                    {/* Description */}
                    <div className="mb-3 rounded bg-gray-50 p-3">
                      <div className="mb-1 text-xs font-semibold uppercase text-gray-500">
                        Description
                      </div>
                      <p className="text-sm text-gray-700">{report.description}</p>
                    </div>

                    {/* Reporter Info */}
                    <div className="mb-3 flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>Reported by: {report.reporter.username}</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-xs">
                        <span>Content ID: {report.contentId.substring(0, 12)}...</span>
                      </div>
                    </div>

                    {/* Resolution (if resolved) */}
                    {report.resolution && (
                      <div className="mb-3 rounded border-l-4 border-green-500 bg-green-50 p-3">
                        <div className="mb-1 text-xs font-semibold uppercase text-green-700">
                          Resolution
                        </div>
                        <p className="text-sm text-gray-700">{report.resolution}</p>
                        <div className="mt-1 text-xs text-gray-500">
                          Resolved {formatDate(report.reviewedAt)}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {report.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => openResolveDialog(report, 'resolved')}
                          disabled={actionLoading === report.id}
                          className="gap-1"
                        >
                          <CheckCircle className="h-3 w-3" />
                          Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openResolveDialog(report, 'dismissed')}
                          disabled={actionLoading === report.id}
                          className="gap-1"
                        >
                          <XCircle className="h-3 w-3" />
                          Dismiss
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}{' '}
                  reports
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

      {/* Resolve Report Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolutionStatus === 'resolved' ? 'Resolve' : 'Dismiss'} Report
            </DialogTitle>
            <DialogDescription>
              {resolutionStatus === 'resolved'
                ? 'Provide details on how this report was resolved.'
                : 'Provide a reason for dismissing this report.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Report Summary */}
            <div className="rounded-lg border bg-gray-50 p-3">
              <div className="space-y-1 text-sm">
                <div>
                  <span className="font-medium">Type:</span>{' '}
                  {selectedReport?.contentType}
                </div>
                <div>
                  <span className="font-medium">Reason:</span> {selectedReport?.reason}
                </div>
                <div>
                  <span className="font-medium">Reporter:</span>{' '}
                  {selectedReport?.reporter.username}
                </div>
              </div>
            </div>

            {/* Resolution Text */}
            <div>
              <Label htmlFor="resolution-text">
                {resolutionStatus === 'resolved' ? 'Resolution' : 'Dismissal Reason'} *
              </Label>
              <Textarea
                id="resolution-text"
                placeholder={
                  resolutionStatus === 'resolved'
                    ? 'Describe how this report was resolved (minimum 10 characters)...'
                    : 'Explain why this report is being dismissed (minimum 10 characters)...'
                }
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
                rows={4}
                className="mt-2"
              />
              <p className="mt-1 text-xs text-gray-500">
                This will be recorded in the audit log
              </p>
              {resolveError && (
                <p className="mt-2 text-sm text-red-600">{resolveError}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResolveDialogOpen(false)}
              disabled={actionLoading === selectedReport?.id}
            >
              Cancel
            </Button>
            <Button
              variant={resolutionStatus === 'resolved' ? 'default' : 'secondary'}
              onClick={handleResolveReport}
              disabled={actionLoading === selectedReport?.id || !resolutionText.trim()}
            >
              {actionLoading === selectedReport?.id
                ? resolutionStatus === 'resolved'
                  ? 'Resolving...'
                  : 'Dismissing...'
                : resolutionStatus === 'resolved'
                ? 'Resolve Report'
                : 'Dismiss Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
