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
 *
 * Throws descriptive errors when configuration is missing or invalid,
 * so that server logs clearly show what needs to be fixed.
 */
export function getFirebaseAdmin(): admin.app.App {
  if (firebaseAdmin) {
    return firebaseAdmin;
  }

  const serviceAccountBase64 = process.env['FIREBASE_SERVICE_ACCOUNT_BASE64'];
  const serviceAccountPath = process.env['FIREBASE_SERVICE_ACCOUNT_PATH'];
  const projectId = process.env['FIREBASE_PROJECT_ID'];

  console.log('[Firebase Admin] Initializing — env check:', {
    hasProjectId: !!projectId,
    hasBase64Creds: !!serviceAccountBase64,
    base64Length: serviceAccountBase64?.length ?? 0,
    hasFilePath: !!serviceAccountPath,
  });

  if (!projectId) {
    throw new Error(
      '[Firebase Admin] FIREBASE_PROJECT_ID is not set. Add it to your Railway environment variables.'
    );
  }

  if (!serviceAccountBase64 && !serviceAccountPath) {
    throw new Error(
      '[Firebase Admin] No credentials found. Set FIREBASE_SERVICE_ACCOUNT_BASE64 (Railway) or FIREBASE_SERVICE_ACCOUNT_PATH (local).'
    );
  }

  try {
    // Railway/Production: Base64-encoded service account
    if (serviceAccountBase64) {
      let serviceAccountJson: string;
      try {
        serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString(
          'utf-8'
        );
      } catch (decodeError) {
        throw new Error(
          `[Firebase Admin] Failed to base64-decode FIREBASE_SERVICE_ACCOUNT_BASE64: ${decodeError instanceof Error ? decodeError.message : String(decodeError)}`
        );
      }

      let serviceAccount: Record<string, unknown>;
      try {
        serviceAccount = JSON.parse(serviceAccountJson);
      } catch (parseError) {
        throw new Error(
          `[Firebase Admin] FIREBASE_SERVICE_ACCOUNT_BASE64 decoded but is not valid JSON. Check the encoding.`
        );
      }

      // Validate the service account has required fields
      if (!serviceAccount['project_id'] || !serviceAccount['private_key']) {
        throw new Error(
          `[Firebase Admin] Service account JSON is missing required fields (project_id or private_key). Ensure it's a valid Firebase service account.`
        );
      }

      // Warn if project IDs don't match
      if (serviceAccount['project_id'] !== projectId) {
        console.warn(
          `[Firebase Admin] WARNING: FIREBASE_PROJECT_ID="${projectId}" does not match service account project_id="${serviceAccount['project_id']}". This WILL cause token verification failures.`
        );
      }

      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert(
          serviceAccount as admin.ServiceAccount
        ),
        projectId,
      });

      console.log(
        '[Firebase Admin] Initialized with base64 credentials for project:',
        projectId
      );
      return firebaseAdmin;
    }

    // Local: File path to service account
    if (serviceAccountPath) {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));

      firebaseAdmin = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });

      console.log(
        '[Firebase Admin] Initialized with file credentials for project:',
        projectId
      );
      return firebaseAdmin;
    }

    // This shouldn't be reachable due to the check above, but just in case
    throw new Error('[Firebase Admin] No credentials found');
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
