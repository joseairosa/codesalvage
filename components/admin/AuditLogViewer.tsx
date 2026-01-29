/**
 * AuditLogViewer Component
 *
 * Responsibilities:
 * - Fetch and display audit logs
 * - Provide filtering by admin, action, target
 * - Handle pagination
 * - Show detailed metadata and context
 *
 * Architecture:
 * - Client Component with state management
 * - Table-based layout with expandable details
 * - Read-only view (no actions)
 * - Comprehensive audit trail display
 */

'use client';

import { useEffect, useState } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
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
  Shield,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

/**
 * Audit Log Interface (matching API response)
 */
interface AuditLog {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: Date;
  admin: {
    id: string;
    username: string;
    email: string;
  };
}

/**
 * AuditLogViewer Component
 */
export function AuditLogViewer() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>('all');

  // Pagination
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  /**
   * Fetch audit logs with current filters
   */
  async function fetchAuditLogs() {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (actionFilter !== 'all') {
        params.append('action', actionFilter);
      }

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);

      if (!res.ok) {
        throw new Error('Failed to fetch audit logs');
      }

      const data = await res.json();
      setAuditLogs(data.auditLogs);
      setTotal(data.pagination.total);
    } catch (err) {
      console.error('[AuditLogViewer] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Fetch audit logs on mount and filter changes
   */
  useEffect(() => {
    fetchAuditLogs();
  }, [actionFilter, offset]);

  /**
   * Toggle expanded row
   */
  function toggleRow(id: string) {
    setExpandedRow(expandedRow === id ? null : id);
  }

  /**
   * Format date with time
   */
  function formatDateTime(date: Date): string {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  /**
   * Get action badge color
   */
  function getActionBadgeVariant(action: string): 'default' | 'destructive' | 'secondary' {
    if (action.includes('ban') || action.includes('reject')) {
      return 'destructive';
    }
    if (action.includes('approve') || action.includes('unban')) {
      return 'default';
    }
    return 'secondary';
  }

  /**
   * Format action label
   */
  function formatAction(action: string): string {
    return action
      .split('.')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Logs</CardTitle>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          {/* Filter by action */}
          <div className="flex-1">
            <Label className="text-xs">Action Type</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                <SelectItem value="user.ban">User Ban</SelectItem>
                <SelectItem value="user.unban">User Unban</SelectItem>
                <SelectItem value="project.approve">Project Approve</SelectItem>
                <SelectItem value="project.reject">Project Reject</SelectItem>
                <SelectItem value="project.feature">Project Feature</SelectItem>
                <SelectItem value="project.unfeature">Project Unfeature</SelectItem>
                <SelectItem value="transaction.release_escrow">
                  Escrow Release
                </SelectItem>
                <SelectItem value="report.resolve">Report Resolve</SelectItem>
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
              <div key={i} className="h-16 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            No audit logs found with the selected filters.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border bg-white transition-shadow hover:shadow-md"
                >
                  {/* Main Row */}
                  <div className="flex items-center gap-4 p-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={getActionBadgeVariant(log.action)}>
                          {formatAction(log.action)}
                        </Badge>
                        <span className="text-sm text-gray-600">on</span>
                        <Badge variant="outline">
                          {log.targetType} ({log.targetId.substring(0, 8)})
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          <span>{log.admin.username}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatDateTime(log.createdAt)}</span>
                        </div>
                        {log.ipAddress && (
                          <div className="flex items-center gap-1 text-xs">
                            <span>IP: {log.ipAddress}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRow(log.id)}
                      className="gap-1"
                    >
                      {expandedRow === log.id ? (
                        <>
                          Hide Details
                          <ChevronUp className="h-4 w-4" />
                        </>
                      ) : (
                        <>
                          Show Details
                          <ChevronDown className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Expanded Details */}
                  {expandedRow === log.id && (
                    <div className="border-t bg-gray-50 p-4">
                      <div className="space-y-3">
                        {log.reason && (
                          <div>
                            <div className="mb-1 text-xs font-semibold uppercase text-gray-500">
                              Reason
                            </div>
                            <div className="rounded bg-white p-3 text-sm">{log.reason}</div>
                          </div>
                        )}

                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div>
                            <div className="mb-1 text-xs font-semibold uppercase text-gray-500">
                              Metadata
                            </div>
                            <pre className="overflow-x-auto rounded bg-white p-3 text-xs">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-xs font-semibold uppercase text-gray-500">
                              Admin ID
                            </div>
                            <div className="mt-1 font-mono text-xs">{log.adminId}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase text-gray-500">
                              Admin Email
                            </div>
                            <div className="mt-1 text-xs">{log.admin.email}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase text-gray-500">
                              Target Type
                            </div>
                            <div className="mt-1 text-xs">{log.targetType}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase text-gray-500">
                              Target ID
                            </div>
                            <div className="mt-1 font-mono text-xs">{log.targetId}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase text-gray-500">
                              Audit Log ID
                            </div>
                            <div className="mt-1 font-mono text-xs">{log.id}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase text-gray-500">
                              Timestamp
                            </div>
                            <div className="mt-1 text-xs">
                              {new Date(log.createdAt).toISOString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {offset + 1}-{Math.min(offset + limit, total)} of {total} logs
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
  );
}
