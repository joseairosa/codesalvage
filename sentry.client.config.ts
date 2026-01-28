/**
 * Sentry Client Configuration
 *
 * Client-side error tracking for browser JavaScript
 * Captures errors, unhandled rejections, and performance metrics
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env['NEXT_PUBLIC_SENTRY_DSN'];
const ENVIRONMENT = process.env['NEXT_PUBLIC_ENV'] || process.env['NODE_ENV'] || 'development';

Sentry.init({
  // DSN (Data Source Name) - unique identifier for your Sentry project
  dsn: SENTRY_DSN,

  // Environment (development, staging, production)
  environment: ENVIRONMENT,

  // Adjust sample rate for performance monitoring (0.0 - 1.0)
  // 1.0 = capture all transactions, 0.1 = capture 10%
  tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

  // Capture 100% of error events
  sampleRate: 1.0,

  // Capture Replay for Session Replay (helps debug issues)
  // https://docs.sentry.io/platforms/javascript/session-replay/
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors

  // Enable Replay for debugging
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true, // Mask all text for privacy
      blockAllMedia: true, // Block all media (images, videos)
    }),
  ],

  // Filter out development errors
  enabled: ENVIRONMENT !== 'development',

  // Don't report errors from browser extensions
  ignoreErrors: [
    // Browser extension errors
    'Non-Error promise rejection captured',
    'ResizeObserver loop limit exceeded',
    // Network errors
    'NetworkError',
    'Failed to fetch',
    // User canceled navigation
    'Navigation cancelled',
  ],

  // Attach user context when available
  beforeSend(event, hint) {
    // Don't send errors in development
    if (ENVIRONMENT === 'development') {
      console.error('[Sentry]', hint.originalException || hint.syntheticException);
      return null;
    }

    // Filter out specific errors
    const error = hint.originalException;
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as Error).message;

      // Don't report auth errors (user-facing, not bugs)
      if (message.includes('Unauthorized') || message.includes('Authentication')) {
        return null;
      }
    }

    return event;
  },
});
