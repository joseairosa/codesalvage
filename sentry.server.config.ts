/**
 * Sentry Server Configuration
 *
 * Server-side error tracking for Node.js API routes and SSR
 * Captures backend errors, database issues, and API failures
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

  // Enable Replay for debugging
  integrations: [],

  // Filter out development errors
  enabled: ENVIRONMENT !== 'development',

  // Don't report errors from certain paths
  ignoreErrors: [
    // Health check endpoint errors
    'ECONNREFUSED',
    // Database connection pool errors (handled by retry logic)
    'Connection terminated unexpectedly',
  ],

  // Attach request context and filter sensitive data
  beforeSend(event, hint) {
    // Don't send errors in development
    if (ENVIRONMENT === 'development') {
      console.error('[Sentry]', hint.originalException || hint.syntheticException);
      return null;
    }

    // Filter sensitive data from request
    if (event.request) {
      // Remove authorization headers
      if (event.request.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }

      // Remove sensitive query params
      if (event.request.query_string) {
        const sensitiveParams = ['token', 'apiKey', 'secret', 'password'];
        sensitiveParams.forEach((param) => {
          if (event.request?.query_string?.includes(param)) {
            event.request.query_string = event.request.query_string.replace(
              new RegExp(`${param}=[^&]*`, 'gi'),
              `${param}=[REDACTED]`
            );
          }
        });
      }
    }

    // Filter out expected errors
    const error = hint.originalException;
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as Error).message;

      // Don't report validation errors (user input issues)
      if (message.includes('ValidationError') || message.includes('Invalid input')) {
        return null;
      }

      // Don't report permission errors (expected behavior)
      if (message.includes('PermissionError') || message.includes('Access denied')) {
        return null;
      }
    }

    return event;
  },
});
