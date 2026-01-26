/**
 * Subscription Management Page (Protected Route - Seller Only)
 *
 * Allows sellers to:
 * - View current subscription status
 * - Upgrade to Pro plan
 * - Cancel subscription
 * - Access billing portal
 *
 * Route: /seller/subscription
 */

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { Check, AlertCircle } from 'lucide-react';
import { UpgradeToProButton } from '@/components/subscription/UpgradeToProButton';
import { CancelSubscriptionButton } from '@/components/subscription/CancelSubscriptionButton';
import { BillingPortalButton } from '@/components/subscription/BillingPortalButton';
import { SubscriptionService } from '@/lib/services/SubscriptionService';
import { SubscriptionRepository } from '@/lib/repositories/SubscriptionRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { prisma } from '@/lib/prisma';

async function getSubscriptionStatus(userId: string) {
  try {
    const subscriptionRepository = new SubscriptionRepository(prisma);
    const userRepository = new UserRepository(prisma);
    const subscriptionService = new SubscriptionService(subscriptionRepository, userRepository);

    const status = await subscriptionService.getSubscriptionStatus(userId);
    return status;
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return null;
  }
}

export default async function SubscriptionManagementPage() {
  const session = await auth();

  // Redirect to sign-in if not authenticated
  if (!session?.user) {
    redirect('/auth/signin');
  }

  // Redirect to home if not a seller
  if (!session.user.isSeller) {
    redirect('/?error=seller-only');
  }

  const subscription = await getSubscriptionStatus(session.user.id);
  const isPro = subscription?.plan === 'pro' && subscription?.status === 'active';
  const isCanceling = subscription?.cancelAtPeriodEnd;

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Subscription Management</h1>
        <p className="text-gray-600">Manage your ProjectFinish subscription and billing</p>
      </div>

      {/* Current Plan Status */}
      <div className="mb-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-3">
                  Current Plan:
                  {isPro ? (
                    <Badge className="bg-blue-600 text-lg">Pro</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-lg">
                      Free
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="mt-2">
                  {isPro
                    ? 'You have access to all Pro features'
                    : 'Upgrade to Pro for unlimited projects and advanced features'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Subscription Details */}
            {isPro && subscription && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="text-lg font-semibold capitalize">{subscription.status}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Next Billing Date</p>
                  <p className="text-lg font-semibold">
                    {subscription.currentPeriodEnd
                      ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
              </div>
            )}

            {/* Cancellation Notice */}
            {isCanceling && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your subscription will be canceled on{' '}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}. You'll continue to
                  have Pro access until then.
                </AlertDescription>
              </Alert>
            )}

            {/* Current Benefits */}
            <div>
              <h3 className="mb-3 font-semibold">Current Benefits:</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-start gap-2">
                  <Check
                    className={`mt-1 h-5 w-5 flex-shrink-0 ${isPro ? 'text-blue-600' : 'text-gray-400'}`}
                  />
                  <span className={!isPro ? 'text-gray-600' : ''}>
                    {isPro ? 'Unlimited' : 'Up to 3'} active project listings
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Check
                    className={`mt-1 h-5 w-5 flex-shrink-0 ${isPro ? 'text-blue-600' : 'text-blue-600'}`}
                  />
                  <span>Basic project analytics</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check
                    className={`mt-1 h-5 w-5 flex-shrink-0 ${isPro ? 'text-blue-600' : 'text-gray-400'}`}
                  />
                  <span className={!isPro ? 'text-gray-600' : ''}>
                    {isPro ? 'Advanced' : 'No'} analytics dashboard
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Check
                    className={`mt-1 h-5 w-5 flex-shrink-0 ${isPro ? 'text-blue-600' : 'text-gray-400'}`}
                  />
                  <span className={!isPro ? 'text-gray-600' : ''}>
                    {isPro ? '20%' : 'No'} featured listing discount
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Check
                    className={`mt-1 h-5 w-5 flex-shrink-0 ${isPro ? 'text-blue-600' : 'text-gray-400'}`}
                  />
                  <span className={!isPro ? 'text-gray-600' : ''}>
                    {isPro ? 'Verified' : 'No'} seller badge
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="mt-1 h-5 w-5 flex-shrink-0 text-blue-600" />
                  <span>Messaging with buyers</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 border-t pt-6">
              {!isPro ? (
                <>
                  <UpgradeToProButton />
                  <Button asChild variant="outline">
                    <Link href="/pricing">View Pricing Details</Link>
                  </Button>
                </>
              ) : (
                <>
                  {!isCanceling && <CancelSubscriptionButton />}
                  <BillingPortalButton />
                  <Button asChild variant="outline">
                    <Link href="/seller/dashboard">Back to Dashboard</Link>
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Comparison */}
      {!isPro && (
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Why Upgrade to Pro?</CardTitle>
              <CardDescription>
                Unlock more features and save money on featured listings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg border p-4">
                  <div className="rounded-full bg-blue-100 p-2">
                    <Check className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Unlimited Projects</h4>
                    <p className="text-sm text-gray-600">
                      Create as many project listings as you want without restrictions
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border p-4">
                  <div className="rounded-full bg-blue-100 p-2">
                    <Check className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold">20% Featured Listing Discount</h4>
                    <p className="text-sm text-gray-600">
                      Save up to $16 per featured placement. Feature 2 projects/month and Pro pays for
                      itself!
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border p-4">
                  <div className="rounded-full bg-blue-100 p-2">
                    <Check className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Advanced Analytics</h4>
                    <p className="text-sm text-gray-600">
                      Track revenue, views, and sales trends with detailed analytics dashboard
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg border p-4">
                  <div className="rounded-full bg-blue-100 p-2">
                    <Check className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Verified Seller Badge</h4>
                    <p className="text-sm text-gray-600">
                      Stand out with a verified badge that builds trust with buyers
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-lg bg-blue-50 p-4">
                <p className="text-center text-sm font-semibold text-blue-900">
                  Only $9.99/month • Cancel anytime • No hidden fees
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Billing History */}
      {isPro && (
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Billing & Invoices</CardTitle>
              <CardDescription>
                Access your billing history and download invoices through Stripe
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-gray-600">
                View past invoices, update payment methods, and manage your billing information through
                our secure billing portal powered by Stripe.
              </p>
              <BillingPortalButton />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
