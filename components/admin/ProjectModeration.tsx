/**
 * ProjectModeration Component
 *
 * Responsibilities:
 * - Fetch and display projects with filters
 * - Provide approve/reject/feature actions
 * - Handle pagination
 * - Show project and seller details
 *
 * Architecture:
 * - Client Component with state management
 * - Table-based layout with action buttons
 * - Dialogs for rejection reason and featured days
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
import { Input } from '@/components/ui/input';
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
  CheckCircle,
  XCircle,
  Star,
  User,
  DollarSign,
  ExternalLink,
} from 'lucide-react';

/**
 * Project Interface (matching API response)
 */
interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priceCents: number;
  isFeatured: boolean;
  featuredUntil: Date | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  seller: {
    id: string;
    username: string;
    email: string;
    isVerifiedSeller: boolean;
  };
}

/**
 * ProjectModeration Component
 */
export function ProjectModeration() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [featuredFilter, setFeaturedFilter] = useState<string>('all');

  // Pagination
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Feature dialog state
  const [featureDialogOpen, setFeatureDialogOpen] = useState(false);
  const [featuredDays, setFeaturedDays] = useState('30');
  const [featureError, setFeatureError] = useState<string | null>(null);

  /**
   * Fetch projects with current filters
   */
  async function fetchProjects() {
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

      if (featuredFilter !== 'all') {
        params.append('isFeatured', featuredFilter);
      }

      const res = await fetch(`/api/admin/projects?${params.toString()}`);

      if (!res.ok) {
        throw new Error('Failed to fetch projects');
      }

      const data = await res.json();
      setProjects(data.projects);
      setTotal(data.pagination.total);
    } catch (err) {
      console.error('[ProjectModeration] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Fetch projects on mount and filter changes
   */
  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, featuredFilter, offset]);

  /**
   * Handle approve project
   */
  async function handleApproveProject(project: Project) {
    if (!confirm(`Approve project "${project.title}"?`)) {
      return;
    }

    setActionLoading(project.id);

    try {
      const res = await fetch(`/api/admin/projects/${project.id}/approve`, {
        method: 'PUT',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to approve project');
      }

      await fetchProjects();
    } catch (err) {
      console.error('[ProjectModeration] Approve error:', err);
      alert(err instanceof Error ? err.message : 'Failed to approve project');
    } finally {
      setActionLoading(null);
    }
  }

  /**
   * Handle reject project
   */
  async function handleRejectProject() {
    if (!selectedProject || !rejectionReason.trim()) {
      setRejectError('Please provide a rejection reason (minimum 10 characters)');
      return;
    }

    setActionLoading(selectedProject.id);
    setRejectError(null);

    try {
      const res = await fetch(`/api/admin/projects/${selectedProject.id}/reject`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reject project');
      }

      await fetchProjects();
      setRejectDialogOpen(false);
      setSelectedProject(null);
      setRejectionReason('');
    } catch (err) {
      console.error('[ProjectModeration] Reject error:', err);
      setRejectError(err instanceof Error ? err.message : 'Failed to reject project');
    } finally {
      setActionLoading(null);
    }
  }

  /**
   * Handle toggle featured
   */
  async function handleToggleFeatured() {
    if (!selectedProject) return;

    const days = parseInt(featuredDays, 10);
    if (isNaN(days) || days < 1 || days > 365) {
      setFeatureError('Featured days must be between 1 and 365');
      return;
    }

    setActionLoading(selectedProject.id);
    setFeatureError(null);

    try {
      const res = await fetch(`/api/admin/projects/${selectedProject.id}/feature`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featured: !selectedProject.isFeatured,
          featuredDays: days,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to toggle featured status');
      }

      await fetchProjects();
      setFeatureDialogOpen(false);
      setSelectedProject(null);
      setFeaturedDays('30');
    } catch (err) {
      console.error('[ProjectModeration] Feature error:', err);
      setFeatureError(err instanceof Error ? err.message : 'Failed to toggle featured');
    } finally {
      setActionLoading(null);
    }
  }

  /**
   * Open reject dialog
   */
  function openRejectDialog(project: Project) {
    setSelectedProject(project);
    setRejectionReason('');
    setRejectError(null);
    setRejectDialogOpen(true);
  }

  /**
   * Open feature dialog
   */
  function openFeatureDialog(project: Project) {
    setSelectedProject(project);
    setFeaturedDays('30');
    setFeatureError(null);
    setFeatureDialogOpen(true);
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
          <CardTitle>Projects</CardTitle>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row">
            {/* Filter by status */}
            <div className="flex-1">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter by featured */}
            <div className="flex-1">
              <Label className="text-xs">Featured</Label>
              <Select value={featuredFilter} onValueChange={setFeaturedFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  <SelectItem value="true">Featured</SelectItem>
                  <SelectItem value="false">Not featured</SelectItem>
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
          ) : projects.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No projects found with the selected filters.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Seller</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell>
                          <div className="max-w-xs">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/projects/${project.id}`}
                                className="font-medium hover:underline"
                                target="_blank"
                              >
                                {project.title}
                              </Link>
                              <ExternalLink className="h-3 w-3 text-gray-400" />
                            </div>
                            {project.description && (
                              <div className="mt-1 truncate text-xs text-gray-500">
                                {project.description.substring(0, 80)}...
                              </div>
                            )}
                            {project.isFeatured && (
                              <Badge variant="outline" className="mt-1 gap-1">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                Featured
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="text-sm">{project.seller.username}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <DollarSign className="h-4 w-4 text-gray-400" />
                            {formatCurrency(project.priceCents)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              project.status === 'active'
                                ? 'default'
                                : project.status === 'sold'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {project.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {formatDate(project.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {project.status === 'draft' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleApproveProject(project)}
                                  disabled={actionLoading === project.id}
                                  className="gap-1"
                                >
                                  <CheckCircle className="h-3 w-3" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => openRejectDialog(project)}
                                  disabled={actionLoading === project.id}
                                  className="gap-1"
                                >
                                  <XCircle className="h-3 w-3" />
                                  Reject
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant={project.isFeatured ? 'secondary' : 'outline'}
                              onClick={() => openFeatureDialog(project)}
                              disabled={actionLoading === project.id}
                              className="gap-1"
                            >
                              <Star className="h-3 w-3" />
                              {project.isFeatured ? 'Unfeature' : 'Feature'}
                            </Button>
                          </div>
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
                  projects
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

      {/* Reject Project Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Project</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting "{selectedProject?.title}".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="rejection-reason">Reason for rejection *</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Enter reason (minimum 10 characters)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="mt-2"
              />
              {rejectError && (
                <p className="mt-2 text-sm text-red-600">{rejectError}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={actionLoading === selectedProject?.id}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectProject}
              disabled={actionLoading === selectedProject?.id || !rejectionReason.trim()}
            >
              {actionLoading === selectedProject?.id ? 'Rejecting...' : 'Reject Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feature Project Dialog */}
      <Dialog open={featureDialogOpen} onOpenChange={setFeatureDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedProject?.isFeatured ? 'Unfeature' : 'Feature'} Project
            </DialogTitle>
            <DialogDescription>
              {selectedProject?.isFeatured
                ? `Remove featured status from "${selectedProject?.title}".`
                : `Set "${selectedProject?.title}" as a featured project.`}
            </DialogDescription>
          </DialogHeader>

          {!selectedProject?.isFeatured && (
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="featured-days">Featured Duration (days)</Label>
                <Input
                  id="featured-days"
                  type="number"
                  min="1"
                  max="365"
                  value={featuredDays}
                  onChange={(e) => setFeaturedDays(e.target.value)}
                  className="mt-2"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Project will be featured for {featuredDays} days
                </p>
                {featureError && (
                  <p className="mt-2 text-sm text-red-600">{featureError}</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFeatureDialogOpen(false)}
              disabled={actionLoading === selectedProject?.id}
            >
              Cancel
            </Button>
            <Button
              onClick={handleToggleFeatured}
              disabled={actionLoading === selectedProject?.id}
            >
              {actionLoading === selectedProject?.id
                ? selectedProject?.isFeatured
                  ? 'Unfeaturing...'
                  : 'Featuring...'
                : selectedProject?.isFeatured
                ? 'Unfeature'
                : 'Feature Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
