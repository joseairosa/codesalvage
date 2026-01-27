/**
 * Project Detail API Route
 *
 * Handles individual project operations.
 *
 * GET /api/projects/[id] - Get project by ID
 * PUT /api/projects/[id] - Update project
 * DELETE /api/projects/[id] - Delete project
 *
 * @example
 * GET /api/projects/abc123
 * PUT /api/projects/abc123 { "completionPercentage": 85 }
 * DELETE /api/projects/abc123
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
  ProjectPermissionError,
} from '@/lib/services';
import { z } from 'zod';

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
 * Project update schema (partial)
 */
const updateProjectSchema = z.object({
  title: z.string().min(5).max(100).optional(),
  description: z.string().min(50).max(5000).optional(),
  category: z
    .enum([
      'web_app',
      'mobile_app',
      'desktop_app',
      'backend_api',
      'cli_tool',
      'library',
      'dashboard',
      'game',
      'other',
    ])
    .optional(),
  completionPercentage: z.number().min(50).max(95).optional(),
  estimatedCompletionHours: z.number().optional(),
  knownIssues: z.string().optional(),
  priceCents: z.number().min(10000).max(10000000).optional(),
  licenseType: z.enum(['full_code', 'limited', 'custom']).optional(),
  accessLevel: z.enum(['full', 'read_only', 'zip_download']).optional(),
  techStack: z.array(z.string()).min(1).max(20).optional(),
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
 * GET /api/projects/[id]
 *
 * Get project by ID
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    console.log('[Project API] Getting project:', id);

    // Get project (increment view count for active projects)
    const project = await projectService.getProject(id, { incrementView: true });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    console.log('[Project API] Project retrieved successfully');

    return NextResponse.json(project, { status: 200 });
  } catch (error) {
    console.error('[Project API] Error getting project:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: 'Failed to get project',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/projects/[id]
 *
 * Update project
 */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateProjectSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validatedData.error.errors,
        },
        { status: 400 }
      );
    }

    console.log('[Project API] Updating project:', { id, userId: session.user.id });

    // Filter out undefined values for exactOptionalPropertyTypes
    const updateData = Object.fromEntries(
      Object.entries(validatedData.data).filter(([_, value]) => value !== undefined)
    );

    // Update project
    const project = await projectService.updateProject(
      id,
      session.user.id,
      updateData as any
    );

    console.log('[Project API] Project updated successfully');

    return NextResponse.json(project, { status: 200 });
  } catch (error) {
    console.error('[Project API] Error updating project:', error);

    if (error instanceof ProjectPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

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
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      return NextResponse.json(
        {
          error: 'Failed to update project',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]
 *
 * Delete project
 */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    console.log('[Project API] Deleting project:', { id, userId: session.user.id });

    // Delete project
    await projectService.deleteProject(id, session.user.id);

    console.log('[Project API] Project deleted successfully');

    return NextResponse.json(
      { message: 'Project deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Project API] Error deleting project:', error);

    if (error instanceof ProjectPermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof ProjectValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof Error) {
      if (error.message === 'Project not found') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      return NextResponse.json(
        {
          error: 'Failed to delete project',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
