/**
 * E2E Test Helpers
 *
 * Utilities for creating test users, API keys, and seeding data
 * directly in the dev database. HTTP requests use these API keys
 * for authentication against the running app.
 *
 * All test entities use the `e2e_test_` username prefix so they
 * are easy to identify and clean up.
 */

import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import crypto from 'crypto';

export const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://localhost:3011';
export const E2E_PREFIX = 'e2e_test_';

// Fresh client — avoids importing lib/prisma which pulls in env validation
const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env['DATABASE_URL'] },
  },
});

export interface E2EUser {
  id: string;
  email: string;
  username: string;
  apiKey: string;
}

/**
 * Create a test user with an API key in the dev database.
 */
export async function createE2EUser(opts?: {
  isSeller?: boolean;
  isAdmin?: boolean;
  isVerifiedSeller?: boolean;
  stripeAccountId?: string;
}): Promise<E2EUser> {
  const suffix = faker.string.alphanumeric(8).toLowerCase();
  const username = `${E2E_PREFIX}${suffix}`;

  const user = await prisma.user.create({
    data: {
      email: `${username}@e2etest.invalid`,
      username,
      fullName: `E2E Test ${suffix}`,
      isSeller: opts?.isSeller ?? false,
      isVerifiedSeller: opts?.isVerifiedSeller ?? false,
      isAdmin: opts?.isAdmin ?? false,
      isBuyer: true,
      stripeAccountId: opts?.stripeAccountId ?? null,
      // Unique github_id required by schema unique constraint
      githubId: `e2e_${faker.string.numeric(10)}`,
      githubUsername: username,
    },
  });

  const rawKey = `sk-${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  await prisma.apiKey.create({
    data: {
      userId: user.id,
      name: 'E2E Test Key',
      keyHash,
      prefix: rawKey.substring(0, 11),
      status: 'active',
    },
  });

  return { id: user.id, email: user.email, username: user.username, apiKey: rawKey };
}

/**
 * Remove all data created by this E2E test run.
 * Identified by the `e2e_test_` username prefix.
 */
export async function cleanupE2EData(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { username: { startsWith: E2E_PREFIX } },
    select: { id: true },
  });

  if (users.length === 0) return;

  const ids = users.map((u) => u.id);

  // Delete in FK-safe order
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
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Typed HTTP helper. Returns `{ status, body }`.
 */
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
