/**
 * Seller Onboarding Page
 *
 * Stripe Connect onboarding flow for sellers.
 * Allows sellers to create Stripe Express account to receive payouts.
 *
 * Features:
 * - Check onboarding status
 * - Start onboarding process
 * - Handle return from Stripe
 * - Show onboarding completion
 *
 * @example
 * /seller/onboard
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  CreditCard,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';

const componentName = 'SellerOnboardPage';

interface OnboardingStatus {
  isOnboarded: boolean;
  accountId: string | null;
  needsOnboarding: boolean;
}

export default function SellerOnboardPage() {
  console.log(`[${componentName}] Page rendered`);

  const router = useRouter();
  const { data: _session, status: sessionStatus } = useSession();

  const [status, setStatus] = React.useState<OnboardingStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isStartingOnboarding, setIsStartingOnboarding] = React.useState(false);

  /**
   * Fetch onboarding status
   */
  const fetchStatus = React.useCallback(async () => {
    console.log(`[${componentName}] Fetching onboarding status`);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stripe/connect/status');

      if (!response.ok) {
        throw new Error('Failed to fetch onboarding status');
      }

      const data = await response.json();
      console.log(`[${componentName}] Status:`, data);

      setStatus(data);
    } catch (err) {
      console.error(`[${componentName}] Fetch error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch status when session is ready
   */
  React.useEffect(() => {
    if (sessionStatus === 'authenticated') {
      fetchStatus();
    } else if (sessionStatus === 'unauthenticated') {
      setIsLoading(false);
      setError('You must be signed in to access this page');
    }
  }, [sessionStatus, fetchStatus]);

  /**
   * Start Stripe Connect onboarding
   */
  const handleStartOnboarding = async () => {
    console.log(`[${componentName}] Starting onboarding`);
    setIsStartingOnboarding(true);
    setError(null);

    try {
      const response = await fetch('/api/stripe/connect/onboard', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to start onboarding');
      }

      const data = await response.json();
      console.log(`[${componentName}] Onboarding URL:`, data.url);

      // Redirect to Stripe onboarding
      window.location.href = data.url;
    } catch (err) {
      console.error(`[${componentName}] Onboarding error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to start onboarding');
      setIsStartingOnboarding(false);
    }
  };

  /**
   * Go to seller dashboard
   */
  const handleGoToDashboard = () => {
    router.push('/seller/dashboard');
  };

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">Become a Seller</h1>
          <p className="mt-2 text-muted-foreground">
            Set up your seller account to start listing projects
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {/* Onboarding Complete */}
        {!isLoading && status?.isOnboarded && (
          <Card className="border-green-500">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
                <CardTitle>You're all set!</CardTitle>
              </div>
              <CardDescription>
                Your seller account is active and ready to receive payouts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                <span>Stripe account verified</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4 text-green-500" />
                <span>Ready to receive payments</span>
              </div>

              <Button onClick={handleGoToDashboard} className="w-full">
                Go to Seller Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Needs Onboarding */}
        {!isLoading && status?.needsOnboarding && (
          <>
            {/* Benefits */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CreditCard className="h-8 w-8 text-primary" />
                  <CardTitle className="text-lg">Get Paid Securely</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Receive payments directly to your bank account via Stripe Connect
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <TrendingUp className="h-8 w-8 text-primary" />
                  <CardTitle className="text-lg">Earn 85% Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Keep 85% of every sale after platform fees and payment processing
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <ShieldCheck className="h-8 w-8 text-primary" />
                  <CardTitle className="text-lg">Safe & Compliant</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Stripe handles all compliance, taxes, and fraud prevention for you
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Onboarding Card */}
            <Card>
              <CardHeader>
                <CardTitle>Set Up Your Seller Account</CardTitle>
                <CardDescription>
                  Connect your bank account to receive payouts. This takes about 5
                  minutes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-semibold">What you'll need:</h3>
                  <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    <li>Bank account details for payouts</li>
                    <li>Government-issued ID (for verification)</li>
                    <li>Business or personal tax information</li>
                    <li>Address verification</li>
                  </ul>
                </div>

                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm">
                    <strong>Platform Fee:</strong> We charge a 15% platform fee on all
                    sales. You'll receive 85% of the project price after Stripe payment
                    processing fees (2.9% + $0.30).
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Example: $1,000 project = $820.70 payout to you
                  </p>
                </div>

                <Button
                  onClick={handleStartOnboarding}
                  disabled={isStartingOnboarding}
                  className="w-full"
                  size="lg"
                >
                  {isStartingOnboarding ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redirecting to Stripe...
                    </>
                  ) : (
                    <>
                      Start Onboarding
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Powered by{' '}
                  <a
                    href="https://stripe.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Stripe Connect
                  </a>
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
