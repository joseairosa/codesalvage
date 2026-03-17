/**
 * Admin Payouts Page
 *
 * Payout oversight and manual action interface.
 */

import { requireAdmin } from '@/lib/auth-helpers';
import { PayoutManagement } from '@/components/admin/PayoutManagement';

export default async function AdminPayoutsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Payout Management
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          View and manage seller payouts. Payouts are processed weekly via PayPal.
        </p>
      </div>

      <PayoutManagement />
    </div>
  );
}
