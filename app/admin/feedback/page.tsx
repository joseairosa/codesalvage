/**
 * Admin Feedback Page
 *
 * Responsibilities:
 * - Protect route to admins only
 * - Render feedback management interface
 *
 * Architecture:
 * - Server Component with auth check
 * - Delegates to FeedbackManagement client component
 */

import { requireAdmin } from '@/lib/auth-helpers';
import { FeedbackManagement } from '@/components/admin/FeedbackManagement';

export default async function AdminFeedbackPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Feedback</h1>
        <p className="mt-2 text-sm text-gray-600">
          Review and manage user feedback, bug reports, and feature requests.
        </p>
      </div>

      <FeedbackManagement />
    </div>
  );
}
