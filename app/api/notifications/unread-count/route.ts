/**
 * Notification Unread Count API Route
 *
 * Lightweight endpoint for polling notification badge count.
 * Returns only the unread count integer to minimize payload.
 *
 * GET /api/notifications/unread-count
 */

import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { withApiRateLimit } from '@/lib/middleware/withRateLimit';
import { NotificationService } from '@/lib/services/NotificationService';
import { NotificationRepository } from '@/lib/repositories/NotificationRepository';

const componentName = 'NotificationUnreadCountAPI';

// Initialize repository and service
const notificationRepository = new NotificationRepository(prisma);
const notificationService = new NotificationService(notificationRepository);

/**
 * GET /api/notifications/unread-count
 *
 * Returns { unreadCount: number }
 */
async function getUnreadCount(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const unreadCount = await notificationService.getUnreadCount(auth.user.id);

    return NextResponse.json({ unreadCount }, { status: 200 });
  } catch (error) {
    console.error(`[${componentName}] Error fetching unread count:`, error);

    return NextResponse.json({ error: 'Failed to fetch unread count' }, { status: 500 });
  }
}

export const GET = withApiRateLimit(getUnreadCount, async (request) => {
  const auth = await authenticateApiRequest(request);
  return auth?.user.id || 'anonymous';
});
