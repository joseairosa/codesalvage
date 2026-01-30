/**
 * Admin Dashboard Page
 *
 * Responsibilities:
 * - Display platform overview and statistics
 * - Provide quick access to admin actions
 * - Show recent activity and metrics
 *
 * Architecture:
 * - Server Component with auth check
 * - Delegates rendering to AdminDashboard client component
 * - Minimal server-side logic (auth check only)
 */

import { requireAdmin } from '@/lib/auth-helpers';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

/**
 * Admin Dashboard Page
 *
 * Entry point for admin panel with platform statistics.
 */
export default async function AdminPage() {
  // Verify admin access
  const session = await requireAdmin();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Admin Dashboard
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Welcome back, {session.user.username}. Here's an overview of your platform.
        </p>
      </div>

      {/* Dashboard Content */}
      <AdminDashboard />
    </div>
  );
}
