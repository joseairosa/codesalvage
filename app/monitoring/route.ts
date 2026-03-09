/**
 * Sentry Tunnel Route
 *
 * Proxies Sentry envelope requests through this Next.js server so that
 * ad-blockers and privacy tools that block *.ingest.sentry.io don't
 * silently drop error reports.
 *
 * Based on the Sentry tunnel documentation:
 * @see https://docs.sentry.io/platforms/javascript/troubleshooting/#using-the-tunnel-option
 */

import { type NextRequest, NextResponse } from 'next/server';

const SENTRY_INGEST_HOST = 'o4511007994609664.ingest.us.sentry.io';
const SENTRY_PROJECT_ID = '4511009615380480';

export async function POST(request: NextRequest) {
  try {
    const envelope = await request.text();

    // The first line of a Sentry envelope is the envelope header (JSON)
    const envelopeHeader = envelope.split('\n')[0];
    if (!envelopeHeader) {
      return NextResponse.json({ error: 'Invalid envelope' }, { status: 400 });
    }

    let header: { dsn?: string };
    try {
      header = JSON.parse(envelopeHeader) as { dsn?: string };
    } catch {
      return NextResponse.json({ error: 'Malformed envelope header' }, { status: 400 });
    }

    if (!header.dsn) {
      return NextResponse.json(
        { error: 'Missing DSN in envelope header' },
        { status: 400 }
      );
    }

    // Validate the project ID matches our own — prevents this tunnel from
    // being used to proxy envelopes for other Sentry projects
    const dsn = new URL(header.dsn);
    const projectId = dsn.pathname.replace(/^\//, '');
    if (projectId !== SENTRY_PROJECT_ID) {
      return NextResponse.json({ error: 'Invalid project ID' }, { status: 403 });
    }

    const upstreamUrl = `https://${SENTRY_INGEST_HOST}/api/${projectId}/envelope/`;

    const sentryResponse = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('Content-Type') ?? 'text/plain;charset=UTF-8',
      },
      body: envelope,
    });

    return new NextResponse(sentryResponse.body, {
      status: sentryResponse.status,
    });
  } catch (error) {
    console.error('[Sentry Tunnel] Failed to proxy envelope:', error);
    return NextResponse.json({ error: 'Tunnel error' }, { status: 500 });
  }
}
