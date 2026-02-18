import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Github, CheckCircle2, Clock, Loader2, AlertCircle } from 'lucide-react';

export type GithubAccessState = 'connect' | 'checking' | 'pending' | 'granted';

interface GitHubAccessCardProps {
  repoName: string | null;
  buyerGithubUsername: string | null;
  githubAccessState: GithubAccessState;
  isConnecting: boolean;
  githubError: string | null;
  githubSuccess: string | null;
  sessionGithubUsername: string | null | undefined;
  onConnect: () => void;
}

export function GitHubAccessCard({
  repoName,
  buyerGithubUsername,
  githubAccessState,
  isConnecting,
  githubError,
  githubSuccess,
  sessionGithubUsername,
  onConnect,
}: GitHubAccessCardProps) {
  const repoLabel = repoName || 'the repository';

  const cardDescription = {
    connect: sessionGithubUsername
      ? `Connect your GitHub account (@${sessionGithubUsername}) to be added as a collaborator.`
      : 'Sign in with GitHub to be automatically added as a collaborator so you can review the code during the 7-day review period.',
    checking: 'Checking your GitHub collaborator status…',
    pending: 'A GitHub invitation has been sent to your account.',
    granted: 'You have collaborator access to the repository.',
  }[githubAccessState];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Github className="h-5 w-5" />
          <CardTitle>GitHub Repository Access</CardTitle>
        </div>
        <CardDescription>{cardDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* State 1: Connect GitHub */}
        {githubAccessState === 'connect' && !githubSuccess && (
          <div className="space-y-4">
            <Button onClick={onConnect} disabled={isConnecting} className="gap-2">
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Github className="h-4 w-4" />
              )}
              {sessionGithubUsername ? 'Grant Repository Access' : 'Sign in with GitHub'}
            </Button>

            {githubError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{githubError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* State 2a: Checking GitHub status (initial load) */}
        {githubAccessState === 'checking' && (
          <div className="flex items-center gap-3 rounded-md bg-muted p-4 text-muted-foreground">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
            <div>
              <p className="font-semibold text-foreground">Checking GitHub access…</p>
              <p className="text-sm">
                Verifying whether you&apos;ve accepted the collaborator invitation.
              </p>
            </div>
          </div>
        )}

        {/* State 2b: Invitation sent, awaiting acceptance */}
        {githubAccessState === 'pending' && (
          <div className="flex items-center gap-3 rounded-md bg-blue-50 p-4 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
            <Clock className="h-5 w-5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">Invitation sent — awaiting acceptance</p>
              <p className="text-sm">
                Check your GitHub notifications for a collaborator invitation
                {buyerGithubUsername && (
                  <>
                    {' '}
                    to <strong>@{buyerGithubUsername}</strong>
                  </>
                )}
                . This page updates automatically once you accept.
              </p>
            </div>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-50" />
          </div>
        )}

        {/* State 3: Access granted */}
        {githubAccessState === 'granted' && (
          <div className="flex items-center gap-3 rounded-md bg-green-50 p-4 text-green-800 dark:bg-green-950 dark:text-green-200">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Collaborator access granted</p>
              <p className="text-sm">
                {buyerGithubUsername ? (
                  <>
                    <strong>@{buyerGithubUsername}</strong> now has access to {repoLabel}.
                  </>
                ) : (
                  <>You now have access to {repoLabel}.</>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Success feedback shown immediately after OAuth flow */}
        {githubSuccess && githubAccessState === 'connect' && (
          <div className="flex items-center gap-3 rounded-md bg-green-50 p-4 text-green-800 dark:bg-green-950 dark:text-green-200">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <p className="text-sm">{githubSuccess}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
