/**
 * Notifications API Route
 *
 * Handles notification operations for in-app notifications.
 *
 * GET /api/notifications - List user's notifications
 * PATCH /api/notifications - Mark notifications as read
 */

import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { withApiRateLimit } from '@/lib/middleware/withRateLimit';
import {
  NotificationService,
  NotificationValidationError,
} from '@/lib/services/NotificationService';
import { NotificationRepository } from '@/lib/repositories/NotificationRepository';
import { z } from 'zod';

const componentName = 'NotificationsAPI';

// Initialize repository and service
const notificationRepository = new NotificationRepository(prisma);
const notificationService = new NotificationService(notificationRepository);

const markReadSchema = z.union([
  z.object({
    notificationIds: z.array(z.string()).min(1),
  }),
  z.object({
    markAllAsRead: z.literal(true),
  }),
]);

/**
 * GET /api/notifications
 *
 * List user's notifications with unread count
 */
async function getNotifications(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    console.log(`[${componentName}] Fetching notifications for:`, auth.user.id);

    const result = await notificationService.getNotifications(auth.user.id, {
      limit: Math.min(limit, 50),
      offset: Math.max(offset, 0),
      unreadOnly,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(`[${componentName}] Error fetching notifications:`, error);

    return NextResponse.json(
      {
        error: 'Failed to fetch notifications',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 *
 * Mark notifications as read (specific IDs or all)
 */
async function markNotificationsRead(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = markReadSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validatedData.error.errors,
        },
        { status: 400 }
      );
    }

    console.log(`[${componentName}] Marking notifications as read for:`, auth.user.id);

    let updated: number;

    if ('markAllAsRead' in validatedData.data) {
      updated = await notificationService.markAllAsRead(auth.user.id);
    } else {
      updated = await notificationService.markAsRead(
        auth.user.id,
        validatedData.data.notificationIds
      );
    }

    return NextResponse.json({ updated }, { status: 200 });
  } catch (error) {
    console.error(`[${componentName}] Error marking notifications:`, error);

    if (error instanceof NotificationValidationError) {
      return NextResponse.json(
        { error: error.message, field: error.field },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to update notifications',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const GET = withApiRateLimit(getNotifications, async (request) => {
  const auth = await authenticateApiRequest(request);
  return auth?.user.id || 'anonymous';
});

export const PATCH = withApiRateLimit(markNotificationsRead, async (request) => {
  const auth = await authenticateApiRequest(request);
  return auth?.user.id || 'anonymous';
});
