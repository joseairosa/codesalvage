/**
 * MakeOfferDialog
 *
 * Modal dialog for buyers to submit a price offer on a project.
 * Displays listing price, validates against minimum offer, and
 * shows savings percentage in real-time.
 *
 * @example
 * <MakeOfferDialog
 *   isOpen={open}
 *   onClose={() => setOpen(false)}
 *   projectId="abc123"
 *   projectTitle="My Project"
 *   priceCents={100000}
 *   minimumOfferCents={50000}
 *   onSuccess={() => toast('Offer sent!')}
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Loader2, AlertCircle, CheckCircle2, Tag } from 'lucide-react';
import { MINIMUM_OFFER_CENTS } from '@/lib/validations/offer';

const componentName = 'MakeOfferDialog';

interface MakeOfferDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  priceCents: number;
  minimumOfferCents: number | null;
  onSuccess?: () => void;
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatPriceDetailed(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function MakeOfferDialog({
  isOpen,
  onClose,
  projectId,
  projectTitle,
  priceCents,
  minimumOfferCents,
  onSuccess,
}: MakeOfferDialogProps) {
  const [displayValue, setDisplayValue] = React.useState('');
  const [offerCents, setOfferCents] = React.useState(0);
  const [message, setMessage] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [status, setStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = React.useState('');

  // Effective minimum: project-level or global floor
  const effectiveMinimum = minimumOfferCents ?? MINIMUM_OFFER_CENTS;

  // Reset form when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setDisplayValue('');
      setOfferCents(0);
      setMessage('');
      setStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setDisplayValue(input);

    const cleaned = input.replace(/[^\d.]/g, '');
    const dollars = parseFloat(cleaned) || 0;
    const cents = Math.round(dollars * 100);
    setOfferCents(cents);
  };

  const handlePriceBlur = () => {
    if (offerCents > 0) {
      setDisplayValue((offerCents / 100).toFixed(2));
    }
  };

  // Validation
  const getValidationError = (): string | null => {
    if (offerCents <= 0) return null; // Don't validate empty
    if (offerCents < effectiveMinimum) {
      return `Minimum offer is ${formatPriceDetailed(effectiveMinimum)}`;
    }
    if (offerCents >= priceCents) {
      return 'Offer must be less than the listing price. Use Buy Now instead.';
    }
    return null;
  };

  const validationError = getValidationError();
  const savingsPercent =
    offerCents > 0 && offerCents < priceCents
      ? Math.round(((priceCents - offerCents) / priceCents) * 100)
      : 0;
  const isValid = offerCents >= effectiveMinimum && offerCents < priceCents;

  const handleSubmit = async () => {
    if (!isValid) return;

    console.log(`[${componentName}] Submitting offer:`, {
      projectId,
      offeredPriceCents: offerCents,
    });

    setIsSubmitting(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      const body: { projectId: string; offeredPriceCents: number; message?: string } = {
        projectId,
        offeredPriceCents: offerCents,
      };
      if (message.trim()) {
        body.message = message.trim();
      }

      const response = await fetch('/api/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit offer');
      }

      console.log(`[${componentName}] Offer submitted successfully`);
      setStatus('success');

      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (err) {
      console.error(`[${componentName}] Submit error:`, err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to submit offer');
      setStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Make an Offer
          </DialogTitle>
          <DialogDescription>
            Propose your price for &ldquo;{projectTitle}&rdquo;
          </DialogDescription>
        </DialogHeader>

        {/* Success State */}
        {status === 'success' && (
          <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Offer sent! The seller will be notified.
            </AlertDescription>
          </Alert>
        )}

        {/* Error State */}
        {status === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {status !== 'success' && (
          <>
            {/* Listing Info */}
            <div className="rounded-md bg-muted px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Listed Price</span>
                <span className="font-semibold">{formatPrice(priceCents)}</span>
              </div>
              {minimumOfferCents && (
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Minimum Offer</span>
                  <span className="font-medium">{formatPrice(minimumOfferCents)}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Price Input */}
            <div className="space-y-2">
              <Label htmlFor="offer-price">Your Offer</Label>
              <div className="relative">
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </div>
                <Input
                  id="offer-price"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={displayValue}
                  onChange={handlePriceChange}
                  onBlur={handlePriceBlur}
                  disabled={isSubmitting}
                  className={`pl-7 ${validationError ? 'border-destructive' : ''}`}
                  autoFocus
                />
              </div>
              {validationError && (
                <p className="text-xs text-destructive">{validationError}</p>
              )}
              {isValid && savingsPercent > 0 && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  {savingsPercent}% off listing price — you save{' '}
                  {formatPriceDetailed(priceCents - offerCents)}
                </p>
              )}
            </div>

            {/* Optional Message */}
            <div className="space-y-2">
              <Label htmlFor="offer-message">
                Message to Seller{' '}
                <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="offer-message"
                placeholder="Tell the seller why you're interested..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isSubmitting}
                maxLength={500}
                rows={3}
              />
              <p className="text-right text-xs text-muted-foreground">
                {message.length}/500
              </p>
            </div>

            {/* Info */}
            <p className="text-xs text-muted-foreground">
              Your offer will expire in 7 days if the seller doesn&apos;t respond.
              The seller can accept, reject, or counter your offer.
            </p>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {status === 'success' ? 'Close' : 'Cancel'}
          </Button>
          {status !== 'success' && (
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Offer'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
