/**
 * Honeybadger Server Configuration
 *
 * Server-side error monitoring for Node.js runtime
 * Automatically captures unhandled exceptions and promise rejections
 *
 * @see https://docs.honeybadger.io/lib/javascript/integration/nextjs/
 */

import Honeybadger from '@honeybadger-io/js';

const config = {
  apiKey: process.env['HONEYBADGER_API_KEY'] || '',
  environment: process.env['HONEYBADGER_ENV'] || process.env['NODE_ENV'] || 'development',
  revision: process.env['VERCEL_GIT_COMMIT_SHA'] || 'unknown',

  // Enable error reporting only in production
  reportData: process.env['NODE_ENV'] === 'production',

  // Enable breadcrumbs for better error context
  breadcrumbsEnabled: true,

  // Maximum number of breadcrumbs to keep
  maxBreadcrumbs: 40,

  // Filters - sensitive data to exclude from error reports
  filters: [
    'password',
    'password_confirmation',
    'credit_card',
    'ssn',
    'token',
    'api_key',
    'secret',
    'stripe_key',
    'stripe_secret',
    'github_secret',
    'sendgrid_key',
  ],

  // Error fingerprinting for better grouping
  beforeNotify: (notice: any) => {
    // Filter out errors we don't care about
    if (notice.message?.includes('ECONNRESET')) {
      // Ignore connection reset errors (normal network issues)
      return false;
    }

    if (notice.message?.includes('ENOTFOUND')) {
      // Log DNS resolution errors but don't spam
      return true;
    }

    // Add custom context for server errors
    notice.context = {
      ...notice.context,
      node_version: process.version,
      platform: process.platform,
      memory_usage: process.memoryUsage(),
    };

    return true;
  },
};

// Only configure Honeybadger if API key is present
if (config.apiKey) {
  Honeybadger.configure(config);
  console.log('[Honeybadger] Server error monitoring initialized');
} else {
  console.warn('[Honeybadger] Server error monitoring disabled - no API key');
}

export default Honeybadger;
