/**
 * Next.js Instrumentation Hook
 *
 * Runs once when the Next.js server starts (Node.js runtime only).
 * Used to pre-warm the Prisma database connection so the first user
 * request doesn't pay the connection establishment cost (~2-5s).
 *
 * Without this, Prisma's lazy connection means the very first DB query
 * (often from the health check or a page fetch) blocks for several seconds
 * while TCP + SSL + PostgreSQL auth handshakes complete.
 */
export async function register() {
  if (process.env['NEXT_RUNTIME'] === 'nodejs') {
    await import('./sentry.server.config');

    try {
      const { prisma } = await import('@/lib/prisma');
      await prisma.$connect();
      console.log('[Instrumentation] Database connection pre-warmed');
    } catch (error) {
      console.warn('[Instrumentation] Database pre-warm failed (non-fatal):', error);
    }
  }

  if (process.env['NEXT_RUNTIME'] === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Automatically captures all unhandled server-side request errors
export { captureRequestError as onRequestError } from '@sentry/nextjs';
