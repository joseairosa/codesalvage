/**
 * Honeybadger Error Monitoring Utilities
 *
 * Provides convenient functions for error reporting and monitoring
 * Handles both client-side and server-side error reporting
 *
 * @example
 * import { captureException, captureMessage, setUserContext } from '@/lib/utils/honeybadger';
 *
 * // Capture an exception
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   captureException(error, {
 *     tags: { feature: 'payment' },
 *     context: { amount: 500, userId: 'user123' }
 *   });
 * }
 *
 * // Capture a message
 * captureMessage('Unusual activity detected', 'warning', {
 *   context: { userId: 'user123', attempts: 5 }
 * });
 *
 * // Set user context
 * setUserContext({ id: 'user123', email: 'user@example.com' });
 */

// Dynamic import to handle client/server differences
// require() is necessary here for synchronous conditional loading based on runtime environment
/* eslint-disable @typescript-eslint/no-require-imports */
const getHoneybadger = () => {
  if (typeof window !== 'undefined') {
    // Client-side
    return require('../../honeybadger.client.config').default;
  } else {
    // Server-side
    return require('../../honeybadger.server.config').default;
  }
};
/* eslint-enable @typescript-eslint/no-require-imports */

/**
 * Capture and report an exception to Honeybadger
 *
 * @param error - The error to capture
 * @param context - Additional context (tags, extra data, user info)
 *
 * @example
 * captureException(new Error('Payment failed'), {
 *   tags: { feature: 'payment', severity: 'critical' },
 *   context: { userId: 'user123', amount: 500 },
 * });
 */
export function captureException(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    context?: Record<string, unknown>;
    fingerprint?: string;
  }
) {
  try {
    const Honeybadger = getHoneybadger();

    if (!Honeybadger.apiKey) {
      console.warn('[Honeybadger] API key not configured, error not reported:', error.message);
      return;
    }

    // Build notice options
    const noticeOptions: any = {};

    if (context?.tags) {
      noticeOptions.tags = context.tags;
    }

    if (context?.context) {
      noticeOptions.context = context.context;
    }

    if (context?.fingerprint) {
      noticeOptions.fingerprint = context.fingerprint;
    }

    // Report to Honeybadger
    Honeybadger.notify(error, noticeOptions);

    console.log('[Honeybadger] Error captured:', error.message);
  } catch (err) {
    console.error('[Honeybadger] Failed to capture exception:', err);
  }
}

/**
 * Capture and report a message to Honeybadger
 *
 * @param message - The message to capture
 * @param severity - Severity level (info, warning, error)
 * @param context - Additional context (tags, extra data)
 *
 * @example
 * captureMessage('Unusual login pattern detected', 'warning', {
 *   tags: { feature: 'auth' },
 *   context: { userId: 'user123', attempts: 5 }
 * });
 */
export function captureMessage(
  message: string,
  severity: 'info' | 'warning' | 'error' = 'info',
  context?: {
    tags?: Record<string, string>;
    context?: Record<string, unknown>;
  }
) {
  try {
    const Honeybadger = getHoneybadger();

    if (!Honeybadger.apiKey) {
      console.warn('[Honeybadger] API key not configured, message not reported:', message);
      return;
    }

    // Create a custom error for the message
    const error = new Error(message);
    error.name = `[${severity.toUpperCase()}]`;

    // Build notice options
    const noticeOptions: any = {
      name: error.name,
    };

    if (context?.tags) {
      noticeOptions.tags = context.tags;
    }

    if (context?.context) {
      noticeOptions.context = context.context;
    }

    // Report to Honeybadger
    Honeybadger.notify(error, noticeOptions);

    console.log(`[Honeybadger] Message captured (${severity}):`, message);
  } catch (err) {
    console.error('[Honeybadger] Failed to capture message:', err);
  }
}

/**
 * Set user context for error reports
 *
 * @param user - User information to attach to errors
 *
 * @example
 * setUserContext({
 *   id: 'user123',
 *   email: 'user@example.com',
 *   username: 'john_doe'
 * });
 */
export function setUserContext(user: {
  id?: string;
  email?: string;
  username?: string;
  [key: string]: unknown;
}) {
  try {
    const Honeybadger = getHoneybadger();

    if (!Honeybadger.apiKey) {
      return;
    }

    Honeybadger.setContext({
      user_id: user.id,
      user_email: user.email,
      user_username: user.username,
      ...user,
    });

    console.log('[Honeybadger] User context set:', user.id);
  } catch (err) {
    console.error('[Honeybadger] Failed to set user context:', err);
  }
}

/**
 * Clear user context (e.g., on logout)
 *
 * @example
 * clearUserContext();
 */
export function clearUserContext() {
  try {
    const Honeybadger = getHoneybadger();

    if (!Honeybadger.apiKey) {
      return;
    }

    Honeybadger.clear();

    console.log('[Honeybadger] User context cleared');
  } catch (err) {
    console.error('[Honeybadger] Failed to clear user context:', err);
  }
}

/**
 * Add a breadcrumb for error context
 *
 * Breadcrumbs are events that lead up to an error, helping debug issues
 *
 * @param message - Breadcrumb message
 * @param metadata - Additional metadata
 * @param category - Category (navigation, user_action, api_call, etc.)
 *
 * @example
 * addBreadcrumb('User clicked checkout button', {
 *   cartTotal: 500,
 *   itemCount: 3
 * }, 'user_action');
 */
export function addBreadcrumb(
  message: string,
  metadata?: Record<string, unknown>,
  category: string = 'custom'
) {
  try {
    const Honeybadger = getHoneybadger();

    if (!Honeybadger.apiKey) {
      return;
    }

    Honeybadger.addBreadcrumb(message, {
      metadata,
      category,
    });

    console.log(`[Honeybadger] Breadcrumb added: ${message}`);
  } catch (err) {
    console.error('[Honeybadger] Failed to add breadcrumb:', err);
  }
}

/**
 * Wrap a function to automatically capture errors
 *
 * @param fn - Function to wrap
 * @param context - Additional context to include with errors
 * @returns Wrapped function that reports errors to Honeybadger
 *
 * @example
 * const safePayment = withErrorCapture(
 *   async (userId: string, amount: number) => {
 *     await processPayment(userId, amount);
 *   },
 *   { tags: { feature: 'payment' } }
 * );
 *
 * await safePayment('user123', 500);
 */
export function withErrorCapture<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: {
    tags?: Record<string, string>;
    context?: Record<string, unknown>;
  }
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureException(error as Error, context);
      throw error; // Re-throw so caller can handle it
    }
  }) as T;
}

/**
 * Manually check if Honeybadger is configured
 *
 * @returns True if Honeybadger is configured and ready
 */
export function isHoneybadgerConfigured(): boolean {
  try {
    const Honeybadger = getHoneybadger();
    return !!Honeybadger.apiKey;
  } catch {
    return false;
  }
}
