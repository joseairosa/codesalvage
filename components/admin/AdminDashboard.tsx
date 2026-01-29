/**
 * AdminDashboard Component
 *
 * Responsibilities:
 * - Fetch and display platform statistics
 * - Show key metrics in card format
 * - Handle loading and error states
 * - Provide visual overview of platform health
 *
 * Architecture:
 * - Client Component (uses useEffect for data fetching)
 * - Card-based layout with stat cards
 * - Responsive grid layout
 * - Error handling with user feedback
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Users,
  ShoppingBag,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  UserCheck,
  UserX,
  Package,
} from 'lucide-react';

/**
 * Platform Statistics Interface
 */
interface PlatformStats {
  totalUsers: number;
  totalSellers: number;
  totalVerifiedSellers: number;
  totalBannedUsers: number;
  totalProjects: number;
  totalActiveProjects: number;
  totalSoldProjects: number;
  totalDraftProjects: number;
  totalTransactions: number;
  totalRevenueCents: number;
  totalPendingReports: number;
  totalResolvedReports: number;
  totalDismissedReports: number;
}

/**
 * Stat Card Configuration
 */
interface StatCard {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  subtitle?: string;
}

/**
 * Format currency from cents
 */
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Format number with commas
 */
function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

/**
 * AdminDashboard Component
 *
 * Displays platform statistics and metrics.
 */
export function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch platform statistics
   */
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/stats');

        if (!res.ok) {
          throw new Error('Failed to fetch statistics');
        }

        const data = await res.json();
        setStats(data.stats);
      } catch (err) {
        console.error('[AdminDashboard] Fetch error:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load statistics'
        );
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 w-24 rounded bg-gray-200" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 rounded bg-gray-200" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Error state
  if (error || !stats) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error || 'Failed to load statistics'}</AlertDescription>
      </Alert>
    );
  }

  /**
   * Build stat cards from data
   */
  const statCards: StatCard[] = [
    {
      title: 'Total Users',
      value: formatNumber(stats.totalUsers),
      icon: Users,
      color: 'blue',
      subtitle: `${formatNumber(stats.totalSellers)} sellers`,
    },
    {
      title: 'Verified Sellers',
      value: formatNumber(stats.totalVerifiedSellers),
      icon: UserCheck,
      color: 'green',
    },
    {
      title: 'Banned Users',
      value: formatNumber(stats.totalBannedUsers),
      icon: UserX,
      color: 'red',
    },
    {
      title: 'Total Projects',
      value: formatNumber(stats.totalProjects),
      icon: Package,
      color: 'purple',
      subtitle: `${formatNumber(stats.totalActiveProjects)} active`,
    },
    {
      title: 'Sold Projects',
      value: formatNumber(stats.totalSoldProjects),
      icon: CheckCircle,
      color: 'green',
    },
    {
      title: 'Draft Projects',
      value: formatNumber(stats.totalDraftProjects),
      icon: ShoppingBag,
      color: 'orange',
    },
    {
      title: 'Total Revenue',
      value: formatCurrency(stats.totalRevenueCents),
      icon: DollarSign,
      color: 'green',
      subtitle: `${formatNumber(stats.totalTransactions)} transactions`,
    },
    {
      title: 'Pending Reports',
      value: formatNumber(stats.totalPendingReports),
      icon: AlertTriangle,
      color: 'orange',
      subtitle: `${formatNumber(stats.totalResolvedReports)} resolved`,
    },
  ];

  /**
   * Color classes for icons
   */
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    purple: 'bg-purple-100 text-purple-700',
    orange: 'bg-orange-100 text-orange-700',
    red: 'bg-red-100 text-red-700',
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((card) => {
        const Icon = card.icon;

        return (
          <Card key={card.title} className="transition-shadow hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {card.title}
              </CardTitle>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  colorClasses[card.color]
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{card.value}</div>
              {card.subtitle && (
                <p className="mt-1 text-xs text-gray-500">{card.subtitle}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
