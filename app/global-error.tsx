/**
 * Global Error Boundary
 *
 * Catches all unhandled errors in the application and displays a user-friendly error page.
 * Automatically reports errors to Honeybadger for monitoring.
 *
 * This component is a Next.js 15 App Router feature that catches errors at the root level.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-errors-in-root-layouts
 */

'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { captureException } from '@/lib/utils/honeybadger';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report error to Honeybadger
    captureException(error, {
      tags: {
        boundary: 'global',
        digest: error.digest || 'unknown',
      },
      context: {
        error_message: error.message,
        error_stack: error.stack,
        digest: error.digest,
      },
    });

    // Log to console for development
    console.error('[Global Error Boundary] Error caught:', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
            {/* Error Icon */}
            <div className="mb-6 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-8 w-8 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>

            {/* Error Message */}
            <h1 className="mb-4 text-center text-2xl font-bold text-red-600">
              Something went wrong!
            </h1>

            <p className="mb-6 text-center text-gray-600">
              We apologize for the inconvenience. An unexpected error has occurred and our
              team has been notified.
            </p>

            {/* Error Details (Development Only) */}
            {process.env['NODE_ENV'] === 'development' && (
              <div className="mb-6 rounded-md bg-gray-100 p-4">
                <p className="mb-2 font-mono text-sm font-semibold text-gray-700">
                  Error Details:
                </p>
                <p className="mb-2 font-mono text-xs text-gray-600">{error.message}</p>
                {error.digest && (
                  <p className="font-mono text-xs text-gray-500">
                    Digest: {error.digest}
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <Button onClick={reset} className="w-full" size="lg">
                Try Again
              </Button>

              <Button
                onClick={() => (window.location.href = '/')}
                variant="outline"
                className="w-full"
                size="lg"
              >
                Go to Homepage
              </Button>
            </div>

            {/* Support Link */}
            <p className="mt-6 text-center text-sm text-gray-500">
              If this problem persists, please{' '}
              <a
                href="mailto:support@codesalvage.com"
                className="text-blue-600 hover:underline"
              >
                contact support
              </a>
              .
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
