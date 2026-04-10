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
import {
  Plus,
  AlertTriangle,
  CreditCard,
  Clock,
  Tag,
  ShoppingBag,
  FolderOpen,
  Inbox,
  TrendingUp,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';
import type { OnboardingStep } from '@/components/onboarding/OnboardingChecklist';

export default async function DashboardPage() {
  const session = await requireAuth();

  const [
    projectCount,
    messageCount,
    transactionCount,
    buyerPurchaseCount,
    user,
    favoriteCount,
    sentMessageCount,
  ] = await Promise.all([
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
    prisma.transaction.count({
      where: { buyerId: session.user.id, paymentStatus: 'succeeded' },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        createdAt: true,
        stripeAccountId: true,
        isVerifiedSeller: true,
        bio: true,
        onboardingDismissedAt: true,
      },
    }),
    prisma.favorite.count({ where: { userId: session.user.id } }),
    prisma.message.count({ where: { senderId: session.user.id } }),
  ]);

  let isVerifiedSeller = session.user.isVerifiedSeller;
  let onboardingStatus: {
    detailsSubmitted: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
  } | null = null;
  if (session.user.isSeller && user?.stripeAccountId) {
    try {
      onboardingStatus = await stripeService.getOnboardingStatus(user.stripeAccountId);
      const fullyOnboarded =
        onboardingStatus.chargesEnabled && onboardingStatus.detailsSubmitted;
      if (fullyOnboarded && !isVerifiedSeller) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { isVerifiedSeller: true },
        });
        isVerifiedSeller = true;
        console.log('[Dashboard] Self-healed: updated isVerifiedSeller to true', {
          userId: session.user.id,
        });
      } else if (!fullyOnboarded && isVerifiedSeller) {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { isVerifiedSeller: false },
        });
        isVerifiedSeller = false;
        console.warn('[Dashboard] isVerifiedSeller was stale, reset to false', {
          userId: session.user.id,
        });
      }
    } catch (err) {
      const stripeErr = err as { code?: string };
      if (stripeErr.code === 'resource_missing') {
        console.warn(
          '[Dashboard] Stale stripeAccountId detected, resetting:',
          user.stripeAccountId
        );
        await prisma.user.update({
          where: { id: session.user.id },
          data: { stripeAccountId: null, isVerifiedSeller: false },
        });
        isVerifiedSeller = false;
      } else {
        console.error('[Dashboard] Failed to check Stripe onboarding status:', err);
      }
    }
  }

  // Build onboarding steps from real DB state
  const profileDone = Boolean(user?.bio && user.bio.trim().length > 0);
  const onboardingSteps: OnboardingStep[] = session.user.isSeller
    ? [
        {
          id: 'profile',
          label: 'Complete your profile',
          description: 'Add a bio so buyers know who you are.',
          done: profileDone,
          href: '/settings',
        },
        {
          id: 'stripe',
          label: 'Connect payment account',
          description: 'Required before buyers can purchase your projects.',
          done: isVerifiedSeller,
          href: '/seller/onboard',
        },
        {
          id: 'project',
          label: 'List your first project',
          description: 'Turn your unfinished code into revenue.',
          done: projectCount > 0,
          href: '/projects/new',
        },
        {
          id: 'message',
          label: 'Send your first message',
          description: 'Reach out to a buyer to start a conversation.',
          done: sentMessageCount > 0,
          href: '/messages',
        },
      ]
    : [
        {
          id: 'profile',
          label: 'Complete your profile',
          description: 'Add a bio so sellers know who you are.',
          done: profileDone,
          href: '/settings',
        },
        {
          id: 'favorite',
          label: 'Favorite a project',
          description: 'Save a project you like to revisit it later.',
          done: favoriteCount > 0,
          href: '/projects',
        },
        {
          id: 'purchase',
          label: 'Make your first purchase',
          description: 'Find a project that fits your skills and complete it.',
          done: buyerPurchaseCount > 0,
          href: '/projects',
        },
      ];

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

      <OnboardingChecklist
        steps={onboardingSteps}
        dismissed={
          user?.onboardingDismissedAt !== null &&
          user?.onboardingDismissedAt !== undefined
        }
      />

      {session.user.isSeller &&
        !isVerifiedSeller &&
        onboardingStatus?.detailsSubmitted && (
          <Card className="mb-8 border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardContent className="flex items-center justify-between py-6">
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-6 w-6 flex-shrink-0 text-blue-600" />
                <div>
                  <h2 className="text-lg font-semibold text-blue-900">
                    Account Under Review
                  </h2>
                  <p className="mt-1 text-sm text-blue-800">
                    Your payment details have been submitted and are being reviewed by
                    Stripe. This usually takes a few minutes but can take up to 24 hours.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

      {session.user.isSeller &&
        !isVerifiedSeller &&
        !onboardingStatus?.detailsSubmitted && (
          <Card className="mb-8 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50">
            <CardContent className="flex items-center justify-between py-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0 text-amber-600" />
                <div>
                  <h2 className="text-lg font-semibold text-amber-900">
                    Complete Your Payment Setup
                  </h2>
                  <p className="mt-1 text-sm text-amber-800">
                    You need to connect your Stripe account before buyers can purchase
                    your projects. This only takes a few minutes.
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

      {/* Navigation Hub */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Quick Navigation</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/dashboard/offers"
            className="group flex items-center gap-4 rounded-lg border bg-white p-4 shadow-sm transition-all hover:border-primary hover:shadow-md"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Tag className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900">My Offers</p>
              <p className="truncate text-sm text-gray-500">
                Offers you&apos;ve made on projects
              </p>
            </div>
            <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400 transition-colors group-hover:text-primary" />
          </Link>

          <Link
            href="/buyer/purchases"
            className="group flex items-center gap-4 rounded-lg border bg-white p-4 shadow-sm transition-all hover:border-primary hover:shadow-md"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <ShoppingBag className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900">My Purchases</p>
              <p className="truncate text-sm text-gray-500">
                Projects you&apos;ve bought
              </p>
            </div>
            <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400 transition-colors group-hover:text-primary" />
          </Link>

          {session.user.isSeller && (
            <>
              <Link
                href="/seller/projects"
                className="group flex items-center gap-4 rounded-lg border bg-white p-4 shadow-sm transition-all hover:border-primary hover:shadow-md"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FolderOpen className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">My Projects</p>
                  <p className="truncate text-sm text-gray-500">
                    Projects you&apos;re selling
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400 transition-colors group-hover:text-primary" />
              </Link>

              <Link
                href="/seller/offers"
                className="group flex items-center gap-4 rounded-lg border bg-white p-4 shadow-sm transition-all hover:border-primary hover:shadow-md"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Inbox className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">Offers Received</p>
                  <p className="truncate text-sm text-gray-500">
                    Buyer offers on your projects
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400 transition-colors group-hover:text-primary" />
              </Link>

              <Link
                href="/seller/sales"
                className="group flex items-center gap-4 rounded-lg border bg-white p-4 shadow-sm transition-all hover:border-primary hover:shadow-md"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">My Sales</p>
                  <p className="truncate text-sm text-gray-500">
                    Completed project sales
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400 transition-colors group-hover:text-primary" />
              </Link>

              <Link
                href="/seller/analytics"
                className="group flex items-center gap-4 rounded-lg border bg-white p-4 shadow-sm transition-all hover:border-primary hover:shadow-md"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">Analytics</p>
                  <p className="truncate text-sm text-gray-500">
                    Sales and performance metrics
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400 transition-colors group-hover:text-primary" />
              </Link>

              <Link
                href="/projects/new"
                className="group flex items-center gap-4 rounded-lg border border-dashed bg-white p-4 shadow-sm transition-all hover:border-primary hover:shadow-md"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">List Project</p>
                  <p className="truncate text-sm text-gray-500">
                    Publish a new project for sale
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-400 transition-colors group-hover:text-primary" />
              </Link>
            </>
          )}
        </div>
      </div>

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
                ) : onboardingStatus?.detailsSubmitted ? (
                  <span className="text-blue-600">Under Review</span>
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
