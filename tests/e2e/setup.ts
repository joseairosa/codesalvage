/**
 * E2E Test Setup
 *
 * Loads environment variables and configures the DB connection for E2E tests.
 *
 * For local runs (default):
 *   - DB  → localhost:5444 (dev Docker container)
 *   - App → http://localhost:3011
 *
 * For production runs:
 *   E2E_BASE_URL=https://codesalvage.com npm run test:e2e:api
 *   - App → https://codesalvage.com
 *   - DB  → production DATABASE_URL (from .env.local or E2E_DATABASE_URL)
 *   - Firebase credentials loaded from .env.local
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../');

// Load .env.local first (highest priority — has Firebase creds & prod DATABASE_URL)
config({ path: path.join(root, '.env.local'), override: false });
// Load .env as fallback (dev defaults)
config({ path: path.join(root, '.env'), override: false });

// Allow explicit override of the database URL for production runs
if (process.env['E2E_DATABASE_URL']) {
  process.env['DATABASE_URL'] = process.env['E2E_DATABASE_URL'];
} else if (!process.env['DATABASE_URL']) {
  // Dev default: Docker postgres
  process.env['DATABASE_URL'] =
    'postgresql://projectfinish:password@localhost:5444/projectfinish';
}

process.env['NODE_ENV'] = 'test';
process.env['NEXT_PUBLIC_APP_URL'] = process.env['E2E_BASE_URL'] ?? 'http://localhost:3011';

console.log('[E2E Setup] Base URL:', process.env['E2E_BASE_URL'] ?? 'http://localhost:3011');
console.log(
  '[E2E Setup] Database:',
  process.env['DATABASE_URL']?.replace(/:[^@]+@/, ':****@')
);
console.log(
  '[E2E Setup] Firebase Admin:',
  process.env['FIREBASE_SERVICE_ACCOUNT_BASE64'] ? 'configured' : 'MISSING'
);
console.log(
  '[E2E Setup] Firebase API Key:',
  process.env['NEXT_PUBLIC_FIREBASE_API_KEY'] ? 'configured' : 'MISSING'
);
