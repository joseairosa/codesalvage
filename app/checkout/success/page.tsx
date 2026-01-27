/**
 * Checkout Success Page
 *
 * Displayed after successful payment.
 * Shows order confirmation and next steps.
 *
 * Features:
 * - Payment confirmation
 * - Order details
 * - Download/access instructions
 * - Link to transaction details
 *
 * @example
 * /checkout/success?transactionId=trans_123&payment_intent=pi_123
 */

'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Download,
  FileCode,
  ArrowRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';

const componentName = 'CheckoutSuccessPage';

interface Transaction {
  id: string;
  amountCents: number;
  paymentStatus: string;
  escrowStatus: string;
  escrowReleaseDate: Date;
  project: {
    id: string;
    title: string;
    description: string;
    completionPercentage: number;
    seller: {
      id: string;
      username: string | null;
      fullName: string | null;
    };
  };
}

export default function CheckoutSuccessPage() {
  console.log(`[${componentName}] Page rendered`);

  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: _session, status: sessionStatus } = useSession();

  const transactionId = searchParams.get('transactionId');

  const [transaction, setTransaction] = React.useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Fetch transaction details
   */
  React.useEffect(() => {
    async function fetchTransaction() {
      if (sessionStatus === 'unauthenticated') {
        router.push('/auth/signin');
        return;
      }

      if (sessionStatus !== 'authenticated' || !transactionId) {
        return;
      }

      console.log(`[${componentName}] Fetching transaction:`, transactionId);
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/transactions/${transactionId}`);

        if (!response.ok) {
          throw new Error('Transaction not found');
        }

        const data = await response.json();
        setTransaction(data);

        console.log(`[${componentName}] Transaction loaded`);
      } catch (err) {
        console.error(`[${componentName}] Fetch error:`, err);
        setError(err instanceof Error ? err.message : 'Failed to load transaction');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTransaction();
  }, [transactionId, sessionStatus, router]);

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

  /**
   * Format date
   */
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
  };

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <div className="space-y-8">
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

        {/* Success Content */}
        {!isLoading && !error && transaction && (
          <>
            {/* Success Header */}
            <Card className="border-green-500">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500">
                  <CheckCircle2 className="h-10 w-10 text-white" />
                </div>
                <CardTitle className="text-2xl">Payment Successful!</CardTitle>
                <CardDescription>
                  Your purchase has been completed and is now in escrow
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Order Details */}
            <Card>
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Project Info */}
                <div>
                  <h3 className="font-semibold">{transaction.project.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {transaction.project.completionPercentage}% complete
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Amount Paid</p>
                    <p className="font-semibold">
                      {formatPrice(transaction.amountCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Transaction ID</p>
                    <p className="font-mono text-sm">{transaction.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Status</p>
                    <p className="font-semibold capitalize">
                      {transaction.paymentStatus}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Escrow Release</p>
                    <p className="font-semibold">
                      {formatDate(transaction.escrowReleaseDate)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Next Steps */}
            <Card>
              <CardHeader>
                <CardTitle>What Happens Next?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold">Code Access</h4>
                    <p className="text-sm text-muted-foreground">
                      You now have immediate access to download the project code and
                      repository.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold">7-Day Review Period</h4>
                    <p className="text-sm text-muted-foreground">
                      Your payment is held in escrow until{' '}
                      {formatDate(transaction.escrowReleaseDate)}. If you're not
                      satisfied, request a refund within this period.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold">Funds Released</h4>
                    <p className="text-sm text-muted-foreground">
                      After the review period, funds are automatically released to the
                      seller.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={() =>
                  router.push(`/projects/${transaction.project.id}/download`)
                }
                className="flex-1"
                size="lg"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Code
              </Button>
              <Button
                onClick={() => router.push('/buyer/purchases')}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                View All Purchases
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Support Info */}
            <Alert>
              <FileCode className="h-4 w-4" />
              <AlertDescription>
                Need help? Contact the seller via the messaging system or reach out to our
                support team.
              </AlertDescription>
            </Alert>
          </>
        )}
      </div>
    </div>
  );
}
