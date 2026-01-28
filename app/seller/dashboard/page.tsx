/**
 * Seller Dashboard Page (Protected Route - Seller Only)
 *
 * Requires authentication AND seller status.
 * Redirects to:
 * - Sign-in if not authenticated
 * - Home if authenticated but not a seller
 *
 * Displays comprehensive analytics dashboard with:
 * - Revenue tracking and charts
 * - Engagement metrics (views, favorites, sales)
 * - Top performing projects
 * - Export to CSV functionality
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AnalyticsDashboard } from '@/components/seller/AnalyticsDashboard';
import { Plus } from 'lucide-react';

export default async function SellerDashboardPage() {
  const session = await auth();

  // Redirect to sign-in if not authenticated
  if (!session?.user) {
    redirect('/auth/signin');
  }

  // Redirect to home if not a seller
  if (!session.user.isSeller) {
    redirect('/?error=seller-only');
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Seller Dashboard</h1>
          <p className="text-gray-600">Manage your projects and track performance</p>
        </div>

        <Button asChild>
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      <AnalyticsDashboard />
    </div>
  );
}
