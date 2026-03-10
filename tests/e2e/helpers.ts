/**
 * E2E Test Helpers
 *
 * Creates test users through the real auth stack (Firebase Admin → session → API key)
 * to prove the full auth pipeline is wired correctly. All role flags and test data
 * are seeded via admin API endpoints — no direct database access.
 *
 * Flow for createE2EUser:
 *   1. Firebase Admin SDK  → createUser() (Firebase user)
 *   2. Firebase Admin SDK  → createCustomToken() → REST API exchange → ID token
 *   3. POST /api/auth/session  (proves session endpoint works)
 *   4. POST /api/user/api-keys (proves API key creation works)
 *   5. PATCH /api/admin/users/:id  (sets isSeller/isAdmin/isVerifiedSeller via admin API)
 *
 * Flow for createE2EProject:
 *   1. POST /api/projects (creates draft — seller must have isSeller: true)
 *   2. POST /api/projects/:id/publish (sets status: active)
 *   Note: isApproved is set to true at creation, so no admin approve step needed.
 *
 * Flow for createE2EDraftProject:
 *   1. POST /api/projects only (returns draft — used for Suite 09 approve/reject tests)
 *
 * Flow for seedTransaction:
 *   POST /api/admin/e2e/seed-transaction (creates completed transaction for reviews)
 *
 * Cleanup (cleanupE2E):
 *   1. DELETE /api/admin/e2e/cleanup  (removes all @e2etest.invalid users + related records)
 *   2. Firebase Admin SDK deletes all e2e_test_* Firebase users
 *
 * Required env vars:
 *   E2E_BASE_URL                    — default: http://localhost:3011
 *   FIREBASE_SERVICE_ACCOUNT_BASE64 — Firebase Admin credentials
 *   NEXT_PUBLIC_FIREBASE_API_KEY    — needed for custom token → ID token exchange
 *   E2E_ADMIN_API_KEY               — API key of a pre-provisioned admin user in production
 *
 * E2E_ADMIN_API_KEY setup:
 *   1. Create or identify an existing admin user on the platform (isAdmin: true)
 *   2. Generate an API key for that user via: POST /api/user/api-keys (name: "E2E Admin Key")
 *   3. Set E2E_ADMIN_API_KEY=<key-value> in Railway environment variables
 *   4. The same key is used for: role setting, transaction seeding, and cleanup
 */

import { faker } from '@faker-js/faker';
import * as admin from 'firebase-admin';

export const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:3011';
export const E2E_PREFIX = 'e2e_test_';
const E2E_EMAIL_DOMAIN = 'e2etest.invalid';

// ─── Admin API Key Guard ──────────────────────────────────────────────────────

if (!process.env['E2E_ADMIN_API_KEY']) {
  throw new Error(
    '[E2E] E2E_ADMIN_API_KEY is not set — see helpers.ts header for setup instructions. ' +
      'This key must belong to an admin user (isAdmin: true) in the target environment.'
  );
}

const ADMIN_API_KEY = process.env['E2E_ADMIN_API_KEY'];

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

// ─── Public API ───────────────────────────────────────────────────────────────

export interface E2EUser {
  id: string;
  email: string;
  username: string;
  apiKey: string;
  /** Raw session cookie, useful for endpoints that require cookie auth */
  sessionCookie: string;
}

/**
 * Create a test user through the real auth stack.
 *
 * User creation and API key creation go through the production API.
 * Role flags (isSeller, isVerifiedSeller, isAdmin) are set via
 * PATCH /api/admin/users/:id using the pre-provisioned E2E_ADMIN_API_KEY.
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

  // 6. Set role flags via admin API
  if (opts?.isSeller || opts?.isVerifiedSeller || opts?.isAdmin) {
    const patchRes = await fetch(`${BASE_URL}/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ADMIN_API_KEY}`,
      },
      body: JSON.stringify({
        isSeller: opts.isSeller,
        isVerifiedSeller: opts.isVerifiedSeller,
        isAdmin: opts.isAdmin,
      }),
    });

    if (!patchRes.ok) {
      const errBody = await patchRes.text();
      throw new Error(
        `[E2E] PATCH /api/admin/users/${id} failed (${patchRes.status}): ${errBody}. ` +
          'Check that E2E_ADMIN_API_KEY belongs to a user with isAdmin: true.'
      );
    }

    const patchBody = (await patchRes.json()) as {
      user: { isSeller: boolean; isAdmin: boolean; isVerifiedSeller: boolean };
    };
    if (opts.isSeller && !patchBody.user.isSeller) {
      throw new Error(
        `[E2E] Failed to set isSeller on user ${id} — check E2E_ADMIN_API_KEY`
      );
    }
    if (opts.isAdmin && !patchBody.user.isAdmin) {
      throw new Error(
        `[E2E] Failed to set isAdmin on user ${id} — check E2E_ADMIN_API_KEY`
      );
    }
    if (opts.isVerifiedSeller && !patchBody.user.isVerifiedSeller) {
      throw new Error(
        `[E2E] Failed to set isVerifiedSeller on user ${id} — check E2E_ADMIN_API_KEY`
      );
    }
  }

  return { id, email, username, apiKey, sessionCookie };
}

/**
 * Create a published (active) E2E project via the API.
 * Seller must have isSeller: true.
 * Projects are auto-approved (isApproved: true) at creation — no admin approve step needed.
 */
export async function createE2EProject(
  sellerApiKey: string
): Promise<{ id: string; status: string; title: string }> {
  const suffix = faker.string.alphanumeric(6).toLowerCase();

  const createRes = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sellerApiKey}`,
    },
    body: JSON.stringify({
      title: `${E2E_PREFIX}Project ${suffix}`,
      description:
        'E2E test project with enough description content to pass validation requirements for a complete project listing on CodeSalvage.',
      category: 'web_app',
      completionPercentage: 75,
      priceCents: 9900,
      techStack: ['React', 'TypeScript'],
      primaryLanguage: 'TypeScript',
      licenseType: 'full_code',
      accessLevel: 'full',
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`[E2E] POST /api/projects failed (${createRes.status}): ${err}`);
  }

  const project = (await createRes.json()) as {
    id: string;
    status: string;
    title: string;
  };

  // Publish the project (sets status: 'active')
  const publishRes = await fetch(`${BASE_URL}/api/projects/${project.id}/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sellerApiKey}`,
    },
    body: JSON.stringify({}),
  });

  if (!publishRes.ok) {
    const err = await publishRes.text();
    throw new Error(
      `[E2E] POST /api/projects/${project.id}/publish failed (${publishRes.status}): ${err}`
    );
  }

  const published = (await publishRes.json()) as {
    id: string;
    status: string;
    title: string;
  };
  return published;
}

/**
 * Create a draft (unpublished) E2E project via the API.
 * Used for Suite 09 admin approve/reject tests.
 * The approve endpoint transitions draft → active, so we must not publish first.
 */
export async function createE2EDraftProject(
  sellerApiKey: string
): Promise<{ id: string; status: string; title: string }> {
  const suffix = faker.string.alphanumeric(6).toLowerCase();

  const createRes = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sellerApiKey}`,
    },
    body: JSON.stringify({
      title: `${E2E_PREFIX}Draft ${suffix}`,
      description:
        'E2E test draft project for admin approve/reject testing on CodeSalvage.',
      category: 'web_app',
      completionPercentage: 75,
      priceCents: 9900,
      techStack: ['Vue', 'JavaScript'],
      primaryLanguage: 'JavaScript',
      licenseType: 'full_code',
      accessLevel: 'full',
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(
      `[E2E] POST /api/projects (draft) failed (${createRes.status}): ${err}`
    );
  }

  return createRes.json() as Promise<{ id: string; status: string; title: string }>;
}

/**
 * Seed a completed transaction for E2E testing (used by the Reviews suite).
 * Requires E2E_SEED_ENABLED=true in the target environment.
 */
export async function seedTransaction(data: {
  projectId: string;
  sellerId: string;
  buyerId: string;
  amountCents: number;
}): Promise<{ id: string; paymentStatus: string; escrowStatus: string }> {
  const res = await fetch(`${BASE_URL}/api/admin/e2e/seed-transaction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ADMIN_API_KEY}`,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      `[E2E] POST /api/admin/e2e/seed-transaction failed (${res.status}): ${err}. ` +
        'Ensure E2E_SEED_ENABLED=true is set in the target environment.'
    );
  }

  const body = (await res.json()) as {
    transaction: { id: string; paymentStatus: string; escrowStatus: string };
  };
  return body.transaction;
}

/**
 * Remove all data created by this E2E test run.
 * Calls the admin cleanup endpoint to delete @e2etest.invalid users and related records,
 * then deletes Firebase users.
 */
export async function cleanupE2E(): Promise<void> {
  // 1. Delete app DB records via admin API
  try {
    const res = await fetch(`${BASE_URL}/api/admin/e2e/cleanup`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ADMIN_API_KEY}` },
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn(`[E2E] Cleanup API returned ${res.status}: ${err}`);
    } else {
      const body = (await res.json()) as { deleted: Record<string, number> };
      console.log('[E2E] Cleanup complete:', body.deleted);
    }
  } catch (err) {
    console.warn('[E2E] Cleanup API call failed:', (err as Error).message);
  }

  // 2. Delete Firebase users with e2e_test_ email prefix
  try {
    const app = getFirebaseAdmin();
    const listResult = await app.auth().listUsers(1000);
    const e2eUids = listResult.users
      .filter((u) => u.email?.startsWith(E2E_PREFIX))
      .map((u) => u.uid);

    if (e2eUids.length > 0) {
      await app.auth().deleteUsers(e2eUids);
      console.log(`[E2E] Deleted ${e2eUids.length} Firebase user(s)`);
    }
  } catch (err) {
    console.warn('[E2E] Firebase user cleanup failed:', err);
  }

  // 3. Clean up the Firebase app instance
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
