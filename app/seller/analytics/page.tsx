/**
 * Seller Analytics Page (Protected Route - Seller Only)
 *
 * Requires authentication AND seller status.
 * Redirects to:
 * - Sign-in if not authenticated
 * - Home if authenticated but not a seller
 */

import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth-helpers';
import { AnalyticsDashboard } from '@/components/seller/AnalyticsDashboard';
import { DashboardBreadcrumb } from '@/components/layout/DashboardBreadcrumb';

export const metadata = {
  title: 'Analytics | CodeSalvage',
};

export default async function SellerAnalyticsPage() {
  const session = await requireAuth();

  if (!session.user.isSeller) {
    redirect('/?error=seller-only');
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <DashboardBreadcrumb label="Analytics" />
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Track your revenue, views, and project performance
        </p>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}
