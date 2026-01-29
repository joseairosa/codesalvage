/**
 * Admin Projects Page
 *
 * Responsibilities:
 * - Display project moderation interface
 * - Allow filtering and searching projects
 * - Provide approve/reject/feature actions
 * - Show project details and seller info
 *
 * Architecture:
 * - Server Component with auth check
 * - Delegates rendering to ProjectModeration client component
 */

import { requireAdmin } from '@/lib/auth-helpers';
import { ProjectModeration } from '@/components/admin/ProjectModeration';

/**
 * Admin Projects Page
 *
 * Project moderation and management interface.
 */
export default async function AdminProjectsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Project Moderation
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Review, approve, and moderate platform projects.
        </p>
      </div>

      {/* Project Moderation Component */}
      <ProjectModeration />
    </div>
  );
}
