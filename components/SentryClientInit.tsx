/**
 * SentryClientInit
 *
 * Initializes the Sentry SDK on the client side.
 *
 * The Sentry webpack plugin normally injects instrumentation-client.ts into the
 * client bundle, but that injection requires SENTRY_AUTH_TOKEN at build time.
 * Without it, _sentryRewritesTunnelPath is set globally but Sentry.init() is
 * never called — so no errors are captured.
 *
 * This component lazy-loads @sentry/nextjs inside useEffect so that:
 * - No server-side import occurs (avoids SSR module side-effects)
 * - Sentry.init() only runs after the component mounts on the client
 * - Pages that don't have NEXT_PUBLIC_SENTRY_DSN configured are skipped
 */

'use client';

import { useEffect } from 'react';

export function SentryClientInit() {
  useEffect(() => {
    // NEXT_PUBLIC_* vars are baked into the bundle at build time.
    // If DSN is absent (CI, local dev without Sentry), skip init entirely.
    const dsn = process.env['NEXT_PUBLIC_SENTRY_DSN'];
    if (!dsn) return;

    import('@sentry/nextjs').then(({ init, replayIntegration }) => {
      init({
        dsn,

        sendDefaultPii: true,

        // 100% in dev, 10% in production
        tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

        // Session Replay: 10% of all sessions, 100% of sessions with errors
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,

        enableLogs: true,

        integrations: [replayIntegration()],

        // Route Sentry events through our tunnel to bypass ad-blockers
        tunnel: '/monitoring',
      });
    });
  }, []);

  return null;
}
