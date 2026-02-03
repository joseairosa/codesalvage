/**
 * NavigationAuthArea Component
 *
 * Responsibilities:
 * - Display auth-aware navigation links and user menu
 * - React to client-side Firebase auth state changes
 * - Show loading skeleton while auth state is resolving
 * - Show Sign In / Get Started buttons when unauthenticated
 * - Show NavigationLinks + UserMenu / MobileMenu when authenticated
 *
 * Architecture:
 * - Client Component (uses useSession hook from AuthContext)
 * - Replaces server-side auth check in Navigation to fix layout caching issue
 * - Next.js layouts don't re-render on navigation, so auth state must be client-driven
 */

'use client';

import Link from 'next/link';
import { useSession } from '@/lib/hooks/useSession';
import { Button } from '@/components/ui/button';
import { NavigationLinks } from './NavigationLinks';
import { UserMenu } from './UserMenu';
import { MobileMenu } from './MobileMenu';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationBell } from './NotificationBell';

/**
 * NavigationAuthArea Component
 *
 * Client-side auth-aware area of the navigation bar.
 * Uses useSession() to reactively display the correct UI
 * based on Firebase authentication state.
 */
export function NavigationAuthArea() {
  const { data: session, status } = useSession();

  const isAuthenticated = status === 'authenticated' && !!session;
  const isLoading = status === 'loading';

  return (
    <>
      {/* Desktop Navigation Links */}
      <div className="hidden md:flex md:items-center md:gap-8">
        {isLoading ? (
          <div className="flex items-center gap-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
          </div>
        ) : (
          <NavigationLinks
            isAuthenticated={isAuthenticated}
            isSeller={session?.user?.isSeller ?? false}
          />
        )}
      </div>

      {/* Right side - Auth buttons or User menu */}
      <div className="flex items-center gap-4">
        {isLoading ? (
          <Skeleton className="h-9 w-9 rounded-full" />
        ) : isAuthenticated && session ? (
          <>
            {/* Notification bell (desktop + mobile) */}
            <NotificationBell />

            {/* User menu (desktop) */}
            <div className="hidden md:block">
              <UserMenu user={session.user} />
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <MobileMenu user={session.user} />
            </div>
          </>
        ) : (
          <>
            {/* Sign in button (unauthenticated) */}
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link href="/auth/signin">Sign In</Link>
            </Button>

            <Button asChild className="shadow-md transition-transform hover:scale-105">
              <Link href="/auth/signin">Get Started</Link>
            </Button>
          </>
        )}
      </div>
    </>
  );
}
