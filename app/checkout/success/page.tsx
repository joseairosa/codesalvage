/**
 * Checkout Success Page
 *
 * Displayed after successful payment.
 * Shows order confirmation and next steps.
 *
 * Features:
 * - Payment confirmation
 * - Order details
 * - GitHub repository access (if project has a GitHub repo)
 * - Download/access instructions
 * - Link to transaction details
 *
 * @example
 * /checkout/success?transactionId=trans_123&payment_intent=pi_123
 */

'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/lib/hooks/useSession';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Download,
  FileCode,
  FileText,
  ArrowRight,
  Loader2,
  AlertCircle,
  Github,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import Image from 'next/image';
import {
  GithubAuthProvider,
  signInWithPopup,
  linkWithPopup,
  getAdditionalUserInfo,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

const componentName = 'CheckoutSuccessPage';

interface RepositoryTransfer {
  id: string;
  status: string;
  buyerGithubUsername: string | null;
  invitationSentAt: Date | null;
  completedAt: Date | null;
}

interface Transaction {
  id: string;
  amountCents: number;
  paymentStatus: string;
  escrowStatus: string;
  escrowReleaseDate: Date;
  project: {
    id: string;
    title: string;
    description: string;
    completionPercentage: number;
    githubUrl: string | null;
    githubRepoName: string | null;
  };
  seller: {
    id: string;
    username: string | null;
    fullName: string | null;
  };
  repositoryTransfer: RepositoryTransfer | null;
}

function CheckoutSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();

  const transactionId = searchParams.get('transactionId');

  const [transaction, setTransaction] = React.useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [isSubmittingGithub, setIsSubmittingGithub] = React.useState(false);
  const [githubError, setGithubError] = React.useState<string | null>(null);
  const [githubSuccess, setGithubSuccess] = React.useState<string | null>(null);
  const [collaboratorAccepted, setCollaboratorAccepted] = React.useState(false);

  /**
   * Fetch transaction details
   */
  React.useEffect(() => {
    async function fetchTransaction() {
      if (sessionStatus === 'unauthenticated') {
        router.push('/auth/signin');
        return;
      }

      if (sessionStatus !== 'authenticated' || !transactionId) {
        return;
      }

      console.log(`[${componentName}] Fetching transaction:`, transactionId);
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/transactions/${transactionId}`);

        if (!response.ok) {
          throw new Error('Transaction not found');
        }

        const data = await response.json();
        setTransaction(data.transaction);

        console.log(`[${componentName}] Transaction loaded`);
      } catch (err) {
        console.error(`[${componentName}] Fetch error:`, err);
        setError(err instanceof Error ? err.message : 'Failed to load transaction');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTransaction();
  }, [transactionId, sessionStatus, router]);

  /**
   * Poll collaborator acceptance status every 30s once invitation is sent
   */
  React.useEffect(() => {
    if (!transactionId || !transaction) return;

    const invitationSentNow =
      transaction.repositoryTransfer?.status === 'invitation_sent' ||
      transaction.repositoryTransfer?.status === 'collaborator_added';

    if (!invitationSentNow || collaboratorAccepted) return;

    async function checkAcceptance() {
      try {
        const res = await fetch(`/api/transactions/${transactionId}/collaborator-status`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.accepted) {
          setCollaboratorAccepted(true);
        }
      } catch {}
    }

    checkAcceptance();
    const interval = setInterval(checkAcceptance, 30_000);
    return () => clearInterval(interval);
  }, [transactionId, transaction, collaboratorAccepted]);

  /**
   * Sign in with GitHub OAuth and auto-submit username for repository access
   */
  async function handleGithubOAuth() {
    if (!transactionId || !auth) return;

    setIsSubmittingGithub(true);
    setGithubError(null);
    setGithubSuccess(null);

    try {
      const existingGithubUsername = session?.user?.githubUsername;
      if (existingGithubUsername) {
        const response = await fetch(`/api/transactions/${transactionId}/buyer-github`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: existingGithubUsername }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to set GitHub username');
        const refreshResponse = await fetch(`/api/transactions/${transactionId}`);
        if (refreshResponse.ok)
          setTransaction((await refreshResponse.json()).transaction);
        setGithubSuccess(
          'GitHub invitation sent! Check your GitHub notifications to accept repository access.'
        );
        return;
      }

      const provider = new GithubAuthProvider();
      const currentUser = auth.currentUser;
      const userCredential = currentUser
        ? await linkWithPopup(currentUser, provider)
        : await signInWithPopup(auth, provider);

      const idToken = await userCredential.user.getIdToken();
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      const additionalInfo = getAdditionalUserInfo(userCredential);
      const username = (additionalInfo?.profile as { login?: string } | null)?.login;

      if (!username) {
        throw new Error('Could not retrieve GitHub username from your account');
      }

      console.log(`[${componentName}] Submitting GitHub username from OAuth:`, username);

      const response = await fetch(`/api/transactions/${transactionId}/buyer-github`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to set GitHub username');
      }

      console.log(`[${componentName}] GitHub username set successfully`);

      const refreshResponse = await fetch(`/api/transactions/${transactionId}`);
      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        setTransaction(refreshData.transaction);
      }

      setGithubSuccess(
        'GitHub invitation sent! Check your GitHub notifications to accept repository access.'
      );
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
      } else if (err.code === 'auth/provider-already-linked' && transactionId) {
        const username = (
          getAdditionalUserInfo(err.credential)?.profile as { login?: string } | null
        )?.login;
        if (username) {
          const response = await fetch(
            `/api/transactions/${transactionId}/buyer-github`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username }),
            }
          );
          if (response.ok) {
            const refreshResponse = await fetch(`/api/transactions/${transactionId}`);
            if (refreshResponse.ok) {
              setTransaction((await refreshResponse.json()).transaction);
            }
            setGithubSuccess(
              'GitHub invitation sent! Check your GitHub notifications to accept repository access.'
            );
          } else {
            const data = await response.json();
            setGithubError(data.error || 'Failed to set GitHub username');
          }
        }
      } else {
        console.error(`[${componentName}] GitHub OAuth error:`, err);
        setGithubError(err instanceof Error ? err.message : 'Failed to connect GitHub');
      }
    } finally {
      setIsSubmittingGithub(false);
    }
  }

  /**
   * Format price in cents to USD
   */
  const formatPrice = (cents: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(cents / 100);
  };

  /**
   * Format date
   */
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
  };

  /**
   * Determine GitHub access status for display
   */
  const getGithubAccessStatus = (transfer: RepositoryTransfer | null) => {
    if (!transfer) return 'none';
    return transfer.status;
  };

  const hasGithubRepo = !!(
    transaction?.project?.githubUrl || transaction?.project?.githubRepoName
  );
  const githubStatus = transaction
    ? getGithubAccessStatus(transaction.repositoryTransfer)
    : 'none';
  const transferIsComplete = githubStatus === 'completed' || githubStatus === 'accepted';
  const invitationSent = githubStatus === 'invitation_sent';

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <div className="space-y-8">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {/* Success Content */}
        {!isLoading && !error && transaction && (
          <>
            {/* Success Header */}
            <Card className="border-green-500">
              <CardHeader className="text-center">
                <Image
                  src="/images/checkout-success.png"
                  alt="Payment successful"
                  width={600}
                  height={338}
                  className="mx-auto mb-4 rounded-lg"
                />
                <CardTitle className="text-2xl">Payment Successful!</CardTitle>
                <CardDescription>
                  Your purchase has been completed and is now in escrow
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Order Details */}
            <Card>
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Project Info */}
                <div>
                  <h3 className="font-semibold">{transaction.project.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {transaction.project.completionPercentage}% complete
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Amount Paid</p>
                    <p className="font-semibold">
                      {formatPrice(transaction.amountCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Transaction ID</p>
                    <p className="font-mono text-sm">{transaction.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Status</p>
                    <p className="font-semibold capitalize">
                      {transaction.paymentStatus}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Escrow Release</p>
                    <p className="font-semibold">
                      {formatDate(transaction.escrowReleaseDate)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* GitHub Repository Access */}
            {hasGithubRepo && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Github className="h-5 w-5" />
                    <CardTitle>GitHub Repository Access</CardTitle>
                  </div>
                  <CardDescription>
                    {transferIsComplete
                      ? 'You have access to the repository.'
                      : invitationSent
                        ? 'A GitHub invitation has been sent to your account.'
                        : 'Enter your GitHub username to receive an invitation to the private repository.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Access confirmed */}
                  {transferIsComplete && (
                    <div className="flex items-center gap-3 rounded-md bg-green-50 p-4 text-green-800 dark:bg-green-950 dark:text-green-200">
                      <CheckCircle2 className="h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-semibold">Repository access confirmed</p>
                        <p className="text-sm">
                          You can now access{' '}
                          {transaction.project.githubRepoName || 'the repository'} on
                          GitHub.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Invitation sent — polling for acceptance */}
                  {invitationSent && !githubSuccess && (
                    <div className="space-y-3">
                      {collaboratorAccepted ? (
                        <div className="flex items-center gap-3 rounded-md bg-green-50 p-4 text-green-800 dark:bg-green-950 dark:text-green-200">
                          <CheckCircle2 className="h-5 w-5 shrink-0" />
                          <div>
                            <p className="font-semibold">Collaborator access granted</p>
                            <p className="text-sm">
                              @{transaction.repositoryTransfer?.buyerGithubUsername} now
                              has access to{' '}
                              {transaction.project.githubRepoName || 'the repository'}.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 rounded-md bg-blue-50 p-4 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                          <Clock className="h-5 w-5 shrink-0" />
                          <div className="flex-1">
                            <p className="font-semibold">
                              Invitation sent — awaiting acceptance
                            </p>
                            <p className="text-sm">
                              Check your GitHub notifications for a collaborator
                              invitation to{' '}
                              <strong>
                                @{transaction.repositoryTransfer?.buyerGithubUsername}
                              </strong>
                              . This page will update automatically once accepted.
                            </p>
                          </div>
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-50" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Success feedback after form submit */}
                  {githubSuccess && (
                    <div className="flex items-center gap-3 rounded-md bg-green-50 p-4 text-green-800 dark:bg-green-950 dark:text-green-200">
                      <CheckCircle2 className="h-5 w-5 shrink-0" />
                      <p className="text-sm">{githubSuccess}</p>
                    </div>
                  )}

                  {/* Sign in with GitHub — show if no transfer yet, or transfer is pending/failed */}
                  {!transferIsComplete &&
                    !invitationSent &&
                    !githubSuccess &&
                    githubStatus !== 'accepted' && (
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          {session?.user?.githubUsername
                            ? `Connect your GitHub account (@${session.user.githubUsername}) to be added as a collaborator.`
                            : 'Sign in with GitHub to be automatically added as a collaborator so you can review the code during the 7-day review period.'}
                        </p>
                        <Button
                          onClick={handleGithubOAuth}
                          disabled={isSubmittingGithub}
                          className="gap-2"
                        >
                          {isSubmittingGithub ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Github className="h-4 w-4" />
                          )}
                          {session?.user?.githubUsername
                            ? 'Grant Repository Access'
                            : 'Sign in with GitHub'}
                        </Button>

                        {githubError && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{githubError}</AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                </CardContent>
              </Card>
            )}

            {/* Next Steps */}
            <Card>
              <CardHeader>
                <CardTitle>What Happens Next?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold">Collaborator Access</h4>
                    <p className="text-sm text-muted-foreground">
                      {hasGithubRepo
                        ? "Enter your GitHub username above. You'll be immediately added as a collaborator so you can review the real repository."
                        : 'You now have immediate access to download the project code and assets.'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold">7-Day Review Period</h4>
                    <p className="text-sm text-muted-foreground">
                      Your payment is held in escrow while you review the code. You have
                      until{' '}
                      <span className="font-medium">
                        {formatDate(transaction.escrowReleaseDate)}
                      </span>{' '}
                      to raise any concerns.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold">Ownership Transfer</h4>
                    <p className="text-sm text-muted-foreground">
                      After the review period, full repository ownership is automatically
                      transferred to your GitHub account.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    4
                  </div>
                  <div>
                    <h4 className="font-semibold">Funds Released</h4>
                    <p className="text-sm text-muted-foreground">
                      Once the ownership transfer is confirmed, escrowed funds are
                      released to the seller. The deal is complete.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={() =>
                  router.push(`/projects/${transaction.project.id}/download`)
                }
                className="flex-1"
                size="lg"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Code
              </Button>
              <Button
                onClick={() => router.push(`/transactions/${transaction.id}`)}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                <FileText className="mr-2 h-4 w-4" />
                View Transaction Details
              </Button>
              <Button
                onClick={() => router.push('/buyer/purchases')}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                View All Purchases
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {/* Support Info */}
            <Alert>
              <FileCode className="h-4 w-4" />
              <AlertDescription>
                Need help? Contact the seller via the messaging system or reach out to our
                support team.
              </AlertDescription>
            </Alert>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Main page component with Suspense boundary
 * Required for useSearchParams() in Next.js 15
 */
export default function CheckoutSuccessPage() {
  console.log(`[${componentName}] Page rendered`);

  return (
    <React.Suspense
      fallback={
        <div className="container mx-auto max-w-4xl py-10">
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      }
    >
      <CheckoutSuccessContent />
    </React.Suspense>
  );
}
