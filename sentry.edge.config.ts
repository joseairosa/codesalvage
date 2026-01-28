/**
 * Sentry Edge Configuration
 *
 * Edge runtime error tracking for Middleware and Edge API routes
 * Captures errors in Vercel/Railway edge functions
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env['SENTRY_DSN'];
const ENVIRONMENT = process.env['NODE_ENV'] || 'development';

Sentry.init({
  // DSN (Data Source Name) - unique identifier for your Sentry project
  dsn: SENTRY_DSN,

  // Environment (development, staging, production)
  environment: ENVIRONMENT,

  // Adjust sample rate for performance monitoring (0.0 - 1.0)
  tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

  // Capture 100% of error events
  sampleRate: 1.0,

  // Filter out development errors
  enabled: ENVIRONMENT !== 'development',

  // Attach request context
  beforeSend(event) {
    // Don't send errors in development
    if (ENVIRONMENT === 'development') {
      return null;
    }

    return event;
  },
});
