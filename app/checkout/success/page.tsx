/**
 * Checkout Success Page
 *
 * Displayed after successful payment.
 * Shows order confirmation, GitHub repository access status (3-state),
 * next steps, and action buttons.
 *
 * GitHub access states:
 *  - connect  → buyer hasn't linked GitHub yet
 *  - checking → invitation sent, running initial status check with GitHub
 *  - pending  → invitation sent, buyer hasn't accepted yet (polls every 30s)
 *  - granted  → buyer accepted, collaborator access confirmed
 */

'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/lib/hooks/useSession';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Download,
  FileText,
  ArrowRight,
  Loader2,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import Image from 'next/image';
import {
  GithubAuthProvider,
  signInWithPopup,
  linkWithPopup,
  getAdditionalUserInfo,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  GitHubAccessCard,
  type GithubAccessState,
} from '@/components/checkout/GitHubAccessCard';
import { PurchaseFlowSteps } from '@/components/checkout/PurchaseFlowSteps';

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
  seller: { id: string; username: string | null; fullName: string | null };
  repositoryTransfer: RepositoryTransfer | null;
}

const formatPrice = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));

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
  const [isCheckingCollaborator, setIsCheckingCollaborator] = React.useState(false);

  React.useEffect(() => {
    async function fetchTransaction() {
      if (sessionStatus === 'unauthenticated') {
        router.push('/auth/signin');
        return;
      }
      if (sessionStatus !== 'authenticated' || !transactionId) return;

      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/transactions/${transactionId}`);
        if (!response.ok) throw new Error('Transaction not found');
        const data = await response.json();
        setTransaction(data.transaction);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transaction');
      } finally {
        setIsLoading(false);
      }
    }
    fetchTransaction();
  }, [transactionId, sessionStatus, router]);

  const isInitialCheckRef = React.useRef(true);
  React.useEffect(() => {
    if (!transactionId || !transaction) return;

    const status = transaction.repositoryTransfer?.status;
    const invitationActive =
      status === 'invitation_sent' || status === 'collaborator_added';
    if (!invitationActive || collaboratorAccepted) return;

    isInitialCheckRef.current = true;
    setIsCheckingCollaborator(true);

    async function checkAcceptance() {
      try {
        const res = await fetch(`/api/transactions/${transactionId}/collaborator-status`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.accepted) setCollaboratorAccepted(true);
      } catch {
      } finally {
        if (isInitialCheckRef.current) {
          isInitialCheckRef.current = false;
          setIsCheckingCollaborator(false);
        }
      }
    }

    checkAcceptance();
    const interval = setInterval(checkAcceptance, 30_000);
    return () => clearInterval(interval);
  }, [transactionId, transaction, collaboratorAccepted]);

  async function handleGithubOAuth() {
    if (!transactionId || !auth) return;
    setIsSubmittingGithub(true);
    setGithubError(null);
    setGithubSuccess(null);

    try {
      const existingUsername = session?.user?.githubUsername;
      if (existingUsername) {
        const res = await fetch(`/api/transactions/${transactionId}/buyer-github`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: existingUsername }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to set GitHub username');
        const refresh = await fetch(`/api/transactions/${transactionId}`);
        if (refresh.ok) setTransaction((await refresh.json()).transaction);
        setGithubSuccess(
          'GitHub invitation sent! Check your GitHub notifications to accept repository access.'
        );
        return;
      }

      const provider = new GithubAuthProvider();
      const currentUser = auth.currentUser;
      const credential = currentUser
        ? await linkWithPopup(currentUser, provider)
        : await signInWithPopup(auth, provider);

      const idToken = await credential.user.getIdToken();
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      const additionalInfo = getAdditionalUserInfo(credential);
      const username = (additionalInfo?.profile as { login?: string } | null)?.login;
      if (!username)
        throw new Error('Could not retrieve GitHub username from your account');

      const res = await fetch(`/api/transactions/${transactionId}/buyer-github`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || data.message || 'Failed to set GitHub username');

      const refresh = await fetch(`/api/transactions/${transactionId}`);
      if (refresh.ok) setTransaction((await refresh.json()).transaction);
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
          const res = await fetch(`/api/transactions/${transactionId}/buyer-github`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
          });
          if (res.ok) {
            const refresh = await fetch(`/api/transactions/${transactionId}`);
            if (refresh.ok) setTransaction((await refresh.json()).transaction);
            setGithubSuccess(
              'GitHub invitation sent! Check your GitHub notifications to accept repository access.'
            );
          } else {
            setGithubError((await res.json()).error || 'Failed to set GitHub username');
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

  const githubStatus = transaction?.repositoryTransfer?.status ?? 'none';
  const transferIsComplete =
    githubStatus === 'completed' || githubStatus === 'ownership_transferred';
  const invitationActive =
    githubStatus === 'invitation_sent' || githubStatus === 'collaborator_added';
  const hasGithubRepo = !!(
    transaction?.project?.githubUrl || transaction?.project?.githubRepoName
  );

  const githubAccessState: GithubAccessState = (() => {
    if (collaboratorAccepted || transferIsComplete) return 'granted';
    if (invitationActive && isCheckingCollaborator) return 'checking';
    if (invitationActive) return 'pending';
    return 'connect';
  })();

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <div className="space-y-8">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && transaction && (
          <>
            <Card className="border-green-500">
              <CardHeader className="text-center">
                <Image
                  src="/images/checkout-success.png"
                  alt="Payment successful"
                  width={600}
                  height={338}
                  className="mx-auto mb-4 rounded-lg"
                />
                <div className="text-2xl font-bold">Payment Successful!</div>
                <div className="text-muted-foreground">
                  Your purchase has been completed and is now in escrow
                </div>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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

            {hasGithubRepo && (
              <GitHubAccessCard
                repoName={transaction.project.githubRepoName}
                buyerGithubUsername={
                  transaction.repositoryTransfer?.buyerGithubUsername ?? null
                }
                githubAccessState={githubAccessState}
                isConnecting={isSubmittingGithub}
                githubError={githubError}
                githubSuccess={githubSuccess}
                sessionGithubUsername={session?.user?.githubUsername}
                onConnect={handleGithubOAuth}
              />
            )}

            <PurchaseFlowSteps
              hasGithubRepo={hasGithubRepo}
              escrowReleaseDate={transaction.escrowReleaseDate}
              formatDate={formatDate}
            />

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

export default function CheckoutSuccessPage() {
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
