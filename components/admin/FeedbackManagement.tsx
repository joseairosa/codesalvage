'use client';

/**
 * FeedbackManagement
 *
 * Admin client component for managing user feedback.
 * Lists submissions with filtering, pagination, and a detail modal
 * for updating status, priority, and internal notes.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  Bug,
  ChevronLeft,
  ChevronRight,
  Eye,
  HelpCircle,
  Lightbulb,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Search,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ─── Types ──────────────────────────────────────────────────────────────────

type FeedbackType = 'general' | 'feature' | 'bug' | 'support';
type FeedbackStatus = 'new' | 'in_progress' | 'resolved' | 'closed';
type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';

interface FeedbackEntry {
  id: string;
  type: FeedbackType;
  status: FeedbackStatus;
  priority: FeedbackPriority;
  title: string;
  content: string;
  email: string;
  userId: string | null;
  adminNotes: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FeedbackStats {
  total: number;
  byStatus: Record<FeedbackStatus, number>;
  byType: Record<FeedbackType, number>;
  byPriority: Record<FeedbackPriority, number>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<FeedbackType, React.ReactNode> = {
  bug: <Bug className="h-4 w-4" />,
  feature: <Lightbulb className="h-4 w-4" />,
  support: <HelpCircle className="h-4 w-4" />,
  general: <MessageSquare className="h-4 w-4" />,
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: 'New',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_CLASSES: Record<FeedbackStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-700',
};

const PRIORITY_LABELS: Record<FeedbackPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

const PRIORITY_CLASSES: Record<FeedbackPriority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const LIMIT = 20;

// ─── Component ───────────────────────────────────────────────────────────────

export function FeedbackManagement() {
  const [items, setItems] = useState<FeedbackEntry[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [page, setPage] = useState(0);

  const [selected, setSelected] = useState<FeedbackEntry | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(page * LIMIT),
        ...(typeFilter !== 'all' && { type: typeFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(priorityFilter !== 'all' && { priority: priorityFilter }),
        ...(search && { search }),
      });

      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/admin/feedback?${params.toString()}`),
        fetch('/api/admin/feedback/stats'),
      ]);

      if (listRes.ok) {
        const data = (await listRes.json()) as { items: FeedbackEntry[]; total: number };
        setItems(data.items);
        setTotal(data.total);
      }
      if (statsRes.ok) {
        const data = (await statsRes.json()) as FeedbackStats;
        setStats(data);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, statusFilter, priorityFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openDetail = (item: FeedbackEntry) => {
    setSelected(item);
    setAdminNotes(item.adminNotes ?? '');
  };

  const patchItem = (updated: FeedbackEntry) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    if (selected?.id === updated.id) setSelected(updated);
  };

  const handleUpdateStatus = async (id: string, status: FeedbackStatus) => {
    setActionLoading(true);
    const res = await fetch(`/api/admin/feedback/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) patchItem((await res.json()) as FeedbackEntry);
    setActionLoading(false);
  };

  const handleUpdatePriority = async (id: string, priority: FeedbackPriority) => {
    setActionLoading(true);
    const res = await fetch(`/api/admin/feedback/${id}/priority`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority }),
    });
    if (res.ok) patchItem((await res.json()) as FeedbackEntry);
    setActionLoading(false);
  };

  const handleSaveNotes = async () => {
    if (!selected) return;
    setActionLoading(true);
    const res = await fetch(`/api/admin/feedback/${selected.id}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminNotes }),
    });
    if (res.ok) patchItem((await res.json()) as FeedbackEntry);
    setActionLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this feedback entry? This cannot be undone.')) return;
    setActionLoading(true);
    const res = await fetch(`/api/admin/feedback/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setTotal((t) => t - 1);
      if (selected?.id === id) setSelected(null);
    }
    setActionLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: 'Total', value: stats.total, cls: '' },
            { label: 'New', value: stats.byStatus.new, cls: 'text-blue-700' },
            {
              label: 'In Progress',
              value: stats.byStatus.in_progress,
              cls: 'text-yellow-700',
            },
            { label: 'Critical', value: stats.byPriority.critical, cls: 'text-red-600' },
          ].map(({ label, value, cls }) => (
            <Card key={label}>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${cls}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search title, content, or email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="feature">Feature</SelectItem>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="support">Support</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={priorityFilter}
              onValueChange={(v) => {
                setPriorityFilter(v);
                setPage(0);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Submissions</CardTitle>
          <CardDescription>{total} total</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">No feedback found</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 capitalize text-muted-foreground">
                          {TYPE_ICONS[item.type]}
                          {item.type}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate font-medium">
                        {item.title}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[item.status]}`}
                        >
                          {STATUS_LABELS[item.status]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_CLASSES[item.priority]}`}
                        >
                          {PRIORITY_LABELS[item.priority]}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetail(item)}>
                              <Eye className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={item.status === 'in_progress'}
                              onClick={() => handleUpdateStatus(item.id, 'in_progress')}
                            >
                              Mark In Progress
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={item.status === 'resolved'}
                              onClick={() => handleUpdateStatus(item.id, 'resolved')}
                            >
                              Mark Resolved
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={item.status === 'closed'}
                              onClick={() => handleUpdateStatus(item.id, 'closed')}
                            >
                              Close
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} of{' '}
                  {total}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={(page + 1) * LIMIT >= total}
                  >
                    Next <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Submitted by {selected?.email} on{' '}
              {selected && formatDate(selected.createdAt)}
            </p>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              {/* Type */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {TYPE_ICONS[selected.type]}
                <span className="capitalize">{selected.type}</span>
              </div>

              {/* Status & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Status</label>
                  <Select
                    value={selected.status}
                    onValueChange={(v) =>
                      handleUpdateStatus(selected.id, v as FeedbackStatus)
                    }
                    disabled={actionLoading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Priority</label>
                  <Select
                    value={selected.priority}
                    onValueChange={(v) =>
                      handleUpdatePriority(selected.id, v as FeedbackPriority)
                    }
                    disabled={actionLoading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="mb-1 block text-sm font-medium">Feedback Details</label>
                <div className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">
                  {selected.content}
                </div>
              </div>

              {/* Admin Notes */}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Internal Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add internal notes (not visible to the submitter)..."
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  disabled={actionLoading}
                />
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={actionLoading}
                  className="mt-2"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Notes'
                  )}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
            {selected && (
              <Button
                variant="destructive"
                onClick={() => handleDelete(selected.id)}
                disabled={actionLoading}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
