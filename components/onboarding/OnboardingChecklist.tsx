'use client';

/**
 * OnboardingChecklist
 *
 * A dismissible checklist shown on the dashboard for new users.
 * Steps are computed server-side from real DB state and passed as props.
 * The component hides itself once dismissed (via API) or all steps are done.
 */

import * as React from 'react';
import { CheckCircle2, Circle, X, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  done: boolean;
  href: string;
}

export interface OnboardingChecklistProps {
  steps: OnboardingStep[];
  /** True when the user has already dismissed — renders nothing */
  dismissed: boolean;
}

export function OnboardingChecklist({ steps, dismissed }: OnboardingChecklistProps) {
  const [visible, setVisible] = React.useState(!dismissed);
  const [dismissing, setDismissing] = React.useState(false);

  const allDone = steps.every((s) => s.done);
  const completedCount = steps.filter((s) => s.done).length;

  // Auto-hide once all steps are done
  React.useEffect(() => {
    if (allDone) setVisible(false);
  }, [allDone]);

  if (!visible) return null;

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      await fetch('/api/user/onboarding-dismiss', { method: 'PATCH' });
    } catch {
      // Best-effort: hide checklist even if the API call fails
    } finally {
      setVisible(false);
      setDismissing(false);
    }
  };

  return (
    <Card
      className="mb-8 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50"
      data-testid="onboarding-checklist"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base text-indigo-900">
              Get started on CodeSalvage
            </CardTitle>
            <p className="mt-0.5 text-sm text-indigo-700">
              {completedCount} of {steps.length} steps complete
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-indigo-400 hover:bg-indigo-100 hover:text-indigo-700"
            onClick={handleDismiss}
            disabled={dismissing}
            aria-label="Dismiss onboarding checklist"
          >
            {dismissing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-indigo-100">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
            role="progressbar"
            aria-valuenow={completedCount}
            aria-valuemin={0}
            aria-valuemax={steps.length}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {steps.map((step) => (
          <div key={step.id} className="flex items-start gap-3">
            {step.done ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-indigo-300" />
            )}
            <div className="min-w-0 flex-1">
              {step.done ? (
                <p className="text-sm font-medium text-muted-foreground line-through">
                  {step.label}
                </p>
              ) : (
                <Link
                  href={step.href}
                  className="text-sm font-medium text-indigo-900 underline-offset-2 hover:underline"
                >
                  {step.label}
                </Link>
              )}
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
