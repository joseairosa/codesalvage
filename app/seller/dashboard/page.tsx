/**
 * Seller Dashboard Page (Protected Route - Seller Only)
 *
 * Requires authentication AND seller status.
 * Redirects to:
 * - Sign-in if not authenticated
 * - Home if authenticated but not a seller
 *
 * Displays comprehensive analytics dashboard with:
 * - Revenue tracking and charts
 * - Engagement metrics (views, favorites, sales)
 * - Top performing projects
 * - Export to CSV functionality
 */

import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AnalyticsDashboard } from '@/components/seller/AnalyticsDashboard';
import { Plus } from 'lucide-react';
import { OnboardingChecklist } from '@/components/onboarding/OnboardingChecklist';
import type { OnboardingStep } from '@/components/onboarding/OnboardingChecklist';

export default async function SellerDashboardPage() {
  const session = await requireAuth();

  // Redirect to home if not a seller
  if (!session.user.isSeller) {
    redirect('/?error=seller-only');
  }

  const [projectCount, user, sentMessageCount] = await Promise.all([
    prisma.project.count({ where: { sellerId: session.user.id } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        bio: true,
        onboardingDismissedAt: true,
        sellerPayoutDetails: {
          select: { isActive: true },
        },
      },
    }),
    prisma.message.count({ where: { senderId: session.user.id } }),
  ]);

  const hasPayoutSetup = user?.sellerPayoutDetails?.isActive === true;
  const profileDone = Boolean(user?.bio && user.bio.trim().length > 0);

  const onboardingSteps: OnboardingStep[] = [
    {
      id: 'profile',
      label: 'Complete your profile',
      description: 'Add a bio so buyers know who you are.',
      done: profileDone,
      href: '/settings',
    },
    {
      id: 'payout',
      label: 'Set up payout details',
      description: 'Required before buyers can purchase your projects.',
      done: hasPayoutSetup,
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
  ];

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Seller Dashboard</h1>
          <p className="text-gray-600">Manage your projects and track performance</p>
        </div>

        <Button asChild>
          <Link href="/projects/new">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      <OnboardingChecklist
        steps={onboardingSteps}
        dismissed={
          user?.onboardingDismissedAt !== null &&
          user?.onboardingDismissedAt !== undefined
        }
      />

      <AnalyticsDashboard />
    </div>
  );
}
