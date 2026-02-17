/**
 * Dashboard Page (Protected Route)
 *
 * Requires authentication via Firebase.
 * Redirects to sign-in if user is not authenticated.
 */

import Link from 'next/link';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { stripeService } from '@/lib/services';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, AlertTriangle, CreditCard } from 'lucide-react';

export default async function DashboardPage() {
  const session = await requireAuth();

  const [projectCount, messageCount, transactionCount, user] = await Promise.all([
    prisma.project.count({ where: { sellerId: session.user.id } }),
    prisma.message.count({
      where: {
        OR: [{ senderId: session.user.id }, { recipientId: session.user.id }],
      },
    }),
    prisma.transaction.count({
      where: {
        OR: [{ buyerId: session.user.id }, { sellerId: session.user.id }],
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { createdAt: true, stripeAccountId: true, isVerifiedSeller: true },
    }),
  ]);

  let isVerifiedSeller = session.user.isVerifiedSeller;
  if (session.user.isSeller && !isVerifiedSeller && user?.stripeAccountId) {
    try {
      const isOnboarded = await stripeService.isAccountOnboarded(user.stripeAccountId);
      if (isOnboarded) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { isVerifiedSeller: true },
        });
        isVerifiedSeller = true;
        console.log('[Dashboard] Self-healed: updated isVerifiedSeller to true', {
          userId: session.user.id,
        });
      }
    } catch (err) {
      console.error('[Dashboard] Failed to check Stripe onboarding status:', err);
    }
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600">
            Welcome back, {session.user.username || session.user.email}
          </p>
        </div>
        {session.user.isSeller && (
          <Button
            asChild
            size="lg"
            className="shadow-md transition-transform hover:scale-105"
          >
            <Link href="/projects/new">
              <Plus className="mr-2 h-5 w-5" />
              List your Project
            </Link>
          </Button>
        )}
      </div>

      {session.user.isSeller && !isVerifiedSeller && (
        <Card className="mb-8 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardContent className="flex items-center justify-between py-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0 text-amber-600" />
              <div>
                <h2 className="text-lg font-semibold text-amber-900">
                  Complete Your Payment Setup
                </h2>
                <p className="mt-1 text-sm text-amber-800">
                  You need to connect your Stripe account before buyers can purchase your
                  projects. This only takes a few minutes.
                </p>
              </div>
            </div>
            <Button asChild className="bg-amber-600 hover:bg-amber-700">
              <Link href="/seller/onboard">
                <CreditCard className="mr-2 h-4 w-4" />
                Set Up Payments
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {session.user.isSeller && (
        <Card className="mb-8 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardContent className="flex items-center justify-between py-6">
            <div>
              <h2 className="text-lg font-semibold">List a New Project</h2>
              <p className="mt-1 text-sm text-gray-600">
                Turn your unfinished side projects into revenue. Import from GitHub for
                instant AI-powered analysis.
              </p>
            </div>
            <Button asChild className="bg-green-600 hover:bg-green-700">
              <Link href="/projects/new">
                <Plus className="mr-2 h-4 w-4" />
                List Project
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!session.user.isSeller && (
        <Card className="mb-8 border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <CardContent className="flex items-center justify-between py-6">
            <div>
              <h2 className="text-lg font-semibold">Start Selling on CodeSalvage</h2>
              <p className="mt-1 text-sm text-gray-600">
                List your unfinished projects and turn incomplete code into revenue.
              </p>
            </div>
            <Button asChild>
              <Link href="/seller/onboard">Become a Seller</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="font-medium">Email:</span> {session.user.email}
              </div>
              <div>
                <span className="font-medium">Username:</span>{' '}
                {session.user.username || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Role:</span>{' '}
                {session.user.isSeller ? 'Seller' : 'Buyer'}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="font-medium">Projects:</span> {projectCount}
              </div>
              <div>
                <span className="font-medium">Transactions:</span> {transactionCount}
              </div>
              <div>
                <span className="font-medium">Messages:</span> {messageCount}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Payments:</span>{' '}
                {isVerifiedSeller ? (
                  <span className="text-green-600">Connected</span>
                ) : (
                  <Link
                    href="/seller/onboard"
                    className="text-amber-600 underline hover:text-amber-700"
                  >
                    Not set up
                  </Link>
                )}
              </div>
              <div>
                <span className="font-medium">Member Since:</span>{' '}
                {user?.createdAt
                  ? new Intl.DateTimeFormat('en-US', {
                      month: 'long',
                      year: 'numeric',
                    }).format(user.createdAt)
                  : 'Recently'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
