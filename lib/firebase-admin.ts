/**
 * Firebase Admin SDK Initialization
 *
 * Responsibilities:
 * - Initialize Firebase Admin SDK once (singleton pattern)
 * - Support both base64-encoded credentials (Railway) and file path (local)
 * - Provide admin.auth() instance for token verification
 *
 * Architecture:
 * - Singleton pattern to prevent multiple initializations
 * - Environment-aware credential loading
 * - Follows ataglance pattern for consistency
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

let firebaseAdmin: admin.app.App | null = null;

/**
 * Get Firebase Admin instance (singleton)
 */
export function getFirebaseAdmin(): admin.app.App {
  if (firebaseAdmin) {
    return firebaseAdmin;
  }

  const serviceAccountBase64 = process.env['FIREBASE_SERVICE_ACCOUNT_BASE64'];
  const serviceAccountPath = process.env['FIREBASE_SERVICE_ACCOUNT_PATH'];
  const projectId = process.env['FIREBASE_PROJECT_ID'];

  if (!projectId) {
    throw new Error('[Firebase Admin] FIREBASE_PROJECT_ID is required');
  }

  try {
    // Railway/Production: Base64-encoded service account
    if (serviceAccountBase64) {
      const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString(
        'utf-8'
      );
      const serviceAccount = JSON.parse(serviceAccountJson);

      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });

      console.log('[Firebase Admin] Initialized with base64 credentials');
      return firebaseAdmin;
    }

    // Local: File path to service account
    if (serviceAccountPath) {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));

      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });

      console.log('[Firebase Admin] Initialized with file credentials');
      return firebaseAdmin;
    }

    throw new Error(
      '[Firebase Admin] No credentials found (set FIREBASE_SERVICE_ACCOUNT_BASE64 or FIREBASE_SERVICE_ACCOUNT_PATH)'
    );
  } catch (error) {
    console.error('[Firebase Admin] Initialization error:', error);
    throw error;
  }
}

/**
 * Get Firebase Auth instance
 */
export function getAuth(): admin.auth.Auth {
  return getFirebaseAdmin().auth();
}
