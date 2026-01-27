/**
 * Upgrade to Pro Button (Client Component)
 *
 * Initiates Pro subscription upgrade flow with Stripe Checkout.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY']!);

export function UpgradeToProButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpgrade = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Create subscription via API
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'pro',
          // paymentMethodId will be collected via Stripe Checkout
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create subscription');
      }

      const { subscription } = await res.json();

      // If we have a clientSecret, redirect to Stripe Checkout
      if (subscription.clientSecret) {
        const stripe = await stripePromise;
        if (!stripe) {
          throw new Error('Stripe failed to load');
        }

        // Redirect to Stripe Checkout
        const { error: stripeError } = await stripe.confirmCardPayment(
          subscription.clientSecret
        );

        if (stripeError) {
          throw new Error(stripeError.message || 'Payment failed');
        }

        // Refresh page to show updated subscription status
        window.location.reload();
      } else {
        // Subscription created successfully without payment (free trial or existing payment method)
        window.location.reload();
      }
    } catch (err) {
      console.error('Upgrade error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upgrade');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleUpgrade}
        disabled={isLoading}
        className="bg-blue-600 hover:bg-blue-700"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          'Upgrade to Pro - $9.99/month'
        )}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
