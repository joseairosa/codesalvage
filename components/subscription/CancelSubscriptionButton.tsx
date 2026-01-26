/**
 * Cancel Subscription Button (Client Component)
 *
 * Allows Pro subscribers to cancel their subscription.
 * Subscription continues until end of billing period.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';

export function CancelSubscriptionButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch('/api/subscriptions', {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      // Refresh page to show updated status
      window.location.reload();
    } catch (err) {
      console.error('Cancel error:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="text-red-600 hover:bg-red-50">
            Cancel Subscription
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Pro Subscription?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Your subscription will be canceled at the end of your current billing period. You'll
                continue to have access to Pro features until then.
              </p>
              <p className="font-semibold">You'll lose access to:</p>
              <ul className="list-inside list-disc space-y-1 pl-4">
                <li>Unlimited project listings (limited to 3)</li>
                <li>Advanced analytics dashboard</li>
                <li>20% featured listing discount</li>
                <li>Verified seller badge</li>
              </ul>
              <p className="mt-4">You can resubscribe at any time.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Pro</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Canceling...
                </>
              ) : (
                'Cancel Subscription'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
