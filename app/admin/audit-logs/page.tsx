/**
 * Admin Audit Logs Page
 *
 * Responsibilities:
 * - Display audit log interface
 * - Allow filtering by admin, target, and action
 * - Show detailed audit trail
 * - Provide accountability for all admin actions
 *
 * Architecture:
 * - Server Component with auth check
 * - Delegates rendering to AuditLogViewer client component
 */

import { requireAdmin } from '@/lib/auth-helpers';
import { AuditLogViewer } from '@/components/admin/AuditLogViewer';

/**
 * Admin Audit Logs Page
 *
 * Audit trail and accountability interface.
 */
export default async function AdminAuditLogsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Audit Logs</h1>
        <p className="mt-2 text-sm text-gray-600">
          Complete audit trail of all administrative actions.
        </p>
      </div>

      {/* Audit Log Viewer Component */}
      <AuditLogViewer />
    </div>
  );
}
