/**
 * RepositoryTransferCard
 *
 * Expanded detail card for the Repository Transfer stage of a transaction.
 * Shown when Stage 3 is active, providing role-specific UI for sellers
 * (initiate transfer) and buyers (provide GitHub username, confirm access).
 *
 * Responsibilities:
 * - Display repository name and transfer status badge
 * - Seller: "Transfer Repository" button (pre-initiation) or status info
 * - Buyer: GitHub username input (if missing), "Confirm Access" button,
 *   or success message
 * - Manual transfer: step-by-step instructions when method is manual
 * - API calls with loading state and parent callback on completion
 *
 * @example
 * <RepositoryTransferCard
 *   stage={repoTransferStage}
 *   userRole="buyer"
 *   transactionId="txn_abc"
 *   onActionComplete={() => refetch()}
 * />
 */

'use client';

import * as React from 'react';
import {
  GitBranch,
  Loader2,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { TimelineStage } from '@/lib/services/RepositoryTransferService';

const componentName = 'RepositoryTransferCard';

// ---------- Props ----------

export interface RepositoryTransferCardProps {
  stage: TimelineStage;
  userRole: 'buyer' | 'seller';
  transactionId: string;
  onActionComplete?: () => void;
}

// ---------- Helpers ----------

/**
 * Map the transfer status to a human-readable badge label and colour.
 */
function getTransferBadge(status: string): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    completed: { label: 'Completed', className: 'bg-green-100 text-green-800' },
    active: { label: 'In Progress', className: 'bg-blue-100 text-blue-800' },
    upcoming: { label: 'Pending', className: 'bg-gray-100 text-gray-600' },
    skipped: { label: 'Skipped', className: 'bg-gray-100 text-gray-400' },
    failed: { label: 'Failed', className: 'bg-red-100 text-red-800' },
  };
  return map[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
}

// ---------- Component ----------

export function RepositoryTransferCard({
  stage,
  userRole,
  transactionId,
  onActionComplete,
}: RepositoryTransferCardProps) {
  const [githubUsername, setGithubUsername] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const repoName = (stage.metadata?.['githubRepoFullName'] as string) ?? null;
  const transferStatus = (stage.metadata?.['transferStatus'] as string) ?? stage.status;
  const buyerGithubUsername = (stage.metadata?.['buyerGithubUsername'] as string) ?? null;
  const method = (stage.metadata?.['method'] as string) ?? 'github';

  const badge = getTransferBadge(stage.status);

  console.log(`[${componentName}] Rendering:`, {
    transactionId,
    userRole,
    stageStatus: stage.status,
    transferStatus,
    repoName,
    method,
  });

  /**
   * Save the buyer's GitHub username via the API.
   */
  const handleSaveUsername = async () => {
    const trimmed = githubUsername.trim();
    if (!trimmed) return;

    console.log(`[${componentName}] Saving buyer GitHub username:`, trimmed);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/transactions/${transactionId}/buyer-github`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUsername: trimmed }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to save GitHub username');
      }

      console.log(`[${componentName}] GitHub username saved successfully`);
      setGithubUsername('');
      onActionComplete?.();
    } catch (err) {
      console.error(`[${componentName}] Save username error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to save username');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Initiate the repository transfer (seller action).
   */
  const handleInitiateTransfer = async () => {
    console.log(`[${componentName}] Initiating repository transfer`);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/transactions/${transactionId}/repository-transfer`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to initiate transfer');
      }

      console.log(`[${componentName}] Transfer initiated successfully`);
      onActionComplete?.();
    } catch (err) {
      console.error(`[${componentName}] Initiate transfer error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to initiate transfer');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Confirm that the buyer has received repository access.
   */
  const handleConfirmAccess = async () => {
    console.log(`[${componentName}] Confirming repository access`);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/transactions/${transactionId}/confirm-transfer`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Failed to confirm access');
      }

      console.log(`[${componentName}] Access confirmed successfully`);
      onActionComplete?.();
    } catch (err) {
      console.error(`[${componentName}] Confirm access error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to confirm access');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Repository Transfer</CardTitle>
          </div>
          <Badge className={badge.className}>{badge.label}</Badge>
        </div>
        {repoName && (
          <CardDescription className="flex items-center gap-1.5 pt-1">
            <span className="font-mono text-sm">{repoName}</span>
            <a
              href={`https://github.com/${repoName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* ------ Completed state ------ */}
        {stage.status === 'completed' && (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-green-800">
              Repository access has been successfully transferred.
            </p>
          </div>
        )}

        {/* ------ Seller view ------ */}
        {userRole === 'seller' && stage.status !== 'completed' && (
          <>
            {/* Not yet initiated */}
            {stage.status === 'active' && !stage.metadata?.['transferInitiated'] && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Initiate the transfer to give the buyer access to the repository. A
                  GitHub collaboration invitation will be sent to the buyer.
                </p>
                <Button onClick={handleInitiateTransfer} disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <GitBranch className="mr-2 h-4 w-4" />
                  )}
                  Transfer Repository
                </Button>
              </div>
            )}

            {/* Already initiated — status info */}
            {stage.status === 'active' && stage.metadata?.['transferInitiated'] && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{stage.description}</p>
                <p className="text-xs text-muted-foreground">
                  The buyer will confirm once they have access. No further action is
                  required from you at this time.
                </p>
              </div>
            )}
          </>
        )}

        {/* ------ Buyer view ------ */}
        {userRole === 'buyer' && stage.status !== 'completed' && (
          <>
            {/* No GitHub username — input field */}
            {!buyerGithubUsername && stage.status === 'active' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Please provide your GitHub username so the seller can grant you
                  repository access.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Your GitHub username"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    disabled={isLoading}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveUsername();
                    }}
                  />
                  <Button
                    onClick={handleSaveUsername}
                    disabled={isLoading || !githubUsername.trim()}
                  >
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save
                  </Button>
                </div>
              </div>
            )}

            {/* Invitation sent — confirm access */}
            {buyerGithubUsername && stage.status === 'active' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  A GitHub collaboration invitation has been sent to{' '}
                  <span className="font-mono font-semibold">@{buyerGithubUsername}</span>.
                  Please accept the invitation on GitHub, then confirm access below.
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href="https://github.com/notifications"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View on GitHub
                    </a>
                  </Button>
                  <Button size="sm" onClick={handleConfirmAccess} disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Confirm Access
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ------ Manual transfer instructions ------ */}
        {method === 'manual' && stage.status !== 'completed' && (
          <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
            <p className="text-sm font-semibold">Manual Transfer Instructions</p>
            <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
              <li>
                Go to the repository settings on GitHub:{' '}
                {repoName && (
                  <a
                    href={`https://github.com/${repoName}/settings`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-primary hover:underline"
                  >
                    {repoName}/settings
                  </a>
                )}
              </li>
              <li>
                Navigate to <span className="font-semibold">Collaborators</span> in the
                sidebar.
              </li>
              <li>
                Click <span className="font-semibold">Add people</span> and enter the
                buyer&apos;s GitHub username.
              </li>
              <li>
                The buyer will receive an email invitation to collaborate on the
                repository.
              </li>
              <li>
                Once the buyer accepts, click{' '}
                <span className="font-semibold">Confirm Access</span> above to mark the
                transfer as complete.
              </li>
            </ol>
          </div>
        )}

        {/* ------ Upcoming state ------ */}
        {stage.status === 'upcoming' && (
          <p className="text-sm text-muted-foreground">{stage.description}</p>
        )}

        {/* ------ Failed state ------ */}
        {stage.status === 'failed' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{stage.description}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
