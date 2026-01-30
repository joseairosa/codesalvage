/**
 * MobileMenu Component
 *
 * Responsibilities:
 * - Display mobile navigation drawer
 * - Show navigation links and user menu in mobile view
 * - Handle menu open/close state
 * - Accessibility support (keyboard navigation, focus trap)
 *
 * Architecture:
 * - Client Component (manages open/close state)
 * - Uses Shadcn Sheet component
 * - Composition with NavigationLinks
 */

'use client';

import { useState } from 'react';
import { useSignOut } from '@/lib/hooks/useSession';
import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Menu,
  LogOut,
  User,
  Settings,
  LayoutDashboard,
  Package,
  Star,
} from 'lucide-react';
import { NavigationLinks } from './NavigationLinks';

interface MobileMenuProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    username?: string | null;
    isSeller?: boolean;
    isVerifiedSeller?: boolean;
  };
}

/**
 * MobileMenu Component
 */
export function MobileMenu({ user }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const signOut = useSignOut();

  const handleSignOut = async () => {
    console.log('[MobileMenu] Signing out user:', user.id);
    setIsOpen(false);
    await signOut();
  };

  // Get user initials for avatar fallback
  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : (user.username?.slice(0, 2).toUpperCase() ?? 'U');

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Navigate to different pages and manage your account
          </SheetDescription>

          {/* User info */}
          <div className="flex items-center gap-3 border-b pb-4">
            <Avatar className="h-12 w-12 border-2 border-gray-200">
              <AvatarImage
                src={user.image ?? undefined}
                alt={user.name ?? 'User avatar'}
              />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-semibold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col">
              <span className="text-sm font-medium">{user.name ?? user.username}</span>
              <span className="text-xs text-muted-foreground">{user.email}</span>
            </div>
          </div>
        </SheetHeader>

        {/* Navigation links */}
        <div className="mt-6 flex flex-col gap-4">
          <NavigationLinks
            isAuthenticated={true}
            isSeller={user.isSeller ?? false}
            className="flex-col items-start gap-3"
          />

          <div className="my-4 border-t" />

          {/* Quick actions */}
          <div className="flex flex-col gap-2">
            <Button variant="ghost" asChild className="justify-start">
              <Link href="/dashboard" onClick={() => setIsOpen(false)}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </Button>

            {user.isSeller && (
              <>
                <Button variant="ghost" asChild className="justify-start">
                  <Link href="/seller/projects" onClick={() => setIsOpen(false)}>
                    <Package className="mr-2 h-4 w-4" />
                    My Projects
                  </Link>
                </Button>

                <Button variant="ghost" asChild className="justify-start">
                  <Link href="/seller/analytics" onClick={() => setIsOpen(false)}>
                    <Star className="mr-2 h-4 w-4" />
                    Analytics
                  </Link>
                </Button>
              </>
            )}

            <Button variant="ghost" asChild className="justify-start">
              <Link
                href={`/profile/${user.username ?? user.id}`}
                onClick={() => setIsOpen(false)}
              >
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </Button>

            <Button variant="ghost" asChild className="justify-start">
              <Link href="/settings" onClick={() => setIsOpen(false)}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </Button>
          </div>

          <div className="my-4 border-t" />

          {/* Sign out */}
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="justify-start text-red-600"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
