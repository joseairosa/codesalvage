/**
 * Navigation Component
 *
 * Responsibilities:
 * - Display site navigation with auth state awareness
 * - Show authenticated vs. unauthenticated navigation
 * - Display user profile menu for authenticated users
 * - Responsive mobile navigation
 * - Accessibility support (keyboard navigation, ARIA labels)
 *
 * Architecture:
 * - Server Component (can access auth() directly)
 * - Conditional rendering based on session state
 * - Composition pattern (NavigationLinks, UserMenu components)
 * - Mobile-first responsive design
 */

import Link from 'next/link';
import { auth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { NavigationLinks } from './NavigationLinks';
import { UserMenu } from './UserMenu';
import { MobileMenu } from './MobileMenu';

/**
 * Navigation Component
 */
export async function Navigation() {
  const session = await auth();

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 transition-transform hover:scale-105"
          aria-label="ProjectFinish home"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-md">
            <span className="text-xl font-bold text-white">PF</span>
          </div>
          <span className="hidden text-xl font-bold text-gray-900 sm:inline">
            Project<span className="text-blue-600">Finish</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex md:items-center md:gap-8">
          <NavigationLinks
            isAuthenticated={!!session}
            isSeller={session?.user?.isSeller ?? false}
          />
        </div>

        {/* Right side - Auth buttons or User menu */}
        <div className="flex items-center gap-4">
          {session ? (
            <>
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
      </div>
    </nav>
  );
}
