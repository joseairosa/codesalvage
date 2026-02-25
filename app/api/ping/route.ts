/**
 * Ping Endpoint
 *
 * Ultra-lightweight liveness probe — no database, no auth, no external calls.
 * Used by the Docker HEALTHCHECK to confirm the process is alive and the
 * HTTP server is accepting connections.
 *
 * GET /api/ping → 200 { ok: true }
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ ok: true });
}
