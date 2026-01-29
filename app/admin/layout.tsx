/**
 * Admin Layout
 *
 * Responsibilities:
 * - Protect all admin routes with requireAdmin()
 * - Provide consistent admin UI with sidebar navigation
 * - Handle admin-specific layout structure
 *
 * Architecture:
 * - Server Component with auth check
 * - Sidebar navigation with AdminNav component
 * - Content area for admin pages
 * - Full-height layout with responsive design
 */

import { requireAdmin } from '@/lib/auth-helpers';
import { AdminNav } from '@/components/admin/AdminNav';

/**
 * Admin Layout Component
 *
 * Protects all /admin/* routes and provides admin UI layout.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verify admin access (redirects if not admin)
  await requireAdmin();

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-gray-50">
      {/* Sidebar Navigation */}
      <AdminNav />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6 sm:p-8 lg:p-10">{children}</div>
      </main>
    </div>
  );
}
