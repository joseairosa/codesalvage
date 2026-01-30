/**
 * Admin Users API Route
 *
 * GET /api/admin/users - List all users with filters and pagination
 *
 * Query parameters:
 * - isBanned: boolean - Filter by banned status
 * - isAdmin: boolean - Filter by admin status
 * - isSeller: boolean - Filter by seller status
 * - isVerifiedSeller: boolean - Filter by verified seller status
 * - limit: number - Results per page (default 50)
 * - offset: number - Pagination offset (default 0)
 * - sortBy: 'createdAt' | 'lastLogin' | 'email' | 'username' - Sort field
 * - sortOrder: 'asc' | 'desc' - Sort direction
 *
 * @example
 * GET /api/admin/users?isBanned=true&limit=20
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAdminApiAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import {
  AdminRepository,
  UserRepository,
  ProjectRepository,
  TransactionRepository,
} from '@/lib/repositories';
import { AdminService, emailService } from '@/lib/services';

// Initialize repositories and services
const adminRepository = new AdminRepository(prisma);
const userRepository = new UserRepository(prisma);
const projectRepository = new ProjectRepository(prisma);
const transactionRepository = new TransactionRepository(prisma);

const adminService = new AdminService(
  adminRepository,
  userRepository,
  projectRepository,
  transactionRepository,
  emailService
);

/**
 * GET /api/admin/users
 *
 * List users with filters and pagination
 */
export async function GET(request: NextRequest) {
  // Verify admin authentication
  const auth = await requireAdminApiAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[API] GET /api/admin/users - Admin:', auth.user.id);

  try {
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const isBanned = searchParams.get('isBanned') === 'true' ? true : searchParams.get('isBanned') === 'false' ? false : undefined;
    const isAdmin = searchParams.get('isAdmin') === 'true' ? true : searchParams.get('isAdmin') === 'false' ? false : undefined;
    const isSeller = searchParams.get('isSeller') === 'true' ? true : searchParams.get('isSeller') === 'false' ? false : undefined;
    const isVerifiedSeller = searchParams.get('isVerifiedSeller') === 'true' ? true : searchParams.get('isVerifiedSeller') === 'false' ? false : undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = (searchParams.get('sortBy') || 'createdAt') as 'createdAt' | 'lastLogin' | 'email' | 'username';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Filter out undefined values to satisfy exactOptionalPropertyTypes
    const filters = Object.fromEntries(
      Object.entries({
        isBanned,
        isAdmin,
        isSeller,
        isVerifiedSeller,
      }).filter(([_, value]) => value !== undefined)
    ) as {
      isBanned?: boolean;
      isAdmin?: boolean;
      isSeller?: boolean;
      isVerifiedSeller?: boolean;
    };

    const users = await adminService.getUsers({
      ...filters,
      limit,
      offset,
      sortBy,
      sortOrder,
    });

    // Also get total count for pagination
    const total = await userRepository.countUsers(filters);

    return NextResponse.json(
      {
        users,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + users.length < total,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API] GET /api/admin/users - Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
