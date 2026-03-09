/**
 * E2E Test Setup
 *
 * Configures the database connection for E2E tests.
 * E2E tests write test data directly into the dev DB (port 5444)
 * so that the running app (also on port 5444) can authenticate
 * the API keys we create.
 *
 * The app URL is configurable via E2E_BASE_URL (default: localhost:3011).
 */

// Point Prisma at the dev database — same DB the running Docker app uses
process.env['DATABASE_URL'] =
  process.env['E2E_DATABASE_URL'] ??
  'postgresql://projectfinish:password@localhost:5444/projectfinish';

process.env['NODE_ENV'] = 'test';
process.env['NEXT_PUBLIC_APP_URL'] = process.env['E2E_BASE_URL'] ?? 'http://localhost:3011';

console.log('[E2E Setup] Base URL:', process.env['NEXT_PUBLIC_APP_URL']);
console.log('[E2E Setup] Database:', process.env['DATABASE_URL']?.replace(/:[^@]+@/, ':****@'));
