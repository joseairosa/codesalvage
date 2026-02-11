/**
 * Settings Page (Protected Route)
 *
 * Allows users to edit their profile and view account information.
 */

import Image from 'next/image';
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
    },
  });

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 text-center">
        <Image
          src="/images/settings-header.png"
          alt="Settings"
          width={600}
          height={338}
          className="mx-auto mb-6 rounded-lg"
          priority
        />
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-muted-foreground">Manage your profile and account</p>
      </div>

      {/* Profile Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your public profile information</CardDescription>
        </CardHeader>
        <CardContent>
          <UserSettingsForm
            initialData={{
              fullName: user.fullName ?? '',
              username: user.username ?? '',
              bio: user.bio ?? '',
            }}
          />
        </CardContent>
      </Card>

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
