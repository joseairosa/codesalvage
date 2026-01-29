/**
 * Admin Users Page
 *
 * Responsibilities:
 * - Display user management interface
 * - Allow filtering and searching users
 * - Provide ban/unban actions
 * - Show user statistics and details
 *
 * Architecture:
 * - Server Component with auth check
 * - Delegates rendering to UserManagement client component
 */

import { requireAdmin } from '@/lib/auth-helpers';
import { UserManagement } from '@/components/admin/UserManagement';

/**
 * Admin Users Page
 *
 * User management and moderation interface.
 */
export default async function AdminUsersPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          User Management
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage users, sellers, and platform access controls.
        </p>
      </div>

      {/* User Management Component */}
      <UserManagement />
    </div>
  );
}
