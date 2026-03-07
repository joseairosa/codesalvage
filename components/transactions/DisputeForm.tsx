'use client';

/**
 * DisputeForm Component
 *
 * Allows a buyer to open a dispute during the 7-day review window.
 * Shown inside ReviewPeriodCard when escrowStatus === 'held' and
 * the release date has not passed.
 */

import * as React from 'react';
import { AlertTriangle, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const DISPUTE_REASONS: Record<string, string> = {
  description_mismatch: "Project doesn't match description",
  code_not_functional: 'Code is not functional as described',
  missing_features: 'Features promised in listing are missing',
  access_issues: 'Cannot access the code / repository',
  other: 'Other reason',
};

interface DisputeFormProps {
  transactionId: string;
  onDisputeOpened: () => void;
}

export function DisputeForm({ transactionId, onDisputeOpened }: DisputeFormProps) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(`/api/transactions/${transactionId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, description }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to open dispute');
      }

      setSubmitted(true);
      setOpen(false);
      onDisputeOpened();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open dispute');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Dispute filed. Our team will review and respond within 2–3 business days.
      </div>
    );
  }

  const isValid = reason && description.trim().length >= 20;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <AlertTriangle className="mr-2 h-4 w-4" />
          Open Dispute
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Open a Dispute</AlertDialogTitle>
          <AlertDialogDescription>
            Disputes pause the escrow release. Our team reviews both sides within 2–3
            business days. Only file a dispute if the project significantly differs from
            its description.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="dispute-reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="dispute-reason">
                <SelectValue placeholder="Select a reason…" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DISPUTE_REASONS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dispute-description">
              Description{' '}
              <span className="text-xs text-muted-foreground">(min 20 characters)</span>
            </Label>
            <Textarea
              id="dispute-description"
              placeholder="Describe the issue in detail. Include specific discrepancies between the listing description and what you received."
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {description.trim().length} / 20 characters minimum
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit Dispute'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
