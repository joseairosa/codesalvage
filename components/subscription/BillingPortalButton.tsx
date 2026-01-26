/**
 * Billing Portal Button (Client Component)
 *
 * Opens Stripe Customer Portal for managing billing and invoices.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink } from 'lucide-react';

export function BillingPortalButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenPortal = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch('/api/subscriptions/portal', {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to open billing portal');
      }

      const { url } = await res.json();

      // Redirect to Stripe portal
      window.location.href = url;
    } catch (err) {
      console.error('Billing portal error:', err);
      setError(err instanceof Error ? err.message : 'Failed to open billing portal');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button onClick={handleOpenPortal} disabled={isLoading} variant="outline">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            Manage Billing
            <ExternalLink className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
