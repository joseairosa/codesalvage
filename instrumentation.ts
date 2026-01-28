/**
 * Next.js Instrumentation
 *
 * Hooks into Next.js lifecycle to initialize Sentry monitoring
 * This file is automatically loaded by Next.js on server start
 *
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env['NEXT_RUNTIME'] === 'nodejs') {
    // Server-side instrumentation
    await import('./sentry.server.config');
  }

  if (process.env['NEXT_RUNTIME'] === 'edge') {
    // Edge runtime instrumentation
    await import('./sentry.edge.config');
  }
}
