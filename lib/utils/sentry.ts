/**
 * Sentry Utility Functions
 *
 * Helper functions for error reporting and context management
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Capture an exception and report to Sentry
 *
 * @param error - The error to capture
 * @param context - Additional context (user, tags, extra data)
 *
 * @example
 * captureException(new Error('Payment failed'), {
 *   tags: { component: 'checkout', paymentMethod: 'stripe' },
 *   extra: { transactionId: 'txn_123', amount: 5000 }
 * });
 */
export function captureException(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    user?: { id?: string; email?: string; username?: string };
  }
) {
  Sentry.withScope((scope) => {
    // Add tags
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    // Add extra context
    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    // Add user context
    if (context?.user) {
      scope.setUser(context.user);
    }

    Sentry.captureException(error);
  });
}

/**
 * Capture a message (non-error event) to Sentry
 *
 * @param message - The message to capture
 * @param level - Severity level (info, warning, error)
 * @param context - Additional context
 *
 * @example
 * captureMessage('Unusual user behavior detected', 'warning', {
 *   tags: { component: 'fraud-detection' },
 *   extra: { userId: 'user_123', action: 'bulk-purchase' }
 * });
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
) {
  Sentry.withScope((scope) => {
    if (context?.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    if (context?.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }

    Sentry.captureMessage(message, level);
  });
}

/**
 * Set user context for all subsequent error reports
 *
 * @param user - User information to attach to errors
 *
 * @example
 * setUserContext({ id: 'user_123', email: 'user@example.com', username: 'john_doe' });
 */
export function setUserContext(user: {
  id?: string;
  email?: string;
  username?: string;
  [key: string]: unknown;
}) {
  Sentry.setUser(user);
}

/**
 * Clear user context (e.g., on logout)
 *
 * @example
 * clearUserContext(); // Call this when user logs out
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb (activity trail) to help debug errors
 *
 * @param message - Breadcrumb message
 * @param category - Category (e.g., 'auth', 'api', 'ui')
 * @param level - Severity level
 * @param data - Additional data
 *
 * @example
 * addBreadcrumb('User clicked checkout button', 'ui', 'info', { cartTotal: 5000 });
 */
export function addBreadcrumb(
  message: string,
  category?: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, unknown>
) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
  });
}

/**
 * Wrapper for async functions to automatically capture exceptions
 *
 * @param fn - Async function to wrap
 * @param context - Context to attach to any errors
 * @returns Wrapped function
 *
 * @example
 * const safeFetchUser = withErrorCapture(
 *   async (userId: string) => {
 *     const user = await db.user.findUnique({ where: { id: userId } });
 *     return user;
 *   },
 *   { tags: { component: 'user-service' } }
 * );
 */
export function withErrorCapture<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof Error) {
        captureException(error, context);
      }
      throw error;
    }
  }) as T;
}
