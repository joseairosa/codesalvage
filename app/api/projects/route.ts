/**
 * Projects API Route
 *
 * Handles project creation and listing.
 *
 * POST /api/projects - Create a new project
 * GET /api/projects - Search/list projects with filters
 *
 * @example
 * POST /api/projects
 * {
 *   "title": "Awesome App",
 *   "description": "A really cool app...",
 *   "category": "web_app",
 *   "completionPercentage": 75,
 *   "priceCents": 500000,
 *   "techStack": ["React", "Node.js"],
 *   "licenseType": "full_code",
 *   "accessLevel": "full"
 * }
 *
 * GET /api/projects?category=web_app&minCompletion=80&page=1&limit=20
 */

import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import {
  ProjectRepository,
  UserRepository,
  SubscriptionRepository,
} from '@/lib/repositories';
import {
  ProjectService,
  SubscriptionService,
  r2Service,
  ProjectValidationError,
} from '@/lib/services';
import { z } from 'zod';
import { withApiRateLimit, withPublicRateLimit } from '@/lib/middleware/withRateLimit';
import { getOrSetCache, CacheKeys, CacheTTL, invalidateCache } from '@/lib/utils/cache';

/**
 * Initialize services
 */
const projectRepository = new ProjectRepository(prisma);
const userRepository = new UserRepository(prisma);
const subscriptionRepository = new SubscriptionRepository(prisma);
const subscriptionService = new SubscriptionService(
  subscriptionRepository,
  userRepository
);
const projectService = new ProjectService(
  projectRepository,
  userRepository,
  subscriptionService,
  r2Service
);

/**
 * Project creation schema
 */
const createProjectSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().min(50).max(5000),
  category: z.enum([
    'web_app',
    'mobile_app',
    'desktop_app',
    'backend_api',
    'cli_tool',
    'library',
    'dashboard',
    'game',
    'other',
  ]),
  completionPercentage: z.number().min(50).max(95),
  estimatedCompletionHours: z.number().optional(),
  knownIssues: z.string().optional(),
  priceCents: z.number().min(10000).max(10000000),
  licenseType: z.enum(['full_code', 'limited', 'custom']),
  accessLevel: z.enum(['full', 'read_only', 'zip_download']),
  techStack: z.array(z.string()).min(1).max(20),
  primaryLanguage: z.string().optional(),
  frameworks: z.array(z.string()).optional(),
  githubUrl: z.string().url().optional(),
  githubRepoName: z.string().optional(),
  demoUrl: z.string().url().optional(),
  documentationUrl: z.string().url().optional(),
  thumbnailImageUrl: z.string().url().optional(),
  screenshotUrls: z.array(z.string().url()).optional(),
  demoVideoUrl: z.string().url().optional(),
});

/**
 * POST /api/projects (internal handler)
 *
 * Create a new project
 */
async function createProject(request: NextRequest) {
  try {
    // Check authentication (supports both cookie and Authorization header)
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a seller
    if (!auth.user.isSeller) {
      return NextResponse.json(
        { error: 'Only sellers can create projects' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createProjectSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validatedData.error.errors,
        },
        { status: 400 }
      );
    }

    console.log('[Projects API] Creating project:', {
      userId: auth.user.id,
      title: validatedData.data.title,
    });

    // Filter out undefined values for exactOptionalPropertyTypes
    const createData = Object.fromEntries(
      Object.entries(validatedData.data).filter(([_, value]) => value !== undefined)
    );

    // Create project
    const project = await projectService.createProject(auth.user.id, createData as any);

    console.log('[Projects API] Project created successfully:', project.id);

    // Invalidate search cache (new project should appear in search)
    await invalidateCache.search();
    await invalidateCache.seller(auth.user.id);

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('[Projects API] Error creating project:', error);

    if (error instanceof ProjectValidationError) {
      return NextResponse.json(
        {
          error: 'Validation error',
          message: error.message,
          field: error.field,
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'Failed to create project',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/projects (internal handler)
 *
 * Search and list projects
 */
async function searchProjects(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filters
    const filters = {
      query: searchParams.get('query') || undefined,
      category: searchParams.get('category') || undefined,
      techStack: searchParams.get('techStack')?.split(',') || undefined,
      primaryLanguage: searchParams.get('primaryLanguage') || undefined,
      minCompletion: searchParams.get('minCompletion')
        ? parseInt(searchParams.get('minCompletion')!)
        : undefined,
      maxCompletion: searchParams.get('maxCompletion')
        ? parseInt(searchParams.get('maxCompletion')!)
        : undefined,
      minPrice: searchParams.get('minPrice')
        ? parseInt(searchParams.get('minPrice')!)
        : undefined,
      maxPrice: searchParams.get('maxPrice')
        ? parseInt(searchParams.get('maxPrice')!)
        : undefined,
      status: searchParams.get('status') || 'active', // Default to active projects
      sellerId: searchParams.get('sellerId') || undefined,
      featured: searchParams.get('featured') === 'true' ? true : undefined,
    };

    // Parse pagination
    const pagination = {
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
      sortBy: (searchParams.get('sortBy') as any) || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as any) || 'desc',
    };

    console.log('[Projects API] Searching projects:', { filters, pagination });

    // Filter out undefined values for exactOptionalPropertyTypes
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([_, value]) => value !== undefined)
    );

    // Create cache key from search parameters
    const cacheKey = CacheKeys.searchResults(
      filters.query || 'all',
      JSON.stringify({ ...cleanFilters, ...pagination })
    );

    // Get cached results or fetch from database
    const results = await getOrSetCache(cacheKey, CacheTTL.SEARCH_RESULTS, async () => {
      return await projectService.searchProjects(cleanFilters as any, pagination);
    });

    console.log('[Projects API] Search completed:', {
      count: results.projects.length,
      total: results.total,
    });

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error('[Projects API] Error searching projects:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'Failed to search projects',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Export rate-limited handlers
 *
 * POST: API rate limiting (100 requests / minute per user)
 * GET: Public rate limiting (1000 requests / hour per IP)
 */
export const POST = withApiRateLimit(createProject, async (request) => {
  const auth = await authenticateApiRequest(request);
  return auth?.user.id || 'anonymous';
});

export const GET = withPublicRateLimit(searchProjects);
