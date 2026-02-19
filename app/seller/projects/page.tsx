/**
 * Seller Dashboard - Project Management Page
 *
 * Dashboard for sellers to manage their project listings.
 * View, edit, publish, and delete projects.
 *
 * Features:
 * - List all seller's projects (draft, active, sold)
 * - Quick stats (total, active, sold, revenue)
 * - Project status badges
 * - Quick actions (Edit, Publish, Delete, View)
 * - Filter by status
 * - Search within seller's projects
 * - Sortable table columns
 * - View counts and favorites
 * - Revenue tracking
 *
 * @example
 * /seller/projects
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/hooks/useSession';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  FileText,
  AlertCircle,
} from 'lucide-react';

const componentName = 'SellerProjectsPage';

/**
 * Project status type
 */
type ProjectStatus = 'draft' | 'active' | 'sold' | 'delisted';

/**
 * Seller project data
 */
interface SellerProject {
  id: string;
  title: string;
  category: string;
  status: ProjectStatus;
  completionPercentage: number;
  priceCents: number;
  viewCount: number;
  favoriteCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Mock seller projects (in production, fetch from API)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// @ts-expect-error - Kept for reference during development
const _mockProjectsForReference: SellerProject[] = [
  {
    id: '1',
    title: 'E-commerce Dashboard with Analytics',
    category: 'web_app',
    status: 'active',
    completionPercentage: 85,
    priceCents: 75000,
    viewCount: 245,
    favoriteCount: 32,
    createdAt: new Date('2026-01-20'),
    updatedAt: new Date('2026-01-24'),
  },
  {
    id: '2',
    title: 'Mobile Fitness Tracker App',
    category: 'mobile_app',
    status: 'active',
    completionPercentage: 70,
    priceCents: 125000,
    viewCount: 178,
    favoriteCount: 21,
    createdAt: new Date('2026-01-18'),
    updatedAt: new Date('2026-01-23'),
  },
  {
    id: '3',
    title: 'Real-time Chat Application',
    category: 'web_app',
    status: 'sold',
    completionPercentage: 78,
    priceCents: 95000,
    viewCount: 312,
    favoriteCount: 45,
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-22'),
  },
  {
    id: '4',
    title: 'CLI Tool for Git Automation',
    category: 'cli_tool',
    status: 'draft',
    completionPercentage: 92,
    priceCents: 35000,
    viewCount: 0,
    favoriteCount: 0,
    createdAt: new Date('2026-01-24'),
    updatedAt: new Date('2026-01-24'),
  },
];

/**
 * Format price in cents to USD
 */
function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Format date
 */
function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

/**
 * Get status badge className for distinct per-status colors
 */
function getStatusClassName(status: ProjectStatus): string {
  const classNames: Record<ProjectStatus, string> = {
    draft:
      'border-transparent bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    active:
      'border-transparent bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    sold: 'border-transparent bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    delisted:
      'border-transparent bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  };
  return classNames[status];
}

/**
 * Get status label
 */
function getStatusLabel(status: ProjectStatus): string {
  const labels: Record<ProjectStatus, string> = {
    draft: 'Draft',
    active: 'Active',
    sold: 'Sold',
    delisted: 'Delisted',
  };
  return labels[status];
}

export default function SellerProjectsPage() {
  console.log(`[${componentName}] Page rendered`);

  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [projects, setProjects] = React.useState<SellerProject[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<ProjectStatus | 'all'>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [projectToDelete, setProjectToDelete] = React.useState<string | null>(null);

  /**
   * Fetch seller's projects from API
   */
  const fetchProjects = React.useCallback(async () => {
    if (!session?.user?.id) {
      console.log(`[${componentName}] No session, skipping fetch`);
      return;
    }

    console.log(`[${componentName}] Fetching seller projects for user:`, session.user.id);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects?sellerId=${session.user.id}`);

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const data = await response.json();
      console.log(`[${componentName}] Fetched ${data.projects.length} projects`);

      setProjects(data.projects);
    } catch (err) {
      console.error(`[${componentName}] Fetch error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  /**
   * Fetch projects when session is ready
   */
  React.useEffect(() => {
    if (sessionStatus === 'authenticated') {
      fetchProjects();
    } else if (sessionStatus === 'unauthenticated') {
      setIsLoading(false);
      setError('You must be signed in to view this page');
    }
  }, [sessionStatus, fetchProjects]);

  const stats = React.useMemo(() => {
    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === 'active').length;
    const soldProjects = projects.filter((p) => p.status === 'sold').length;
    const totalRevenue = projects
      .filter((p) => p.status === 'sold')
      .reduce((sum, p) => sum + p.priceCents, 0);

    return {
      total: totalProjects,
      active: activeProjects,
      sold: soldProjects,
      revenue: totalRevenue,
    };
  }, [projects]);

  const filteredProjects = React.useMemo(() => {
    return projects.filter((project) => {
      if (statusFilter !== 'all' && project.status !== statusFilter) {
        return false;
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          project.title.toLowerCase().includes(query) ||
          project.category.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [projects, searchQuery, statusFilter]);

  /**
   * Handle create new project
   */
  const handleCreateProject = () => {
    console.log(`[${componentName}] Create new project`);
    router.push('/projects/new');
  };

  /**
   * Handle view project
   */
  const handleViewProject = (projectId: string) => {
    console.log(`[${componentName}] View project:`, projectId);
    router.push(`/projects/${projectId}`);
  };

  /**
   * Handle edit project
   */
  const handleEditProject = (projectId: string) => {
    console.log(`[${componentName}] Edit project:`, projectId);
    router.push(`/projects/${projectId}/edit`);
  };

  /**
   * Handle publish project
   */
  const handlePublishProject = async (projectId: string) => {
    console.log(`[${componentName}] Publish project:`, projectId);

    try {
      const response = await fetch(`/api/projects/${projectId}/publish`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to publish project');
      }

      console.log(`[${componentName}] Project published successfully`);

      await fetchProjects();
    } catch (error) {
      console.error(`[${componentName}] Publish error:`, error);
      setError(error instanceof Error ? error.message : 'Failed to publish project');
    }
  };

  /**
   * Handle delete project (confirm first)
   */
  const handleDeleteClick = (projectId: string) => {
    console.log(`[${componentName}] Delete clicked:`, projectId);
    setProjectToDelete(projectId);
    setDeleteDialogOpen(true);
  };

  /**
   * Handle delete project (confirmed)
   */
  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;

    console.log(`[${componentName}] Delete confirmed:`, projectToDelete);

    try {
      const response = await fetch(`/api/projects/${projectToDelete}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      console.log(`[${componentName}] Project deleted successfully`);

      await fetchProjects();
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    } catch (error) {
      console.error(`[${componentName}] Delete error:`, error);
      setError(error instanceof Error ? error.message : 'Failed to delete project');
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl py-10">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Projects</h1>
            <p className="mt-2 text-muted-foreground">Manage your project listings</p>
          </div>
          <Button onClick={handleCreateProject}>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All your listings</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active}</div>
              <p className="text-xs text-muted-foreground">Currently published</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Projects Sold</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.sold}</div>
              <p className="text-xs text-muted-foreground">Successful sales</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPrice(stats.revenue)}</div>
              <p className="text-xs text-muted-foreground">From sold projects</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search your projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as ProjectStatus | 'all')}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
              <SelectItem value="delisted">Delisted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Error Alert */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p className="font-medium">{error}</p>
              </div>
              <Button onClick={() => fetchProjects()} variant="outline" className="mt-4">
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Projects Table */}
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>
              {isLoading ? 'Loading...' : `${filteredProjects.length} project(s) found`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Loading State */}
            {isLoading && (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 py-4">
                    <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            )}

            {/* Table Content */}
            {!isLoading && filteredProjects.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Favorites</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="text-left font-medium">
                        <button
                          onClick={() => handleViewProject(project.id)}
                          className="hover:underline"
                        >
                          {project.title}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusClassName(project.status)}>
                          {getStatusLabel(project.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{project.completionPercentage}%</TableCell>
                      <TableCell>{formatPrice(project.priceCents)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Eye className="h-3 w-3 text-muted-foreground" />
                          {project.viewCount}
                        </div>
                      </TableCell>
                      <TableCell>{project.favoriteCount}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(project.updatedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewProject(project.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditProject(project.id)}
                            disabled={project.status === 'sold'}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {project.status === 'draft' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePublishProject(project.id)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(project.id)}
                            disabled={project.status === 'sold'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Empty State */}
            {!isLoading && filteredProjects.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No projects found</p>
                <Button onClick={handleCreateProject} variant="outline" className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first project
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Project</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this project? This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setProjectToDelete(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
