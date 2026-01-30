/**
 * Firebase Client SDK
 *
 * Responsibilities:
 * - Initialize Firebase app (singleton)
 * - Provide auth instance for sign-in/sign-out
 * - Configure auth settings
 *
 * Architecture:
 * - Runs on client-side (browser)
 * - Uses environment variables prefixed with NEXT_PUBLIC_
 * - Singleton pattern to prevent multiple initializations
 * - Follows ataglance pattern for consistency
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env['NEXT_PUBLIC_FIREBASE_API_KEY']!,
  authDomain: process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN']!,
  projectId: process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID']!,
  storageBucket: process.env['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET']!,
  messagingSenderId: process.env['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID']!,
  appId: process.env['NEXT_PUBLIC_FIREBASE_APP_ID']!,
};

// Check if Firebase is configured (may not be during build/CI)
const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

if (!isFirebaseConfigured) {
  console.warn(
    '[Firebase Client] Missing Firebase configuration. Auth features will be unavailable.'
  );
}

// Initialize Firebase (singleton pattern) - only if configured
const app = isFirebaseConfigured
  ? getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApps()[0]
  : null;

// Get Auth instance - only if app is initialized
export const auth = app ? getAuth(app) : (null as unknown as ReturnType<typeof getAuth>);

// Connect to emulator in development (optional)
if (
  app &&
  process.env.NODE_ENV === 'development' &&
  process.env['NEXT_PUBLIC_FIREBASE_EMULATOR'] === 'true'
) {
  console.log('[Firebase Client] Connecting to auth emulator at localhost:9099');
  connectAuthEmulator(auth, 'http://localhost:9099');
}

if (isFirebaseConfigured) {
  console.log('[Firebase Client] Initialized for project:', firebaseConfig.projectId);
}

export default app;
