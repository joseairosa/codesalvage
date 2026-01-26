/**
 * UserMenu Component
 *
 * Responsibilities:
 * - Display user avatar and dropdown menu
 * - Provide quick access to user-related pages
 * - Handle sign out action
 * - Show seller-specific links for sellers
 * - Accessibility support
 *
 * Architecture:
 * - Client Component (uses signOut action)
 * - Composition with Shadcn dropdown-menu and avatar
 * - Conditional menu items based on user role
 */

'use client';

import { signOut } from 'next-auth/react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  User,
  Settings,
  LayoutDashboard,
  Package,
  Star,
  LogOut,
  ShieldCheck,
} from 'lucide-react';

interface UserMenuProps {
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
 * UserMenu Component
 */
export function UserMenu({ user }: UserMenuProps) {
  const handleSignOut = async () => {
    console.log('[UserMenu] Signing out user:', user.id);
    await signOut({ callbackUrl: '/' });
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex items-center gap-2 rounded-full transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="Open user menu"
        >
          <Avatar className="h-9 w-9 border-2 border-gray-200">
            <AvatarImage src={user.image ?? undefined} alt={user.name ?? 'User avatar'} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-semibold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>

          {user.isVerifiedSeller && (
            <div
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 ring-2 ring-white"
              title="Verified Seller"
            >
              <ShieldCheck className="h-3 w-3 text-white" aria-hidden="true" />
            </div>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.name ?? user.username}
            </p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Dashboard */}
        <DropdownMenuItem asChild>
          <Link href="/dashboard" className="flex cursor-pointer items-center gap-2">
            <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
            <span>Dashboard</span>
          </Link>
        </DropdownMenuItem>

        {/* Seller-specific links */}
        {user.isSeller && (
          <>
            <DropdownMenuItem asChild>
              <Link
                href="/seller/projects"
                className="flex cursor-pointer items-center gap-2"
              >
                <Package className="h-4 w-4" aria-hidden="true" />
                <span>My Projects</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuItem asChild>
              <Link
                href="/seller/analytics"
                className="flex cursor-pointer items-center gap-2"
              >
                <Star className="h-4 w-4" aria-hidden="true" />
                <span>Analytics</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}

        {/* Profile & Settings */}
        <DropdownMenuItem asChild>
          <Link
            href={`/profile/${user.username ?? user.id}`}
            className="flex cursor-pointer items-center gap-2"
          >
            <User className="h-4 w-4" aria-hidden="true" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex cursor-pointer items-center gap-2">
            <Settings className="h-4 w-4" aria-hidden="true" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Sign out */}
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-red-600 focus:text-red-600"
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
