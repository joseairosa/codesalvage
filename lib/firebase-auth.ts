/**
 * Firebase Authentication Utilities
 *
 * Responsibilities:
 * - Verify Firebase ID tokens
 * - Verify API keys (sk-xxx format)
 * - Provide unified auth interface for API routes
 * - Auto-create user records on first Firebase sign-in
 *
 * Architecture:
 * - Dual authentication: Firebase tokens OR API keys
 * - Returns standardized auth result with user data
 * - Follows ataglance pattern for consistency
 */

import { getAuth } from './firebase-admin';
import { prisma } from './prisma';
import crypto from 'crypto';

export interface AuthResult {
  user: {
    id: string;
    email: string;
    username: string;
    isAdmin: boolean;
    isSeller: boolean;
    isVerifiedSeller: boolean;
    isBanned: boolean;
  };
  firebaseUid?: string;
  apiKeyId?: string;
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Verify Firebase ID token and return user
 *
 * Error handling separates three failure modes for clear diagnostics:
 * 1. Admin SDK initialization failure (missing env vars, bad credentials)
 * 2. Token verification failure (expired, wrong project, malformed)
 * 3. Database failure (Prisma errors, user creation issues)
 */
export async function verifyFirebaseToken(token: string): Promise<AuthResult> {
  // Step 1: Get Firebase Auth instance (may fail if Admin SDK not configured)
  let authInstance: ReturnType<typeof getAuth>;
  try {
    authInstance = getAuth();
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown initialization error';
    console.error('[Firebase Auth] Admin SDK initialization failed:', msg);
    throw new AuthenticationError(`Firebase Admin SDK not configured: ${msg}`);
  }

  // Step 2: Verify the ID token
  let decodedToken;
  try {
    decodedToken = await authInstance.verifyIdToken(token);
  } catch (error) {
    const firebaseError = error as { code?: string; message?: string };
    console.error('[Firebase Auth] Token verification failed:', {
      code: firebaseError.code,
      message: firebaseError.message,
    });
    throw new AuthenticationError(
      `Token verification failed: ${firebaseError.code ?? firebaseError.message ?? 'unknown error'}`
    );
  }

  const firebaseUid = decodedToken.uid;
  console.log('[Firebase Auth] Token verified for UID:', firebaseUid);

  // Step 3: Find or create user in database
  try {
    let user = await prisma.user.findUnique({
      where: { firebaseUid },
      select: {
        id: true,
        email: true,
        username: true,
        isAdmin: true,
        isSeller: true,
        isVerifiedSeller: true,
        isBanned: true,
      },
    });

    // Auto-create user on first Firebase sign-in (migration support)
    if (!user && decodedToken.email) {
      console.log('[Firebase Auth] Auto-creating user for:', decodedToken.email);

      const email = decodedToken.email!;
      user = await prisma.user.create({
        data: {
          firebaseUid,
          email,
          username: email.split('@')[0] ?? email,
          emailVerified: decodedToken.email_verified ? new Date() : null,
        },
        select: {
          id: true,
          email: true,
          username: true,
          isAdmin: true,
          isSeller: true,
          isVerifiedSeller: true,
          isBanned: true,
        },
      });

      console.log('[Firebase Auth] Auto-created user:', user.id);
    }

    if (!user) {
      throw new AuthenticationError(
        'User not found and could not be auto-created (no email in token)'
      );
    }

    if (user.isBanned) {
      console.warn('[Firebase Auth] Banned user attempted access:', user.id);
      throw new AuthenticationError('User is banned');
    }

    return { user, firebaseUid };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    console.error('[Firebase Auth] Database error during user lookup:', error);
    throw new AuthenticationError(
      `Database error: ${error instanceof Error ? error.message : 'unknown error'}`
    );
  }
}

/**
 * Verify API key (sk-xxx format) and return user
 */
export async function verifyApiKey(key: string): Promise<AuthResult> {
  // Hash the API key (we store SHA-256 hash, never plaintext)
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          isAdmin: true,
          isSeller: true,
          isVerifiedSeller: true,
          isBanned: true,
        },
      },
    },
  });

  if (!apiKey) {
    console.warn('[API Key] Invalid key attempted');
    throw new AuthenticationError('Invalid API key');
  }

  if (apiKey.status !== 'active') {
    console.warn('[API Key] Revoked key attempted:', apiKey.id);
    throw new AuthenticationError('API key is revoked');
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    console.warn('[API Key] Expired key attempted:', apiKey.id);
    throw new AuthenticationError('API key has expired');
  }

  if (apiKey.user.isBanned) {
    console.warn('[API Key] Banned user attempted access via API key:', apiKey.user.id);
    throw new AuthenticationError('User is banned');
  }

  console.log('[API Key] Valid key used:', apiKey.prefix);

  // Update usage tracking (fire and forget)
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    })
    .catch((err) => console.error('[API Key] Usage update error:', err));

  return { user: apiKey.user, apiKeyId: apiKey.id };
}

/**
 * Unified auth verification (Firebase token OR API key)
 *
 * Use this in API routes:
 * const authHeader = request.headers.get('authorization');
 * const auth = await verifyAuth(authHeader);
 */
export async function verifyAuth(authHeader: string | null): Promise<AuthResult> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing Authorization header');
  }

  const token = authHeader.replace('Bearer ', '');

  // API Key authentication (sk-xxx format)
  if (token.startsWith('sk-')) {
    console.log('[Auth] API key authentication attempt');
    return await verifyApiKey(token);
  }

  // Firebase token authentication
  console.log('[Auth] Firebase token authentication attempt');
  return await verifyFirebaseToken(token);
}
