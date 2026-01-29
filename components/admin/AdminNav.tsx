/**
 * AdminNav Component
 *
 * Responsibilities:
 * - Display admin sidebar navigation
 * - Highlight active navigation item
 * - Provide quick access to all admin sections
 * - Responsive design with mobile support
 *
 * Architecture:
 * - Client Component (uses usePathname for active state)
 * - Icon-based navigation items
 * - Active state highlighting
 * - Semantic navigation markup
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  CreditCard,
  FileText,
  Flag,
} from 'lucide-react';

/**
 * Navigation Item Configuration
 */
interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  {
    href: '/admin',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    href: '/admin/users',
    label: 'Users',
    icon: Users,
  },
  {
    href: '/admin/projects',
    label: 'Projects',
    icon: FolderOpen,
  },
  {
    href: '/admin/transactions',
    label: 'Transactions',
    icon: CreditCard,
  },
  {
    href: '/admin/audit-logs',
    label: 'Audit Logs',
    icon: FileText,
  },
  {
    href: '/admin/reports',
    label: 'Reports',
    icon: Flag,
  },
];

/**
 * AdminNav Component
 *
 * Displays admin sidebar navigation with active state.
 */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="w-64 border-r bg-white shadow-sm">
      <div className="sticky top-16 p-6">
        {/* Admin Header */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Admin Panel
          </h2>
        </div>

        {/* Navigation Items */}
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className={cn('h-5 w-5', isActive ? 'text-blue-700' : 'text-gray-500')} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Admin Badge */}
        <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
              <span className="text-xs font-bold text-white">A</span>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-blue-900">Admin Access</p>
              <p className="text-xs text-blue-700">Full Platform Control</p>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
