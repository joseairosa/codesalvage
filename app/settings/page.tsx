/**
 * Settings Page (Protected Route)
 *
 * Allows users to edit their profile and view account information.
 */

import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserSettingsForm } from '@/components/settings/UserSettingsForm';
import { AvatarUpload } from '@/components/settings/AvatarUpload';
import { ApiKeysSection } from '@/components/settings/ApiKeysSection';

export default async function SettingsPage() {
  const session = await requireAuth();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      fullName: true,
      username: true,
      bio: true,
      email: true,
      emailVerified: true,
      isSeller: true,
      createdAt: true,
      avatarUrl: true,
    },
  });

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-muted-foreground">Manage your profile and account</p>
      </div>

      {/* Profile Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your public profile information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Avatar upload */}
          <div className="flex justify-center border-b pb-8">
            <AvatarUpload
              currentAvatarUrl={user.avatarUrl ?? null}
              userInitials={(user.fullName ?? user.username ?? 'U')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            />
          </div>

          <UserSettingsForm
            initialData={{
              fullName: user.fullName ?? '',
              username: user.username ?? '',
              bio: user.bio ?? '',
            }}
          />
        </CardContent>
      </Card>

      {/* API Keys Section (admin only) */}
      {session.user.isAdmin && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              Use API keys to authenticate requests from scripts or CI pipelines. Keys
              start with <code className="text-xs">sk-</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApiKeysSection />
          </CardContent>
        </Card>
      )}

      {/* Account Info Section (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              {user.emailVerified && (
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Verified
                </Badge>
              )}
            </div>

            <div>
              <p className="text-sm font-medium">Role</p>
              <p className="text-sm text-muted-foreground">
                {user.isSeller ? 'Seller' : 'Buyer'}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium">Member Since</p>
              <p className="text-sm text-muted-foreground">
                {new Intl.DateTimeFormat('en-US', {
                  month: 'long',
                  year: 'numeric',
                }).format(user.createdAt)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
