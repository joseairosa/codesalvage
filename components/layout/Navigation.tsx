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
 * - Server Component for the static shell (logo, structure)
 * - Delegates auth-dependent rendering to NavigationAuthArea (Client Component)
 * - This fixes the Next.js layout caching issue where layouts don't re-render
 *   on client-side navigation, causing stale auth state in the navbar
 */

import Link from 'next/link';
import Image from 'next/image';
import { NavigationAuthArea } from './NavigationAuthArea';

/**
 * Navigation Component
 */
export function Navigation() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 transition-transform hover:scale-105"
          aria-label="CodeSalvage home"
        >
          <Image
            src="/images/branding/codesalvage_logo_square.png"
            alt="CodeSalvage logo"
            width={48}
            height={48}
            priority
          />
          <span className="hidden text-xl font-bold text-gray-900 sm:inline">
            Code<span className="text-blue-600">Salvage</span>
          </span>
        </Link>

        {/* Auth-aware navigation and user menu (Client Component) */}
        <NavigationAuthArea />
      </div>
    </nav>
  );
}
