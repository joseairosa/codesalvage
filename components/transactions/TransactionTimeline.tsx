/**
 * TransactionTimeline
 *
 * Vertical timeline component that visualises the lifecycle of a transaction
 * from offer acceptance through escrow release. Each stage renders as a
 * connected node with status icon, description, timestamp, and optional
 * action buttons.
 *
 * Responsibilities:
 * - Render stages with status-appropriate icons and colours
 * - Connect stages with vertical lines coloured by completion state
 * - Execute API actions (with loading state) and navigate to URLs
 * - Call onActionComplete after successful API mutations so the parent
 *   can refetch data
 *
 * @example
 * <TransactionTimeline
 *   stages={stages}
 *   userRole="buyer"
 *   transactionId="txn_abc"
 *   onActionComplete={() => refetch()}
 * />
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Circle,
  XCircle,
  Minus,
  Loader2,
  Handshake,
  CreditCard,
  GitBranch,
  Shield,
  Star,
  DollarSign,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  TimelineStage,
  TimelineStageStatus,
  TimelineAction,
} from '@/lib/services/RepositoryTransferService';

const componentName = 'TransactionTimeline';

export interface TransactionTimelineProps {
  stages: TimelineStage[];
  userRole: 'buyer' | 'seller';
  transactionId: string;
  onActionComplete?: () => void;
}

/**
 * Map a stage name to its lucide-react icon component.
 */
function getStageIcon(stageName: string): React.ElementType {
  const iconMap: Record<string, React.ElementType> = {
    'Offer Accepted': Handshake,
    'Payment Received': CreditCard,
    'Collaborator Access': GitBranch,
    'Project Review': Shield,
    'Trade Review': Star,
    'Ownership Transfer': DollarSign,
  };
  return iconMap[stageName] ?? Circle;
}

/**
 * Return Tailwind classes for the stage status icon wrapper.
 */
function getIconClasses(status: TimelineStageStatus): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-600';
    case 'active':
      return 'bg-blue-100 text-blue-600';
    case 'failed':
      return 'bg-red-100 text-red-600';
    case 'skipped':
      return 'bg-gray-100 text-gray-400';
    case 'upcoming':
    default:
      return 'bg-gray-100 text-gray-400';
  }
}

/**
 * Return the vertical connecting-line colour based on the current stage status.
 */
function getLineColour(status: TimelineStageStatus): string {
  switch (status) {
    case 'completed':
      return 'border-green-400';
    case 'active':
      return 'border-blue-400';
    case 'failed':
      return 'border-red-400';
    default:
      return 'border-gray-200';
  }
}

/**
 * Format a Date (or date-like string) into "Feb 11, 2026 at 3:45 PM".
 */
function formatTimestamp(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Map a TimelineAction.type to a Button variant.
 */
function actionVariant(type: TimelineAction['type']): 'default' | 'outline' | 'link' {
  switch (type) {
    case 'primary':
      return 'default';
    case 'secondary':
      return 'outline';
    case 'link':
      return 'link';
  }
}

/**
 * Status icon rendered inside the timeline node circle.
 */
function StageStatusIcon({
  status,
  stageName,
}: {
  status: TimelineStageStatus;
  stageName: string;
}) {
  const StageIconComponent = getStageIcon(stageName);

  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5" />;
    case 'active':
      return <StageIconComponent className="h-5 w-5 animate-pulse" />;
    case 'failed':
      return <XCircle className="h-5 w-5" />;
    case 'skipped':
      return <Minus className="h-5 w-5" />;
    case 'upcoming':
    default:
      return <Circle className="h-5 w-5" />;
  }
}

export function TransactionTimeline({
  stages,
  userRole,
  transactionId,
  onActionComplete,
}: TransactionTimelineProps) {
  const router = useRouter();
  const [loadingAction, setLoadingAction] = React.useState<string | null>(null);

  console.log(`[${componentName}] Rendering timeline for transaction:`, transactionId, {
    stageCount: stages.length,
    userRole,
  });

  /**
   * Handle action button click.
   *
   * For API actions, fires a fetch then calls onActionComplete.
   * For URL actions, navigates with router.push.
   */
  const handleAction = React.useCallback(
    async (action: TimelineAction) => {
      console.log(`[${componentName}] Action triggered:`, action.label, {
        apiEndpoint: action.apiEndpoint,
        url: action.url,
      });

      if (action.url) {
        router.push(action.url);
        return;
      }

      if (action.apiEndpoint) {
        const actionKey = `${action.apiEndpoint}-${action.apiMethod}`;
        setLoadingAction(actionKey);

        try {
          const response = await fetch(action.apiEndpoint, {
            method: action.apiMethod || 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(
              errorData?.error || `Request failed with status ${response.status}`
            );
          }

          console.log(`[${componentName}] Action completed successfully:`, action.label);
          onActionComplete?.();
        } catch (err) {
          console.error(`[${componentName}] Action failed:`, action.label, err);
        } finally {
          setLoadingAction(null);
        }
      }
    },
    [router, onActionComplete]
  );

  return (
    <div className="space-y-0">
      {stages.map((stage, index) => {
        const isLast = index === stages.length - 1;
        const timestamp = formatTimestamp(stage.completedAt);
        const isSkipped = stage.status === 'skipped';

        return (
          <div key={stage.name} className="flex gap-4">
            {/* Left column: icon + connecting line */}
            <div className="flex flex-col items-center">
              {/* Icon circle */}
              <div
                className={cn(
                  'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
                  getIconClasses(stage.status)
                )}
              >
                <StageStatusIcon status={stage.status} stageName={stage.name} />
              </div>

              {/* Connecting line */}
              {!isLast && (
                <div
                  className={cn('w-0 flex-1 border-l-2', getLineColour(stage.status))}
                />
              )}
            </div>

            {/* Right column: card with stage details */}
            <div className={cn('flex-1 pb-8', isLast && 'pb-0')}>
              <Card
                className={cn(
                  isSkipped && 'opacity-60',
                  stage.status === 'upcoming' && 'opacity-50'
                )}
              >
                <CardHeader className={cn(stage.actions.length > 0 && 'pb-2')}>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className={cn('text-base', isSkipped && 'line-through')}>
                      {stage.name}
                    </CardTitle>
                    {timestamp && (
                      <span className="flex-shrink-0 text-xs text-muted-foreground">
                        {timestamp}
                      </span>
                    )}
                  </div>
                  <CardDescription className={cn(isSkipped && 'line-through')}>
                    {stage.description}
                  </CardDescription>
                </CardHeader>

                {/* Action buttons */}
                {stage.actions.length > 0 && (
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {stage.actions.map((action) => {
                        const actionKey = action.apiEndpoint
                          ? `${action.apiEndpoint}-${action.apiMethod}`
                          : action.label;
                        const isLoading = loadingAction === actionKey;

                        return (
                          <Button
                            key={action.label}
                            variant={actionVariant(action.type)}
                            size="sm"
                            disabled={isLoading}
                            onClick={() => handleAction(action)}
                          >
                            {isLoading && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {action.label}
                          </Button>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          </div>
        );
      })}
    </div>
  );
}
