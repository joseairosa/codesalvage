import Link from 'next/link';
import { ChevronRight, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardBreadcrumbProps {
  label: string;
}

/**
 * Breadcrumb with a "Back to Dashboard" button for dashboard sub-pages.
 * Renders: [← Dashboard]  Dashboard > Label
 */
export function DashboardBreadcrumb({ label }: DashboardBreadcrumbProps) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Dashboard</span>
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground/50" aria-hidden="true" />
        <span className="font-medium text-foreground">{label}</span>
      </nav>

      <Button asChild variant="outline" size="sm">
        <Link href="/dashboard">← Back to Dashboard</Link>
      </Button>
    </div>
  );
}
