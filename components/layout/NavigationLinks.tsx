/**
 * NavigationLinks Component
 *
 * Responsibilities:
 * - Display main navigation links
 * - Show different links based on auth/seller state
 * - Active link highlighting
 * - Accessible link labels
 *
 * Architecture:
 * - Client Component (uses usePathname for active state)
 * - Receives auth state via props
 * - Reusable in desktop and mobile navigation
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavigationLinksProps {
  isAuthenticated: boolean;
  isSeller: boolean;
  className?: string;
}

interface NavLink {
  href: string;
  label: string;
  requiresAuth?: boolean;
  requiresSeller?: boolean;
  exact?: boolean;
}

/**
 * NavigationLinks Component
 */
export function NavigationLinks({
  isAuthenticated,
  isSeller: _isSeller,
  className,
}: NavigationLinksProps) {
  const pathname = usePathname();

  const links: NavLink[] = [
    { href: '/projects', label: 'Browse Projects' },
    { href: '/how-it-works', label: 'How It Works' },
    ...(isAuthenticated
      ? [{ href: '/dashboard', label: 'Dashboard', requiresAuth: true, exact: true }]
      : []),
  ];

  return (
    <div className={cn('flex items-center gap-6', className)}>
      {links.map((link) => {
        const isActive = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'text-sm font-medium transition-colors hover:text-primary',
              isActive ? 'text-primary' : 'text-gray-700',
              'relative py-2'
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            {link.label}
            {isActive && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                aria-hidden="true"
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
