/**
 * E2E Test Helpers
 *
 * Creates test users through the real auth stack (Firebase Admin → session → API key)
 * to prove the full auth pipeline is wired correctly.
 *
 * Flow for createE2EUser:
 *   1. Firebase Admin SDK  → createUser() (Firebase user)
 *   2. Firebase Admin SDK  → createCustomToken() → REST API exchange → ID token
 *   3. POST /api/auth/session  (proves session endpoint works)
 *   4. POST /api/user/api-keys (proves API key creation works)
 *   5. Prisma UPDATE only for role flags (isSeller/isAdmin) — no public API exists
 *
 * Cleanup:
 *   - Firebase Admin SDK deletes all e2e_test_ Firebase users
 *   - Prisma removes all app records created by this run
 *
 * Env vars (from .env.local for production runs):
 *   E2E_BASE_URL                    — default: http://localhost:3011
 *   FIREBASE_SERVICE_ACCOUNT_BASE64 — Firebase Admin credentials
 *   NEXT_PUBLIC_FIREBASE_API_KEY    — needed for custom token → ID token exchange
 *   DATABASE_URL                    — dev DB (local) or prod DB (production run)
 */

import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import crypto from 'crypto';
import * as admin from 'firebase-admin';

export const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:3011';
export const E2E_PREFIX = 'e2e_test_';
const E2E_EMAIL_DOMAIN = 'e2etest.invalid';

// ─── Firebase Admin ──────────────────────────────────────────────────────────

let firebaseApp: admin.app.App | null = null;

function getFirebaseAdmin(): admin.app.App {
  if (firebaseApp) return firebaseApp;

  const b64 = process.env['FIREBASE_SERVICE_ACCOUNT_BASE64'];
  if (!b64) throw new Error('[E2E] FIREBASE_SERVICE_ACCOUNT_BASE64 is not set');

  const serviceAccount = JSON.parse(
    Buffer.from(b64, 'base64').toString('utf8')
  ) as admin.ServiceAccount;

  firebaseApp = admin.initializeApp(
    { credential: admin.credential.cert(serviceAccount) },
    `e2e-${Date.now()}`
  );
  return firebaseApp;
}

/**
 * Exchange a Firebase custom token for a short-lived ID token via the REST API.
 * Requires NEXT_PUBLIC_FIREBASE_API_KEY.
 */
async function customTokenToIdToken(customToken: string): Promise<string> {
  const apiKey = process.env['NEXT_PUBLIC_FIREBASE_API_KEY'];
  if (!apiKey) throw new Error('[E2E] NEXT_PUBLIC_FIREBASE_API_KEY is not set');

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );

  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(`[E2E] Firebase token exchange failed: ${err.error?.message}`);
  }

  const data = (await res.json()) as { idToken: string };
  return data.idToken;
}

/**
 * POST /api/auth/session and return the raw session cookie value.
 */
async function createSessionCookie(idToken: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[E2E] /api/auth/session failed (${res.status}): ${body}`);
  }

  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/session=([^;]+)/);
  if (!match) throw new Error('[E2E] session cookie not found in response');
  return match[1];
}

// ─── Prisma (for role flags & cleanup) ───────────────────────────────────────

// Fresh client — avoids importing lib/prisma which pulls in env validation
const prisma = new PrismaClient({
  datasources: { db: { url: process.env['DATABASE_URL'] } },
});

// ─── Public API ───────────────────────────────────────────────────────────────

export interface E2EUser {
  id: string;
  email: string;
  username: string;
  apiKey: string;
  /** Raw session cookie, useful for endpoints that require cookie auth */
  sessionCookie: string;
  /**
   * True if role flags (isSeller/isAdmin/isVerifiedSeller) were successfully
   * written to the DB. False when the DB is unreachable from this machine
   * (e.g. running against Railway production which uses a private internal URL).
   */
  rolesSet: boolean;
}

/**
 * Create a test user through the real auth stack.
 *
 * User creation and API key creation go through the production API; role flags
 * (isSeller, isVerifiedSeller, isAdmin) are set via direct DB update because
 * no public endpoint exposes them.
 */
export async function createE2EUser(opts?: {
  isSeller?: boolean;
  isAdmin?: boolean;
  isVerifiedSeller?: boolean;
}): Promise<E2EUser> {
  const suffix = faker.string.alphanumeric(8).toLowerCase();
  const email = `${E2E_PREFIX}${suffix}@${E2E_EMAIL_DOMAIN}`;
  const password = `E2eTest${suffix}!`;

  // 1. Create Firebase user
  const app = getFirebaseAdmin();
  const firebaseUser = await app.auth().createUser({
    email,
    password,
    displayName: `E2E Test ${suffix}`,
  });

  // 2. Create custom token → ID token
  const customToken = await app.auth().createCustomToken(firebaseUser.uid);
  const idToken = await customTokenToIdToken(customToken);

  // 3. POST /api/auth/session → session cookie (auto-creates app user in DB)
  const sessionCookie = await createSessionCookie(idToken);

  // 4. GET /api/auth/me to find the app user id
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Cookie: `session=${sessionCookie}` },
  });
  const meBody = (await meRes.json()) as {
    user: { id: string; username: string } | null;
  };
  if (!meBody.user)
    throw new Error('[E2E] /api/auth/me returned no user after session creation');
  const { id, username } = meBody.user;

  // 5. POST /api/user/api-keys → get an API key for Bearer auth
  const apiKeyRes = await fetch(`${BASE_URL}/api/user/api-keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `session=${sessionCookie}`,
    },
    body: JSON.stringify({ name: 'E2E Test Key' }),
  });
  if (!apiKeyRes.ok) {
    const err = await apiKeyRes.text();
    throw new Error(`[E2E] /api/user/api-keys failed (${apiKeyRes.status}): ${err}`);
  }
  const keyBody = (await apiKeyRes.json()) as { apiKey: string };
  const apiKey = keyBody.apiKey;

  // 6. Set role flags via Prisma (no public API for these).
  // Soft-fails when the DB is unreachable (e.g. Railway internal network).
  let rolesSet = false;
  if (opts?.isSeller || opts?.isVerifiedSeller || opts?.isAdmin) {
    try {
      await prisma.user.update({
        where: { id },
        data: {
          isSeller: opts.isSeller ?? false,
          isVerifiedSeller: opts.isVerifiedSeller ?? false,
          isAdmin: opts.isAdmin ?? false,
        },
      });
      rolesSet = true;
    } catch (err) {
      console.warn(
        '[E2E] DB role flags could not be set (DB unreachable from this host). ' +
          'Tests that require specific roles will be skipped.',
        (err as Error).message
      );
    }
  } else {
    rolesSet = true; // No roles needed, consider it "set"
  }

  return { id, email, username, apiKey, sessionCookie, rolesSet };
}

/**
 * Remove all data created by this E2E test run.
 * Deletes Firebase users (by email pattern) and all app DB records.
 */
export async function cleanupE2EData(): Promise<void> {
  // 1. Delete Firebase users with e2e_test_ email prefix
  try {
    const app = getFirebaseAdmin();
    const listResult = await app.auth().listUsers(1000);
    const e2eUids = listResult.users
      .filter((u) => u.email?.startsWith(E2E_PREFIX))
      .map((u) => u.uid);

    if (e2eUids.length > 0) {
      await app.auth().deleteUsers(e2eUids);
    }
  } catch (err) {
    // Non-fatal — app DB cleanup still runs
    console.warn('[E2E] Firebase user cleanup failed:', err);
  }

  // 2. Delete app DB records (FK-safe order).
  // Soft-fails when DB is unreachable (e.g. Railway internal network from localhost).
  try {
    const users = await prisma.user.findMany({
      where: { email: { contains: `@${E2E_EMAIL_DOMAIN}` } },
      select: { id: true },
    });

    if (users.length === 0) return;
    const ids = users.map((u) => u.id);

    await prisma.$executeRawUnsafe('SET session_replication_role = replica;');
    await prisma.message.deleteMany({
      where: { OR: [{ senderId: { in: ids } }, { recipientId: { in: ids } }] },
    });
    await prisma.review.deleteMany({
      where: { OR: [{ buyerId: { in: ids } }, { sellerId: { in: ids } }] },
    });
    await prisma.transaction.deleteMany({
      where: { OR: [{ buyerId: { in: ids } }, { sellerId: { in: ids } }] },
    });
    await prisma.favorite.deleteMany({ where: { userId: { in: ids } } });
    await prisma.project.deleteMany({ where: { sellerId: { in: ids } } });
    await prisma.apiKey.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
  } catch (err) {
    console.warn(
      '[E2E] DB cleanup skipped (DB unreachable from this host). ' +
        'Firebase users were deleted above. App DB records will persist until next railway run cleanup.',
      (err as Error).message
    );
  }
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  // Clean up the Firebase app
  if (firebaseApp) {
    await firebaseApp.delete();
    firebaseApp = null;
  }
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

export async function api(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {}
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  let body: unknown;
  const ct = res.headers.get('content-type') ?? '';
  try {
    body = ct.includes('application/json') ? await res.json() : await res.text();
  } catch {
    body = null;
  }

  return { status: res.status, body };
}

export const get = (path: string, token?: string) => api('GET', path, { token });
export const post = (path: string, body: unknown, token?: string) =>
  api('POST', path, { body, token });
export const patch = (path: string, body: unknown, token?: string) =>
  api('PATCH', path, { body, token });
export const del = (path: string, token?: string) => api('DELETE', path, { token });
