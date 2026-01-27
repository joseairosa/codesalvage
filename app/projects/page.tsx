/**
 * Project Search/Browse Page
 *
 * Main page for searching and browsing project listings.
 * Features full-text search, filters, sorting, and pagination.
 *
 * Features:
 * - Search bar with full-text search
 * - Filter sidebar (category, tech stack, completion %, price range)
 * - Sort options (newest, price, completion %, trending)
 * - Grid of ProjectCard components
 * - Pagination controls
 * - Result count display
 * - Featured projects section
 * - Empty state for no results
 *
 * @example
 * /projects?query=react&category=web_app&minCompletion=80
 */

'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProjectCard, type ProjectCardData } from '@/components/projects/ProjectCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  Star,
  CheckCircle2,
} from 'lucide-react';

const componentName = 'ProjectSearchPage';

/**
 * Note: Mock data removed - now using real API
 * Kept below for reference during development/testing
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// @ts-expect-error - Kept for reference during development
const _mockProjectsForReference: ProjectCardData[] = [
  {
    id: '1',
    title: 'E-commerce Dashboard with Analytics',
    description:
      'A comprehensive e-commerce admin dashboard built with React and Node.js. Includes real-time analytics, inventory management, order tracking, and customer insights.',
    category: 'web_app',
    completionPercentage: 85,
    priceCents: 75000,
    techStack: ['React', 'Node.js', 'PostgreSQL', 'Tailwind CSS', 'Stripe'],
    thumbnailImageUrl:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=450&fit=crop',
    isFeatured: true,
    viewCount: 245,
    favoriteCount: 32,
    seller: {
      id: 'seller1',
      username: 'techbuilder',
      fullName: 'Sarah Chen',
      avatarUrl: 'https://i.pravatar.cc/150?img=1',
    },
  },
  {
    id: '2',
    title: 'Mobile Fitness Tracker App',
    description:
      'iOS and Android fitness tracking app with workout plans, calorie tracking, and social features. Backend API built with Django.',
    category: 'mobile_app',
    completionPercentage: 70,
    priceCents: 125000,
    techStack: ['React Native', 'Django', 'PostgreSQL', 'Redis'],
    thumbnailImageUrl:
      'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&h=450&fit=crop',
    isFeatured: false,
    viewCount: 178,
    favoriteCount: 21,
    seller: {
      id: 'seller2',
      username: 'mobilepro',
      fullName: 'Alex Johnson',
      avatarUrl: 'https://i.pravatar.cc/150?img=2',
    },
  },
  {
    id: '3',
    title: 'CLI Tool for Git Workflow Automation',
    description:
      'Command-line tool written in Go that automates common Git workflows. Includes branch management, PR creation, and commit message templating.',
    category: 'cli_tool',
    completionPercentage: 92,
    priceCents: 35000,
    techStack: ['Go', 'Cobra', 'Git'],
    thumbnailImageUrl: null,
    isFeatured: false,
    viewCount: 89,
    favoriteCount: 12,
    seller: {
      id: 'seller3',
      username: 'godev',
      fullName: null,
      avatarUrl: null,
    },
  },
  {
    id: '4',
    title: 'Real-time Chat Application',
    description:
      'WebSocket-based real-time chat with channels, direct messaging, file sharing, and emoji reactions. Built with Next.js and Socket.io.',
    category: 'web_app',
    completionPercentage: 78,
    priceCents: 95000,
    techStack: ['Next.js', 'Socket.io', 'MongoDB', 'TypeScript', 'Tailwind CSS'],
    thumbnailImageUrl:
      'https://images.unsplash.com/photo-1611606063065-ee7946f0787a?w=800&h=450&fit=crop',
    isFeatured: true,
    viewCount: 312,
    favoriteCount: 45,
    seller: {
      id: 'seller4',
      username: 'fullstackdev',
      fullName: 'Maria Garcia',
      avatarUrl: 'https://i.pravatar.cc/150?img=4',
    },
  },
  {
    id: '5',
    title: 'Machine Learning Model Dashboard',
    description:
      'Dashboard for visualizing and managing ML model training runs. Supports TensorFlow and PyTorch. Includes experiment tracking and hyperparameter tuning.',
    category: 'dashboard',
    completionPercentage: 65,
    priceCents: 180000,
    techStack: ['Python', 'FastAPI', 'React', 'TensorFlow', 'PyTorch'],
    thumbnailImageUrl:
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=450&fit=crop',
    isFeatured: false,
    viewCount: 156,
    favoriteCount: 28,
    seller: {
      id: 'seller5',
      username: 'mlresearcher',
      fullName: 'David Kim',
      avatarUrl: 'https://i.pravatar.cc/150?img=5',
    },
  },
  {
    id: '6',
    title: 'Indie Game Prototype',
    description:
      '2D platformer game built with Unity. Core gameplay mechanics complete, including physics, enemies, and level progression.',
    category: 'game',
    completionPercentage: 55,
    priceCents: 220000,
    techStack: ['Unity', 'C#', 'Blender'],
    thumbnailImageUrl:
      'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&h=450&fit=crop',
    isFeatured: false,
    viewCount: 203,
    favoriteCount: 37,
    seller: {
      id: 'seller6',
      username: 'indiegamedev',
      fullName: 'Emma Wilson',
      avatarUrl: 'https://i.pravatar.cc/150?img=6',
    },
  },
];

/**
 * Available categories
 */
const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'web_app', label: 'Web App' },
  { value: 'mobile_app', label: 'Mobile App' },
  { value: 'desktop_app', label: 'Desktop App' },
  { value: 'backend_api', label: 'Backend API' },
  { value: 'cli_tool', label: 'CLI Tool' },
  { value: 'library', label: 'Library' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'game', label: 'Game' },
  { value: 'other', label: 'Other' },
];

/**
 * Available sort options
 */
const SORT_OPTIONS = [
  { value: 'createdAt-desc', label: 'Newest First' },
  { value: 'createdAt-asc', label: 'Oldest First' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'completion-desc', label: 'Completion: High to Low' },
  { value: 'completion-asc', label: 'Completion: Low to High' },
  { value: 'views-desc', label: 'Most Popular' },
];

/**
 * Popular tech stacks
 */
const POPULAR_TECH_STACKS = [
  'React',
  'Node.js',
  'TypeScript',
  'Python',
  'Next.js',
  'PostgreSQL',
  'MongoDB',
  'Go',
  'Rust',
  'Django',
  'FastAPI',
  'Vue.js',
  'Angular',
  'Flutter',
  'Swift',
];

export default function ProjectSearchPage() {
  console.log(`[${componentName}] Page rendered`);

  const router = useRouter();
  const searchParams = useSearchParams();

  // State for filters
  const [searchQuery, setSearchQuery] = React.useState(searchParams.get('query') || '');
  const [category, setCategory] = React.useState(searchParams.get('category') || 'all');
  const [selectedTechStack, setSelectedTechStack] = React.useState<string[]>([]);
  const [completionRange, setCompletionRange] = React.useState<[number, number]>([
    50, 95,
  ]);
  const [priceRange, setPriceRange] = React.useState<[number, number]>([100, 100000]);
  const [sortBy, setSortBy] = React.useState(
    searchParams.get('sortBy') || 'createdAt-desc'
  );
  const [showFilters, setShowFilters] = React.useState(true);

  // State for results
  const [projects, setProjects] = React.useState<ProjectCardData[]>([]);
  const [totalResults, setTotalResults] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const itemsPerPage = 12;

  /**
   * Fetch projects from API with current filters
   */
  const fetchProjects = React.useCallback(async () => {
    console.log(`[${componentName}] Fetching projects from API`);
    setIsLoading(true);
    setError(null);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (searchQuery) params.set('query', searchQuery);
      if (category !== 'all') params.set('category', category);
      if (selectedTechStack.length > 0)
        params.set('techStack', selectedTechStack.join(','));
      params.set('minCompletion', completionRange[0].toString());
      params.set('maxCompletion', completionRange[1].toString());
      params.set('minPrice', (priceRange[0] * 100).toString()); // Convert to cents
      params.set('maxPrice', (priceRange[1] * 100).toString()); // Convert to cents

      // Parse sortBy (format: "field-order")
      const [sortField, sortOrder] = sortBy.split('-');
      params.set('sortBy', sortField || 'createdAt');
      params.set('sortOrder', sortOrder || 'desc');

      params.set('page', currentPage.toString());
      params.set('limit', itemsPerPage.toString());

      console.log(`[${componentName}] API request:`, params.toString());

      const response = await fetch(`/api/projects?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }

      const data = await response.json();
      console.log(`[${componentName}] API response:`, {
        count: data.projects.length,
        total: data.total,
        page: data.page,
        pages: data.pages,
      });

      setProjects(data.projects);
      setTotalResults(data.total);
      setTotalPages(data.pages);
    } catch (err) {
      console.error(`[${componentName}] Fetch error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
      setProjects([]);
      setTotalResults(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [
    searchQuery,
    category,
    selectedTechStack,
    completionRange,
    priceRange,
    sortBy,
    currentPage,
    itemsPerPage,
  ]);

  /**
   * Fetch projects on mount and when filters change
   */
  React.useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  /**
   * Handle search - reset to page 1 and fetch
   */
  const handleSearch = React.useCallback(() => {
    console.log(`[${componentName}] Search triggered`);
    setCurrentPage(1); // Reset to first page on new search
    // fetchProjects will be called via useEffect when currentPage changes
  }, []);

  /**
   * Clear all filters
   */
  const handleClearFilters = () => {
    console.log(`[${componentName}] Clear all filters`);
    setSearchQuery('');
    setCategory('all');
    setSelectedTechStack([]);
    setCompletionRange([50, 95]);
    setPriceRange([100, 100000]);
    setSortBy('createdAt-desc');
    setCurrentPage(1);
    router.push('/projects');
  };

  /**
   * Toggle tech stack filter
   */
  const toggleTechStack = (tech: string) => {
    setSelectedTechStack((prev) =>
      prev.includes(tech) ? prev.filter((t) => t !== tech) : [...prev, tech]
    );
  };

  /**
   * Format price for display
   */
  const formatPrice = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="container mx-auto max-w-7xl py-10">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Browse Projects</h1>
          <p className="mt-2 text-muted-foreground">
            Discover incomplete projects ready to be finished
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search projects by title, description, or technology..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch}>
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="hidden md:flex"
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
        </div>

        {/* Active Filters */}
        {(category !== 'all' || selectedTechStack.length > 0 || searchQuery) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Active filters:</span>
            {searchQuery && (
              <Badge variant="secondary" className="gap-1">
                Search: {searchQuery}
                <button onClick={() => setSearchQuery('')} className="ml-1">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {category !== 'all' && (
              <Badge variant="secondary" className="gap-1">
                {CATEGORIES.find((c) => c.value === category)?.label}
                <button onClick={() => setCategory('all')} className="ml-1">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {selectedTechStack.map((tech) => (
              <Badge key={tech} variant="secondary" className="gap-1">
                {tech}
                <button onClick={() => toggleTechStack(tech)} className="ml-1">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
              Clear all
            </Button>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Filters Sidebar */}
          {showFilters && (
            <div className="space-y-6 lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Filters</CardTitle>
                  <CardDescription>Refine your search</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Category Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Tech Stack Filter */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tech Stack</label>
                    <div className="flex flex-wrap gap-1.5">
                      {POPULAR_TECH_STACKS.map((tech) => (
                        <Badge
                          key={tech}
                          variant={
                            selectedTechStack.includes(tech) ? 'default' : 'outline'
                          }
                          className="cursor-pointer"
                          onClick={() => toggleTechStack(tech)}
                        >
                          {tech}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Completion Range */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Completion</label>
                      <span className="text-sm text-muted-foreground">
                        {completionRange[0]}% - {completionRange[1]}%
                      </span>
                    </div>
                    <Slider
                      min={50}
                      max={95}
                      step={5}
                      value={completionRange}
                      onValueChange={(value) =>
                        setCompletionRange(value as [number, number])
                      }
                      className="w-full"
                    />
                  </div>

                  <Separator />

                  {/* Price Range */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Price Range</label>
                      <span className="text-sm text-muted-foreground">
                        {formatPrice(priceRange[0])} - {formatPrice(priceRange[1])}
                      </span>
                    </div>
                    <Slider
                      min={100}
                      max={100000}
                      step={100}
                      value={priceRange}
                      onValueChange={(value) => setPriceRange(value as [number, number])}
                      className="w-full"
                    />
                  </div>

                  <Separator />

                  {/* Apply Filters Button */}
                  <Button onClick={handleSearch} className="w-full">
                    Apply Filters
                  </Button>
                </CardContent>
              </Card>

              {/* Featured Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Star className="h-4 w-4 text-yellow-500" fill="currentColor" />
                    Featured Projects
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>
                    Featured projects are hand-picked by our team for quality and
                    completeness.
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    <span>Verified code quality</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    <span>Responsive seller</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Results */}
          <div className={showFilters ? 'lg:col-span-3' : 'lg:col-span-4'}>
            <div className="space-y-6">
              {/* Results Header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {totalResults} projects found
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">Sort by:</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {[...Array(6)].map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                      <div className="aspect-video animate-pulse bg-muted" />
                      <CardContent className="space-y-3 p-6">
                        <div className="h-6 animate-pulse rounded bg-muted" />
                        <div className="h-4 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Error State */}
              {error && !isLoading && (
                <Card className="border-destructive p-12 text-center">
                  <div className="mx-auto max-w-md space-y-4">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                      <X className="h-6 w-6 text-destructive" />
                    </div>
                    <h3 className="text-lg font-semibold">Failed to load projects</h3>
                    <p className="text-sm text-muted-foreground">{error}</p>
                    <Button onClick={() => fetchProjects()}>Try Again</Button>
                  </div>
                </Card>
              )}

              {/* Project Grid */}
              {!isLoading && !error && projects.length > 0 && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {projects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              )}

              {/* Empty State */}
              {!isLoading && !error && projects.length === 0 && (
                <Card className="p-12 text-center">
                  <div className="mx-auto max-w-md space-y-4">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Search className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold">No projects found</h3>
                    <p className="text-sm text-muted-foreground">
                      Try adjusting your filters or search query to find more results.
                    </p>
                    <Button onClick={handleClearFilters}>Clear all filters</Button>
                  </div>
                </Card>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
