/**
 * Project Publish API Route
 *
 * Publishes a project (changes status from draft to active).
 *
 * POST /api/projects/[id]/publish - Publish project
 *
 * @example
 * POST /api/projects/abc123/publish
 */

import { NextResponse } from 'next/server';
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
  ProjectPermissionError,
} from '@/lib/services';

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
 * POST /api/projects/[id]/publish
 *
 * Publish a project
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check authentication
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    console.log('[Publish API] Publishing project:', { id, userId: auth.user.id });

    // Publish project
    const project = await projectService.publishProject(id, auth.user.id);

    console.log('[Publish API] Project published successfully');

    return NextResponse.json(project, { status: 200 });
  } catch (error) {
    console.error('[Publish API] Error publishing project:', error);

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
          error: 'Failed to publish project',
          message: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
