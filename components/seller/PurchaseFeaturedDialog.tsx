/**
 * PurchaseFeaturedDialog Component
 *
 * Modal dialog for purchasing featured placement for a project.
 * Shows pricing options with Pro discount and handles payment flow.
 *
 * Features:
 * - Duration selection (7, 14, 30 days)
 * - Pricing display with Pro discount
 * - Success/error handling
 * - Loading states
 * - Automatic close on success
 *
 * @example
 * <PurchaseFeaturedDialog
 *   projectId="proj123"
 *   projectTitle="My Project"
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSuccess={() => refetchProject()}
 *   isPro={false}
 * />
 */

'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Star, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface PurchaseFeaturedDialogProps {
  projectId: string;
  projectTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isPro: boolean;
}

interface DurationOption {
  days: number;
  label: string;
  basePriceCents: number;
}

const DURATION_OPTIONS: DurationOption[] = [
  { days: 7, label: '1 Week', basePriceCents: 4900 }, // $49
  { days: 14, label: '2 Weeks', basePriceCents: 7900 }, // $79
  { days: 30, label: '1 Month', basePriceCents: 12900 }, // $129
];

const componentName = 'PurchaseFeaturedDialog';

export function PurchaseFeaturedDialog({
  projectId,
  projectTitle,
  isOpen,
  onClose,
  onSuccess,
  isPro,
}: PurchaseFeaturedDialogProps) {
  const [selectedDuration, setSelectedDuration] = React.useState<number>(7);
  const [isPurchasing, setIsPurchasing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setSelectedDuration(7);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  // Format price with Pro discount
  const formatPrice = (basePriceCents: number) => {
    const discountedCents = isPro
      ? Math.round(basePriceCents * 0.8) // 20% discount
      : basePriceCents;

    const priceString = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(discountedCents / 100);

    return {
      price: priceString,
      discountedCents,
      originalCents: basePriceCents,
      savings: basePriceCents - discountedCents,
    };
  };

  // Handle purchase
  const handlePurchase = async () => {
    console.log(`[${componentName}] Purchasing featured placement:`, {
      projectId,
      durationDays: selectedDuration,
    });

    setIsPurchasing(true);
    setError(null);

    try {
      const response = await fetch('/api/featured-listings/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          durationDays: selectedDuration,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to purchase featured placement');
      }

      const result = await response.json();
      console.log(`[${componentName}] Purchase successful:`, result);

      setSuccess(true);

      // Close dialog and trigger success callback after short delay
      setTimeout(() => {
        onClose();
        if (onSuccess) {
          onSuccess();
        }
      }, 2000);
    } catch (err) {
      console.error(`[${componentName}] Purchase error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to purchase');
    } finally {
      setIsPurchasing(false);
    }
  };

  const selectedOption = DURATION_OPTIONS.find((opt) => opt.days === selectedDuration);
  const priceInfo = selectedOption ? formatPrice(selectedOption.basePriceCents) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
            Feature Project
          </DialogTitle>
          <DialogDescription>
            Boost visibility for <strong>{projectTitle}</strong>
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-green-500" />
            <h3 className="mb-2 text-lg font-semibold">Featured Placement Activated!</h3>
            <p className="text-sm text-muted-foreground">
              Your project is now featured for {selectedDuration} days
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              {/* Pro Discount Banner */}
              {isPro && (
                <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-900 dark:text-blue-100">
                    Pro Discount Active: <strong>20% off</strong> all featured listings!
                  </AlertDescription>
                </Alert>
              )}

              {/* Duration Options */}
              <div>
                <label className="mb-2 block text-sm font-medium">Select Duration</label>
                <div className="grid gap-3">
                  {DURATION_OPTIONS.map((option) => {
                    const pricing = formatPrice(option.basePriceCents);
                    const isSelected = selectedDuration === option.days;

                    return (
                      <button
                        key={option.days}
                        type="button"
                        onClick={() => setSelectedDuration(option.days)}
                        className={`flex items-center justify-between rounded-lg border-2 p-4 text-left transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div>
                          <p className="font-semibold">{option.label}</p>
                          <p className="text-sm text-muted-foreground">{option.days} days</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{pricing.price}</p>
                          {isPro && (
                            <p className="text-xs text-muted-foreground line-through">
                              {formatPrice(option.basePriceCents).price}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Benefits */}
              <div className="rounded-lg bg-muted p-4">
                <p className="mb-2 font-medium">What you get:</p>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span>Featured badge on project card</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span>Priority placement in search results</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span>Increased visibility for {selectedDuration} days</span>
                  </li>
                </ul>
              </div>

              {/* Error */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={isPurchasing}>
                Cancel
              </Button>
              <Button onClick={handlePurchase} disabled={isPurchasing}>
                {isPurchasing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Purchase {priceInfo?.price}
                    {isPro && priceInfo && priceInfo.savings > 0 && (
                      <Badge variant="secondary" className="ml-2 bg-green-100 text-green-900">
                        Save ${(priceInfo.savings / 100).toFixed(0)}
                      </Badge>
                    )}
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
