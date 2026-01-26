/**
 * Checkout Form Component
 *
 * Stripe Elements payment form.
 * Handles payment submission and confirmation.
 *
 * Features:
 * - Stripe Payment Element (card, wallet, etc.)
 * - Form validation
 * - Payment submission
 * - Success/failure handling
 * - Redirect to success page
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';
import { env } from '@/config/env';

const componentName = 'CheckoutForm';

interface CheckoutFormProps {
  projectId: string;
  transactionId: string;
  amount: number;
}

export function CheckoutForm({ projectId, transactionId, amount }: CheckoutFormProps) {
  console.log(`[${componentName}] Form rendered`);

  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Handle payment submission
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      console.log(`[${componentName}] Stripe not loaded yet`);
      return;
    }

    console.log(`[${componentName}] Processing payment`);
    setIsProcessing(true);
    setError(null);

    try {
      // Confirm payment
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${env.NEXT_PUBLIC_APP_URL}/checkout/success?transactionId=${transactionId}`,
        },
      });

      if (confirmError) {
        console.error(`[${componentName}] Payment failed:`, confirmError);
        setError(confirmError.message || 'Payment failed. Please try again.');
        setIsProcessing(false);
      } else {
        // Payment succeeded, redirect happens automatically
        console.log(`[${componentName}] Payment succeeded`);
      }
    } catch (err) {
      console.error(`[${componentName}] Error:`, err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Payment Element */}
      <PaymentElement />

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing Payment...
          </>
        ) : (
          `Pay ${new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
          }).format(amount / 100)}`
        )}
      </Button>

      {/* Security Notice */}
      <p className="text-center text-xs text-muted-foreground">
        Your payment information is encrypted and secure. We never store your card details.
      </p>
    </form>
  );
}
