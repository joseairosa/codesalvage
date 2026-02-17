/**
 * Admin Stats API Route
 *
 * GET /api/admin/stats - Get comprehensive platform statistics
 *
 * Admin only endpoint that returns platform-wide metrics including:
 * - Total users, sellers, banned users
 * - Total projects (active, sold, draft)
 * - Total transactions and revenue
 * - Pending content reports
 *
 * @example
 * GET /api/admin/stats
 * Authorization: session cookie (admin user)
 */

import { NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import {
  AdminRepository,
  UserRepository,
  ProjectRepository,
  TransactionRepository,
} from '@/lib/repositories';
import { AdminService, emailService, stripeService } from '@/lib/services';

const adminRepository = new AdminRepository(prisma);
const userRepository = new UserRepository(prisma);
const projectRepository = new ProjectRepository(prisma);
const transactionRepository = new TransactionRepository(prisma);

const adminService = new AdminService(
  adminRepository,
  userRepository,
  projectRepository,
  transactionRepository,
  emailService,
  stripeService
);

/**
 * GET /api/admin/stats
 *
 * Get platform statistics
 */
export async function GET(request: Request) {
  const auth = await requireAdminApiAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[API] GET /api/admin/stats - Admin:', auth.user.id);

  try {
    const stats = await adminService.getPlatformStats();

    return NextResponse.json({ stats }, { status: 200 });
  } catch (error) {
    console.error('[API] GET /api/admin/stats - Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch platform statistics' },
      { status: 500 }
    );
  }
}
