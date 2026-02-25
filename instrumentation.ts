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
    try {
      const { prisma } = await import('@/lib/prisma');
      await prisma.$connect();
      console.log('[Instrumentation] Database connection pre-warmed');
    } catch (error) {
      console.warn('[Instrumentation] Database pre-warm failed (non-fatal):', error);
    }
  }
}
