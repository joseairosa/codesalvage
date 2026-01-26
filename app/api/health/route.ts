import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

/**
 * Health Check Endpoint
 *
 * Used by Railway healthcheck and monitoring services.
 * Returns 200 OK if the application and critical services are running.
 *
 * Checks:
 * - Database connectivity (PostgreSQL via Prisma)
 * - Redis connectivity (optional)
 * - Application runtime status
 */
export async function GET() {
  const checks = {
    database: false,
    redis: false,
  };

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (error) {
    console.error('[HealthCheck] Database check failed:', error);
  }

  // Check Redis connectivity (optional, won't fail health check)
  try {
    if (redis) {
      await redis.ping();
      checks.redis = true;
    }
  } catch (error) {
    console.error('[HealthCheck] Redis check failed:', error);
  }

  // Return 503 if database is not healthy (critical dependency)
  if (!checks.database) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        environment: process.env['NODE_ENV'],
        checks,
        message: 'Database connectivity failed',
      },
      { status: 503 }
    );
  }

  // Return 200 if all critical checks pass
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env['NODE_ENV'],
      checks,
    },
    { status: 200 }
  );
}
