'use client';

/**
 * AnalyticsDashboard Component
 *
 * Comprehensive analytics dashboard for sellers with:
 * - Revenue tracking
 * - Engagement metrics (views, favorites, sales)
 * - Revenue over time chart
 * - Top performing projects
 * - CSV export functionality
 *
 * Performance: Uses dynamic imports for Recharts (~100KB reduction in initial bundle)
 */

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, TrendingUp, DollarSign, Eye, Heart, ShoppingCart, Loader2 } from 'lucide-react';

// Dynamic import for Recharts to reduce initial bundle size
const LineChart = dynamic(
  () => import('recharts').then((mod) => mod.LineChart as any),
  { ssr: false, loading: () => <div className="h-[300px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> }
) as any;
const Line = dynamic(() => import('recharts').then((mod) => mod.Line as any), { ssr: false }) as any;
const BarChart = dynamic(
  () => import('recharts').then((mod) => mod.BarChart as any),
  { ssr: false, loading: () => <div className="h-[300px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> }
) as any;
const Bar = dynamic(() => import('recharts').then((mod) => mod.Bar as any), { ssr: false }) as any;
const XAxis = dynamic(() => import('recharts').then((mod) => mod.XAxis as any), { ssr: false }) as any;
const YAxis = dynamic(() => import('recharts').then((mod) => mod.YAxis as any), { ssr: false }) as any;
const CartesianGrid = dynamic(() => import('recharts').then((mod) => mod.CartesianGrid as any), { ssr: false }) as any;
const Tooltip = dynamic(() => import('recharts').then((mod) => mod.Tooltip as any), { ssr: false }) as any;
const Legend = dynamic(() => import('recharts').then((mod) => mod.Legend as any), { ssr: false }) as any;
const ResponsiveContainer = dynamic(
  () => import('recharts').then((mod) => mod.ResponsiveContainer as any),
  { ssr: false }
) as any;

interface AnalyticsData {
  userId: string;
  summary: {
    totalProjects: number;
    totalSold: number;
    totalRevenue: number;
    averageRevenue: number;
    totalViews: number;
    totalFavorites: number;
    conversionRate: number;
  };
  revenueOverTime: Array<{
    date: string;
    revenue: number;
    transactionCount: number;
  }>;
  topProjects: Array<{
    projectId: string;
    projectTitle: string;
    views: number;
    favorites: number;
    revenue: number;
    transactionCount: number;
  }>;
}

interface DateRange {
  label: string;
  startDate: Date;
  endDate: Date;
}

const componentName = 'AnalyticsDashboard';

export function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<string>('30');

  // Calculate date range based on selection
  const getDateRange = (days: number): DateRange => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return {
      label: `Last ${days} days`,
      startDate,
      endDate,
    };
  };

  // Fetch analytics data
  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const range = getDateRange(parseInt(selectedRange));
      const params = new URLSearchParams({
        startDate: range.startDate.toISOString(),
        endDate: range.endDate.toISOString(),
        granularity: selectedRange === '7' ? 'day' : selectedRange === '30' ? 'day' : 'week',
      });

      console.log(`[${componentName}] Fetching analytics:`, params.toString());

      const response = await fetch(`/api/analytics/overview?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch analytics');
      }

      const data = await response.json();
      console.log(`[${componentName}] Analytics loaded:`, {
        projects: data.summary.totalProjects,
        revenue: data.summary.totalRevenue,
      });

      setAnalytics(data);
    } catch (err) {
      console.error(`[${componentName}] Error fetching analytics:`, err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [selectedRange]);

  // Format currency
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!analytics) return;

    console.log(`[${componentName}] Exporting analytics to CSV`);

    const csvData = analytics.topProjects
      .map((project) => ({
        Project: project.projectTitle,
        Views: project.views,
        Favorites: project.favorites,
        Sales: project.transactionCount,
        Revenue: formatCurrency(project.revenue),
      }));

    const headers = Object.keys(csvData[0] || {}).join(',');
    const rows = csvData.map((row) => Object.values(row).join(','));
    const csv = [headers, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    console.log(`[${componentName}] CSV exported successfully`);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <p className="text-center text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return null;
  }

  const { summary, revenueOverTime, topProjects } = analytics;

  return (
    <div className="space-y-6">
      {/* Header with Date Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Analytics Overview</h2>
          <p className="text-gray-600">Track your performance and revenue</p>
        </div>

        <div className="flex items-center gap-4">
          <Select value={selectedRange} onValueChange={setSelectedRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={exportToCSV} variant="outline" disabled={topProjects.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</div>
            <p className="text-xs text-gray-600">
              {summary.totalSold} {summary.totalSold === 1 ? 'sale' : 'sales'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projects Listed</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalProjects}</div>
            <p className="text-xs text-gray-600">Active listings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalViews.toLocaleString()}</div>
            <p className="text-xs text-gray-600">All projects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-gray-600">Views to sales</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Over Time Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Over Time</CardTitle>
          <CardDescription>Track your earnings over the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {revenueOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueOverTime}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis
                  tickFormatter={(value) => `$${(value / 100).toFixed(0)}`}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Revenue"
                  dot={{ fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-gray-500">
              No revenue data for selected period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Projects Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Projects</CardTitle>
          <CardDescription>Your best projects ranked by revenue</CardDescription>
        </CardHeader>
        <CardContent>
          {topProjects.length > 0 ? (
            <div className="space-y-4">
              {topProjects.map((project, index) => (
                <div
                  key={project.projectId}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-600">
                      #{index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{project.projectTitle}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {project.views} views
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3" />
                          {project.favorites} favorites
                        </span>
                        <span className="flex items-center gap-1">
                          <ShoppingCart className="h-3 w-3" />
                          {project.transactionCount} {project.transactionCount === 1 ? 'sale' : 'sales'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{formatCurrency(project.revenue)}</p>
                    <p className="text-sm text-gray-600">Revenue</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              No sales data for selected period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Engagement Metrics Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Engagement Overview</CardTitle>
          <CardDescription>Compare views, favorites, and sales</CardDescription>
        </CardHeader>
        <CardContent>
          {topProjects.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProjects.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="projectTitle"
                  tick={{ fontSize: 12 }}
                  angle={-15}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="views" fill="#8b5cf6" name="Views" />
                <Bar dataKey="favorites" fill="#ec4899" name="Favorites" />
                <Bar dataKey="transactionCount" fill="#10b981" name="Sales" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center text-gray-500">
              No engagement data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
