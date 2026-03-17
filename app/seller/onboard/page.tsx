/**
 * Seller Onboarding Page
 *
 * In-house onboarding flow for sellers.
 * Collects PayPal email as payout method and accepts seller terms.
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/hooks/useSession';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  payoutMethod: string | null;
  payoutEmail: string | null;
}

export default function SellerOnboardPage() {
  console.log(`[${componentName}] Page rendered`);

  const router = useRouter();
  const { data: _session, status: sessionStatus } = useSession();

  const [status, setStatus] = React.useState<OnboardingStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [payoutEmail, setPayoutEmail] = React.useState('');
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);

  const fetchStatus = React.useCallback(async () => {
    console.log(`[${componentName}] Fetching onboarding status`);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/seller/onboard/status');
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

  React.useEffect(() => {
    if (sessionStatus === 'authenticated') {
      fetchStatus();
    } else if (sessionStatus === 'unauthenticated') {
      setIsLoading(false);
      setError('You must be signed in to access this page');
    }
  }, [sessionStatus, fetchStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log(`[${componentName}] Submitting onboarding`);
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/seller/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payoutMethod: 'paypal',
          payoutEmail,
          acceptedTerms,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || 'Failed to complete onboarding');
      }

      console.log(`[${componentName}] Onboarding complete`);
      setStatus({ isOnboarded: true, payoutMethod: 'paypal', payoutEmail });
    } catch (err) {
      console.error(`[${componentName}] Submit error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding');
    } finally {
      setIsSubmitting(false);
    }
  };

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
            Set up your payout details to start listing projects
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
                <CardTitle>You&apos;re all set!</CardTitle>
              </div>
              <CardDescription>
                Your seller account is active and ready to receive payouts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-green-500" />
                <span>Payout details verified</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CreditCard className="h-4 w-4 text-green-500" />
                <span>PayPal: {status.payoutEmail}</span>
              </div>

              <Button onClick={handleGoToDashboard} className="w-full">
                Go to Seller Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Needs Onboarding */}
        {!isLoading && status && !status.isOnboarded && (
          <>
            {/* Benefits */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CreditCard className="h-8 w-8 text-primary" />
                  <CardTitle className="text-lg">Get Paid via PayPal</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Receive payouts directly to your PayPal account every week
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
                  <CardTitle className="text-lg">Safe & Secure</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    7-day escrow protection on all transactions for buyer and seller safety
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Onboarding Form */}
            <Card>
              <CardHeader>
                <CardTitle>Set Up Your Payout Details</CardTitle>
                <CardDescription>
                  Enter your PayPal email to receive payouts. This takes less than a minute.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="payoutEmail">PayPal Email</Label>
                    <Input
                      id="payoutEmail"
                      type="email"
                      placeholder="your-email@paypal.com"
                      value={payoutEmail}
                      onChange={(e) => setPayoutEmail(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      This is the email address associated with your PayPal account
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-sm">
                      <strong>Seller Terms:</strong>
                    </p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                      <li>15% platform fee on all sales</li>
                      <li>7-day escrow hold on payments</li>
                      <li>Weekly payouts every Friday via PayPal</li>
                      <li>You keep 85% of each sale after fees</li>
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Example: $1,000 project = ~$820 payout to you
                    </p>
                  </div>

                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="terms"
                      checked={acceptedTerms}
                      onCheckedChange={(checked) =>
                        setAcceptedTerms(checked === true)
                      }
                    />
                    <Label
                      htmlFor="terms"
                      className="text-sm font-normal leading-snug"
                    >
                      I accept the seller terms including the 15% platform fee,
                      7-day escrow period, and weekly PayPal payouts
                    </Label>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting || !payoutEmail || !acceptedTerms}
                    className="w-full"
                    size="lg"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Setting up...
                      </>
                    ) : (
                      <>
                        Complete Setup
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
