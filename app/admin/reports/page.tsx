/**
 * Admin Reports Page
 *
 * Responsibilities:
 * - Display content report interface
 * - Allow filtering by status and content type
 * - Provide resolve/dismiss actions
 * - Show reporter and content details
 *
 * Architecture:
 * - Server Component with auth check
 * - Delegates rendering to ContentReportManagement client component
 */

import { requireAdmin } from '@/lib/auth-helpers';
import { ContentReportManagement } from '@/components/admin/ContentReportManagement';

/**
 * Admin Reports Page
 *
 * Content report management and resolution interface.
 */
export default async function AdminReportsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Content Reports
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Review and resolve user-submitted content reports.
        </p>
      </div>

      {/* Content Report Management Component */}
      <ContentReportManagement />
    </div>
  );
}
