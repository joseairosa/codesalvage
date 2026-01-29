/**
 * Admin Transactions Page
 *
 * Responsibilities:
 * - Display transaction oversight interface
 * - Allow filtering and searching transactions
 * - Provide escrow release action for dispute resolution
 * - Show transaction, buyer, seller, and project details
 *
 * Architecture:
 * - Server Component with auth check
 * - Delegates rendering to TransactionOversight client component
 */

import { requireAdmin } from '@/lib/auth-helpers';
import { TransactionOversight } from '@/components/admin/TransactionOversight';

/**
 * Admin Transactions Page
 *
 * Transaction oversight and dispute resolution interface.
 */
export default async function AdminTransactionsPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Transaction Oversight
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Monitor platform transactions and resolve disputes.
        </p>
      </div>

      {/* Transaction Oversight Component */}
      <TransactionOversight />
    </div>
  );
}
