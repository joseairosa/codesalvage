import { NextResponse } from 'next/server';

/**
 * Health Check Endpoint
 *
 * Used by Docker healthcheck and monitoring services.
 * Returns 200 OK if the application is running.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env['NODE_ENV'],
    },
    { status: 200 }
  );
}
