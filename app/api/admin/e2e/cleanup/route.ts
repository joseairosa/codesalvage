/**
 * Admin E2E Route: Cleanup Test Data
 *
 * DELETE /api/admin/e2e/cleanup
 *
 * Deletes all E2E test data (users with @e2etest.invalid email and related records).
 * Only available when E2E_SEED_ENABLED=true is set in the environment.
 *
 * Responses:
 * - 200: Cleanup complete with counts
 * - 401: Unauthorized (not admin)
 * - 404: Not available (E2E_SEED_ENABLED not set)
 * - 500: Server error
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

const E2E_EMAIL_PATTERN = '@e2etest.invalid';

/**
 * DELETE /api/admin/e2e/cleanup
 *
 * Removes all E2E test users and related records in FK-safe order.
 * Guarded by E2E_SEED_ENABLED env var.
 */
export async function DELETE(request: NextRequest) {
  if (process.env['E2E_SEED_ENABLED'] !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const auth = await requireAdminApiAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.warn('[API] E2E cleanup called by admin:', auth.user.id);

    // Find all E2E test users
    const e2eUsers = await prisma.user.findMany({
      where: { email: { contains: E2E_EMAIL_PATTERN } },
      select: { id: true },
    });

    const userIds = e2eUsers.map((u) => u.id);
    const userCount = userIds.length;

    if (userIds.length === 0) {
      return NextResponse.json(
        {
          deleted: {
            users: 0,
            projects: 0,
            transactions: 0,
            reviews: 0,
            messages: 0,
            favorites: 0,
            apiKeys: 0,
          },
        },
        { status: 200 }
      );
    }

    // Delete in FK-safe order (leaf nodes first, then parents)
    // 1. API keys
    const { count: apiKeyCount } = await prisma.apiKey.deleteMany({
      where: { userId: { in: userIds } },
    });

    // 2. Reviews (depends on transactions)
    const { count: reviewCount } = await prisma.review.deleteMany({
      where: {
        OR: [{ buyerId: { in: userIds } }, { sellerId: { in: userIds } }],
      },
    });

    // 3. Messages
    const { count: messageCount } = await prisma.message.deleteMany({
      where: {
        OR: [{ senderId: { in: userIds } }, { recipientId: { in: userIds } }],
      },
    });

    // 4. Favorites
    const { count: favoriteCount } = await prisma.favorite.deleteMany({
      where: { userId: { in: userIds } },
    });

    // 5. Offers (ON DELETE RESTRICT on buyerId, sellerId, projectId — must delete before users/projects)
    const { count: offerCount } = await prisma.offer.deleteMany({
      where: {
        OR: [{ buyerId: { in: userIds } }, { sellerId: { in: userIds } }],
      },
    });

    // 6. AdminAuditLog (ON DELETE RESTRICT on adminId — must delete before users)
    const { count: auditLogCount } = await prisma.adminAuditLog.deleteMany({
      where: { adminId: { in: userIds } },
    });

    // 7. Transactions (after reviews)
    const { count: transactionCount } = await prisma.transaction.deleteMany({
      where: {
        OR: [{ buyerId: { in: userIds } }, { sellerId: { in: userIds } }],
      },
    });

    // 8. Projects (after transactions and offers)
    const { count: projectCount } = await prisma.project.deleteMany({
      where: { sellerId: { in: userIds } },
    });

    // 9. Users (after all dependent records)
    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });

    console.log('[API] E2E cleanup complete:', {
      users: userCount,
      projects: projectCount,
      transactions: transactionCount,
      reviews: reviewCount,
      messages: messageCount,
      favorites: favoriteCount,
      offers: offerCount,
      auditLogs: auditLogCount,
      apiKeys: apiKeyCount,
    });

    return NextResponse.json(
      {
        deleted: {
          users: userCount,
          projects: projectCount,
          transactions: transactionCount,
          reviews: reviewCount,
          messages: messageCount,
          favorites: favoriteCount,
          offers: offerCount,
          auditLogs: auditLogCount,
          apiKeys: apiKeyCount,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] DELETE /api/admin/e2e/cleanup - error:', error);
    return NextResponse.json({ error: 'Failed to cleanup E2E data' }, { status: 500 });
  }
}
