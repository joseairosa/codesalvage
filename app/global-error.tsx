'use client';

/**
 * Global Error Boundary
 *
 * Catches errors in the app and reports them to Sentry
 * Displays a user-friendly error page
 *
 * https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
            <h1 className="mb-4 text-2xl font-bold text-red-600">Something went wrong!</h1>
            <p className="mb-6 text-gray-700">
              We're sorry, but something unexpected happened. Our team has been notified and is
              working on a fix.
            </p>

            {error.digest && (
              <p className="mb-4 rounded bg-gray-100 p-3 font-mono text-sm text-gray-600">
                Error ID: {error.digest}
              </p>
            )}

            <div className="flex gap-4">
              <Button onClick={() => reset()} variant="default">
                Try Again
              </Button>
              <Button onClick={() => (window.location.href = '/')} variant="outline">
                Go Home
              </Button>
            </div>

            <p className="mt-6 text-sm text-gray-500">
              If this problem persists, please contact support at support@projectfinish.com
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
