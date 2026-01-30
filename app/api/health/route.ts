import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getCacheClient } from '@/lib/utils/cache';
import { env } from '@/config/env';

/**
 * Health Check Endpoint
 *
 * Used by Railway healthcheck and monitoring services.
 * Returns 200 OK if the application and critical services are running.
 *
 * GET /api/health - Basic health check (public, for Railway/monitors)
 * GET /api/health?detailed=true - Detailed check (requires CRON_SECRET)
 *
 * Basic Checks:
 * - Database connectivity (PostgreSQL via Prisma)
 * - Application runtime status
 *
 * Detailed Checks (requires auth):
 * - Database latency
 * - Redis connectivity and latency
 * - Stripe configuration
 * - Honeybadger configuration
 * - Postmark configuration
 * - Cloudflare R2 configuration
 * - Auth.js configuration
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const detailed = searchParams.get('detailed') === 'true';

  // If detailed check requested, verify authorization
  if (detailed) {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const expectedAuth = `Bearer ${env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.error('[HealthCheck] Unauthorized detailed health check request');
      return NextResponse.json(
        { error: 'Unauthorized - detailed health checks require authorization' },
        { status: 401 }
      );
    }
  }

  // Basic health check (for Railway/monitoring)
  if (!detailed) {
    const checks = {
      database: false,
    };

    // Check database connectivity
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks['database'] = true;
    } catch (error) {
      console.error('[HealthCheck] Database check failed:', error);
    }

    // Return 503 if database is not healthy (critical dependency)
    if (!checks['database']) {
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

  // Detailed health check (requires authorization)
  console.log('[HealthCheck] Running detailed health check');

  const checks: Record<string, any> = {
    database: { status: 'unhealthy' },
    redis: { status: 'unhealthy' },
    stripe: { status: 'unhealthy', configured: false },
    honeybadger: { status: 'unhealthy', configured: false },
    postmark: { status: 'unhealthy', configured: false },
    cloudflare: { status: 'unhealthy', configured: false },
    auth: { status: 'unhealthy', configured: false },
  };

  // 1. Database Health Check
  try {
    const startDb = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - startDb;

    checks['database'] = {
      status: 'healthy',
      latency: dbLatency,
    };

    console.log(`[HealthCheck] Database: healthy (${dbLatency}ms)`);
  } catch (error) {
    checks['database'] = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    console.error('[HealthCheck] Database check failed:', error);
  }

  // 2. Redis Health Check
  try {
    const startRedis = Date.now();
    const redis = await getCacheClient();
    await redis.ping();
    const redisLatency = Date.now() - startRedis;

    checks['redis'] = {
      status: 'healthy',
      latency: redisLatency,
    };

    console.log(`[HealthCheck] Redis: healthy (${redisLatency}ms)`);
  } catch (error) {
    checks['redis'] = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    console.error('[HealthCheck] Redis check failed:', error);
  }

  // 3. Stripe Configuration Check
  checks['stripe'] = {
    status: env.STRIPE_SECRET_KEY ? 'healthy' : 'unhealthy',
    configured: !!env.STRIPE_SECRET_KEY,
  };

  // 4. Honeybadger Configuration Check
  checks['honeybadger'] = {
    status: env.HONEYBADGER_API_KEY ? 'healthy' : 'unhealthy',
    configured: !!env.HONEYBADGER_API_KEY,
  };

  // 5. Postmark Configuration Check
  checks['postmark'] = {
    status: env.POSTMARK_SERVER_TOKEN ? 'healthy' : 'unhealthy',
    configured: !!env.POSTMARK_SERVER_TOKEN,
  };

  // 6. Cloudflare R2 Configuration Check
  checks['cloudflare'] = {
    status:
      env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME
        ? 'healthy'
        : 'unhealthy',
    configured: !!(
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET_NAME
    ),
  };

  // 7. Auth.js Configuration Check
  checks['auth'] = {
    status:
      env.AUTH_SECRET && env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET
        ? 'healthy'
        : 'unhealthy',
    configured: !!(env.AUTH_SECRET && env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET),
  };

  // Determine overall status
  const unhealthyChecks = Object.values(checks).filter(
    (c: any) => c.status === 'unhealthy'
  );
  const overallStatus =
    unhealthyChecks.length === 0
      ? 'healthy'
      : unhealthyChecks.length <= 2
        ? 'degraded'
        : 'unhealthy';

  console.log('[HealthCheck] Complete:', {
    status: overallStatus,
    unhealthyCount: unhealthyChecks.length,
  });

  // Return appropriate status code
  const statusCode =
    overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 207 : 503;

  return NextResponse.json(
    {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV || 'unknown',
    },
    { status: statusCode }
  );
}
