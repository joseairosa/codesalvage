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

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
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

/**
 * Initialize services
 */
const projectRepository = new ProjectRepository(prisma);
const userRepository = new UserRepository(prisma);
const subscriptionRepository = new SubscriptionRepository(prisma);
const subscriptionService = new SubscriptionService(subscriptionRepository, userRepository);
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
 * POST /api/projects
 *
 * Create a new project
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a seller
    if (!session.user.isSeller) {
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
      userId: session.user.id,
      title: validatedData.data.title,
    });

    // Create project
    const project = await projectService.createProject(
      session.user.id,
      validatedData.data
    );

    console.log('[Projects API] Project created successfully:', project.id);

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
 * GET /api/projects
 *
 * Search and list projects
 */
export async function GET(request: Request) {
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

    // Search projects
    const results = await projectService.searchProjects(filters, pagination);

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
