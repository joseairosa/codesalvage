/**
 * Checkout Page
 *
 * Stripe checkout flow for purchasing a project.
 * Integrates Stripe Elements for payment processing.
 *
 * Features:
 * - Display project and price info
 * - Create Payment Intent
 * - Stripe Elements payment form
 * - Handle payment success/failure
 * - Redirect to success page
 *
 * @example
 * /checkout/project123
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Loader2, AlertCircle, ShieldCheck, Lock } from 'lucide-react';
import { env } from '@/config/env';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';

const componentName = 'CheckoutPage';

// Initialize Stripe
const stripePromise = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

interface Project {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  completionPercentage: number;
  thumbnailImageUrl: string | null;
  seller: {
    id: string;
    username: string | null;
    fullName: string | null;
  };
}

interface PaymentBreakdown {
  total: number;
  platformFee: number;
  stripeFee: number;
  sellerReceives: number;
}

export default function CheckoutPage({ params }: { params: { projectId: string } }) {
  console.log(`[${componentName}] Page rendered for project:`, params.projectId);

  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [project, setProject] = React.useState<Project | null>(null);
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const [transactionId, setTransactionId] = React.useState<string | null>(null);
  const [breakdown, setBreakdown] = React.useState<PaymentBreakdown | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Fetch project and create payment intent
   */
  React.useEffect(() => {
    async function initialize() {
      if (sessionStatus === 'unauthenticated') {
        router.push(`/auth/signin?callbackUrl=/checkout/${params.projectId}`);
        return;
      }

      if (sessionStatus !== 'authenticated') {
        return;
      }

      console.log(`[${componentName}] Initializing checkout`);
      setIsLoading(true);
      setError(null);

      try {
        // Fetch project details
        const projectResponse = await fetch(`/api/projects/${params.projectId}`);
        if (!projectResponse.ok) {
          throw new Error('Project not found');
        }

        const projectData = await projectResponse.json();
        setProject(projectData);

        console.log(`[${componentName}] Project loaded:`, projectData.title);

        // Create payment intent
        const intentResponse = await fetch('/api/checkout/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: params.projectId }),
        });

        if (!intentResponse.ok) {
          const errorData = await intentResponse.json();
          throw new Error(errorData.error || 'Failed to create payment intent');
        }

        const intentData = await intentResponse.json();
        setClientSecret(intentData.clientSecret);
        setTransactionId(intentData.transactionId);
        setBreakdown(intentData.breakdown);

        console.log(`[${componentName}] Payment intent created`);
      } catch (err) {
        console.error(`[${componentName}] Initialization error:`, err);
        setError(err instanceof Error ? err.message : 'Failed to initialize checkout');
      } finally {
        setIsLoading(false);
      }
    }

    initialize();
  }, [params.projectId, sessionStatus, router]);

  /**
   * Format price in cents to USD
   */
  const formatPrice = (cents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(cents / 100);
  };

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">Checkout</h1>
          <p className="mt-2 text-muted-foreground">Complete your purchase securely</p>
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

        {/* Checkout Content */}
        {!isLoading && !error && project && clientSecret && breakdown && (
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Project Info */}
                  {project.thumbnailImageUrl && (
                    <img
                      src={project.thumbnailImageUrl}
                      alt={project.title}
                      className="aspect-video w-full rounded-lg object-cover"
                    />
                  )}

                  <div>
                    <h3 className="font-semibold">{project.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {project.completionPercentage}% complete
                    </p>
                  </div>

                  <Separator />

                  {/* Price Breakdown */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Project Price</span>
                      <span className="font-medium">{formatPrice(breakdown.total)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Platform Fee (15%)</span>
                      <span>{formatPrice(breakdown.platformFee)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Payment Processing</span>
                      <span>{formatPrice(breakdown.stripeFee)}</span>
                    </div>

                    <Separator />

                    <div className="flex justify-between text-base font-bold">
                      <span>Total</span>
                      <span>{formatPrice(breakdown.total)}</span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Seller receives {formatPrice(breakdown.sellerReceives)}
                    </p>
                  </div>

                  <Separator />

                  {/* Security Info */}
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Lock className="h-3 w-3" />
                      <span>Secure payment via Stripe</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-3 w-3" />
                      <span>7-day money-back guarantee</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Payment Form */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Payment Information</CardTitle>
                  <CardDescription>
                    Enter your payment details to complete the purchase
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {stripePromise && (
                    <Elements
                      stripe={stripePromise}
                      options={{
                        clientSecret,
                        appearance: {
                          theme: 'stripe',
                          variables: {
                            colorPrimary: '#0070f3',
                          },
                        },
                      }}
                    >
                      <CheckoutForm
                        projectId={params.projectId}
                        transactionId={transactionId!}
                        amount={breakdown.total}
                      />
                    </Elements>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
