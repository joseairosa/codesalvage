/**
 * Admin Disputes Page
 *
 * Responsibilities:
 * - Display dispute oversight interface
 * - Allow filtering by status
 * - Provide resolve action for pending disputes
 *
 * Architecture:
 * - Server Component with auth check
 * - Delegates rendering to DisputeOversight client component
 */

import { requireAdmin } from '@/lib/auth-helpers';
import { DisputeOversight } from '@/components/admin/DisputeOversight';

export default async function AdminDisputesPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Dispute Oversight
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Review and resolve buyer disputes. Resolving a dispute releases escrow or issues
          a refund.
        </p>
      </div>

      <DisputeOversight />
    </div>
  );
}
