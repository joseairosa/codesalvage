/**
 * Project Download Page
 *
 * Page for buyers to download purchased project code.
 * Provides download links and GitHub access instructions.
 *
 * Features:
 * - Verify purchase
 * - Generate download link
 * - Show GitHub repository URL
 * - Download instructions
 * - Support info
 *
 * @example
 * /projects/project123/download
 */

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
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
  Github,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

const componentName = 'ProjectDownloadPage';

export default function ProjectDownloadPage({ params }: { params: { id: string } }) {
  console.log(`[${componentName}] Page rendered for project:`, params.id);

  const router = useRouter();
  const { data: _session, status: sessionStatus } = useSession();

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [downloadInfo, setDownloadInfo] = React.useState<any>(null);

  /**
   * Generate download link
   */
  const handleGenerateDownload = async () => {
    console.log(`[${componentName}] Generating download link`);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${params.id}/download`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate download link');
      }

      const data = await response.json();
      setDownloadInfo(data);

      console.log(`[${componentName}] Download link generated`);

      // If downloadUrl exists, trigger download
      if (data.downloadUrl) {
        window.location.href = data.downloadUrl;
      }
    } catch (err) {
      console.error(`[${componentName}] Download error:`, err);
      setError(err instanceof Error ? err.message : 'Failed to generate download link');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Redirect if not authenticated
   */
  React.useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push(`/auth/signin?callbackUrl=/projects/${params.id}/download`);
    }
  }, [sessionStatus, params.id, router]);

  return (
    <div className="container mx-auto max-w-4xl py-10">
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold">Download Project Code</h1>
          <p className="mt-2 text-muted-foreground">
            Access your purchased project files and repository
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Download Info (after generation) */}
        {downloadInfo && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>{downloadInfo.message}</AlertDescription>
          </Alert>
        )}

        {/* Download Options */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Code ZIP Download */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                <CardTitle>Download Code ZIP</CardTitle>
              </div>
              <CardDescription>
                Download the complete project source code as a ZIP file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleGenerateDownload}
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Link...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Download ZIP
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground">
                The download link expires after 1 hour. You can generate a new link
                anytime.
              </p>
            </CardContent>
          </Card>

          {/* GitHub Repository */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Github className="h-5 w-5" />
                <CardTitle>GitHub Repository</CardTitle>
              </div>
              <CardDescription>
                Clone or fork the GitHub repository directly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {downloadInfo?.githubUrl ? (
                <>
                  <Button
                    onClick={() => window.open(downloadInfo.githubUrl, '_blank')}
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    <Github className="mr-2 h-4 w-4" />
                    Open Repository
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>

                  <div className="rounded-lg bg-muted p-3">
                    <code className="break-all text-xs">{downloadInfo.githubUrl}</code>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Generate download link to access GitHub repository information.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  1
                </div>
                <div>
                  <h4 className="font-semibold">Download the Code</h4>
                  <p className="text-sm text-muted-foreground">
                    Download the ZIP file or clone the GitHub repository to your local
                    machine.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  2
                </div>
                <div>
                  <h4 className="font-semibold">Install Dependencies</h4>
                  <p className="text-sm text-muted-foreground">
                    Follow the README instructions to install dependencies (npm install,
                    etc.)
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  3
                </div>
                <div>
                  <h4 className="font-semibold">Complete the Project</h4>
                  <p className="text-sm text-muted-foreground">
                    Review the known issues and start finishing the remaining features!
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Support */}
        <Alert>
          <FileCode className="h-4 w-4" />
          <AlertDescription>
            <strong>Need help?</strong> Contact the seller via the messaging system if you
            have questions about the code. For technical support, reach out to our support
            team.
          </AlertDescription>
        </Alert>

        {/* Back Button */}
        <div className="flex justify-center">
          <Button onClick={() => router.push('/buyer/purchases')} variant="outline">
            View All Purchases
          </Button>
        </div>
      </div>
    </div>
  );
}
