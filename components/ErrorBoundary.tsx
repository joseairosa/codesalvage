/**
 * ErrorBoundary Component
 *
 * Responsibilities:
 * - Catch React errors in component tree
 * - Display user-friendly error UI
 * - Log errors for debugging
 * - Provide recovery actions (reload, go home)
 * - Prevent app crashes from propagating
 *
 * Architecture:
 * - Client Component (uses React error boundary)
 * - Class component (React error boundaries must be classes)
 * - Fallback UI with recovery options
 * - Error logging for monitoring
 *
 * Note: Next.js App Router provides error.tsx convention,
 * but this component can be used for more granular error boundaries.
 */

'use client';

import React, { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Home, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * ErrorBoundary Component
 *
 * Catches errors in child components and displays fallback UI.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Static method called when error is caught
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    console.error('[ErrorBoundary] Error caught:', error);
    return { hasError: true };
  }

  /**
   * Lifecycle method called after error is caught
   * Used for logging and side effects
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // TODO: Send error to monitoring service (e.g., Sentry)
    // Example: Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
  }

  /**
   * Reset error boundary state
   */
  handleReset = (): void => {
    console.log('[ErrorBoundary] Resetting error boundary');
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  /**
   * Reload the page
   */
  handleReload = (): void => {
    console.log('[ErrorBoundary] Reloading page');
    window.location.reload();
  };

  /**
   * Navigate to home page
   */
  handleGoHome = (): void => {
    console.log('[ErrorBoundary] Navigating to home');
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
          <Card className="w-full max-w-md border-2 border-red-200 shadow-xl">
            <CardHeader className="text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/error-illustration.png"
                alt="Something went wrong"
                width={160}
                height={160}
                className="mx-auto mb-4"
              />

              <CardTitle className="text-2xl font-bold">
                Oops! Something went wrong
              </CardTitle>

              <CardDescription className="mt-2">
                We're sorry for the inconvenience. An unexpected error occurred.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Error details (development only) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-800">Error Details:</p>
                  <p className="mt-2 font-mono text-xs text-red-700">
                    {this.state.error.message}
                  </p>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-red-700">
                        Component Stack
                      </summary>
                      <pre className="mt-2 max-h-40 overflow-auto text-xs text-red-600">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Recovery actions */}
              <div className="flex flex-col gap-3">
                <Button onClick={this.handleReload} className="w-full gap-2">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Reload Page
                </Button>

                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="w-full gap-2"
                >
                  <Home className="h-4 w-4" aria-hidden="true" />
                  Go to Home
                </Button>

                {process.env.NODE_ENV === 'development' && (
                  <Button onClick={this.handleReset} variant="ghost" className="w-full">
                    Reset Error Boundary
                  </Button>
                )}
              </div>

              {/* Support message */}
              <p className="text-center text-xs text-gray-500">
                If this problem persists, please{' '}
                <a href="/contact" className="underline hover:text-blue-600">
                  contact support
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Functional wrapper for easier usage
 *
 * @example
 * <ErrorBoundaryWrapper>
 *   <YourComponent />
 * </ErrorBoundaryWrapper>
 */
export function ErrorBoundaryWrapper({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return <ErrorBoundary fallback={fallback}>{children}</ErrorBoundary>;
}
