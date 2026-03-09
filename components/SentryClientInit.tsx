/**
 * SentryClientInit
 *
 * Initializes the Sentry SDK on the client side.
 *
 * The Sentry webpack plugin normally injects instrumentation-client.ts into the
 * client bundle, but that injection requires SENTRY_AUTH_TOKEN at build time.
 * Without it, _sentryRewritesTunnelPath is set globally but Sentry.init() is
 * never actually called, so no errors are captured.
 *
 * This component is the reliable fallback: it initializes Sentry by importing
 * @sentry/nextjs at module level (client-only, guarded by typeof window check),
 * which runs synchronously when the chunk loads — before React mounts.
 */

'use client';

import * as Sentry from '@sentry/nextjs';

// Guard ensures this only runs in the browser, not during SSR
if (typeof window !== 'undefined') {
  Sentry.init({
    dsn: process.env['NEXT_PUBLIC_SENTRY_DSN'],

    sendDefaultPii: true,

    // 100% in dev, 10% in production
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

    // Session Replay: 10% of all sessions, 100% of sessions with errors
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    enableLogs: true,

    integrations: [Sentry.replayIntegration()],

    // Route Sentry events through our tunnel to bypass ad-blockers
    tunnel: '/monitoring',
  });
}

export function SentryClientInit() {
  return null;
}
