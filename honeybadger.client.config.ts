/**
 * Honeybadger Client Configuration
 *
 * Client-side error monitoring for browser JavaScript
 * Automatically captures unhandled errors and promise rejections
 *
 * @see https://docs.honeybadger.io/lib/javascript/integration/nextjs/
 */

import Honeybadger from '@honeybadger-io/js';

const config = {
  apiKey: process.env['NEXT_PUBLIC_HONEYBADGER_API_KEY'] || '',
  environment: process.env['HONEYBADGER_ENV'] || process.env['NODE_ENV'] || 'development',
  revision: process.env['VERCEL_GIT_COMMIT_SHA'] || 'unknown',

  // Enable error reporting only in production
  reportData: process.env['NODE_ENV'] === 'production',

  // Enable breadcrumbs for better error context
  breadcrumbsEnabled: true,

  // Maximum number of breadcrumbs to keep
  maxBreadcrumbs: 40,

  // Filters - sensitive data to exclude from error reports
  filters: ['password', 'password_confirmation', 'credit_card', 'ssn', 'token', 'api_key', 'secret'],

  // Error fingerprinting for better grouping
  beforeNotify: (notice: any) => {
    // Filter out errors we don't care about
    if (notice.message?.includes('ResizeObserver loop limit exceeded')) {
      return false;
    }

    // Add custom context
    notice.context = {
      ...notice.context,
      user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    };

    return true;
  },
};

// Only configure Honeybadger if API key is present
if (config.apiKey) {
  Honeybadger.configure(config);
  console.log('[Honeybadger] Client error monitoring initialized');
} else {
  console.warn('[Honeybadger] Client error monitoring disabled - no API key');
}

export default Honeybadger;
