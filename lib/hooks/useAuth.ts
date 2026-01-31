/**
 * useAuth Hook
 *
 * Responsibilities:
 * - Subscribe to Firebase auth state changes
 * - Store Firebase ID token in httpOnly cookie on sign-in
 * - Clear cookie on sign-out
 * - Provide loading state
 *
 * Architecture:
 * - Client-side hook (use client directive)
 * - Syncs Firebase auth state with backend session
 * - Follows ataglance pattern for consistency
 *
 * Usage:
 * const { user, loading, signOut } = useAuth();
 */

'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    console.log('[useAuth] Setting up auth state listener');

    // Guard against null auth (Firebase not configured)
    if (!auth) {
      console.warn('[useAuth] Firebase not configured, skipping auth listener');
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[useAuth] Auth state changed:', user ? user.uid : 'null');
      setUser(user);
      setLoading(false);

      if (user) {
        // Get Firebase ID token and store in httpOnly cookie
        try {
          const idToken = await user.getIdToken();

          console.log('[useAuth] Storing session token for user:', user.uid);

          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });

          console.log('[useAuth] Session created successfully');
        } catch (error) {
          console.error('[useAuth] Failed to create session:', error);
        }
      } else {
        // Clear session cookie
        console.log('[useAuth] Clearing session');
        try {
          await fetch('/api/auth/session', { method: 'DELETE' });
        } catch (error) {
          console.error('[useAuth] Failed to clear session:', error);
        }
      }
    });

    return () => {
      console.log('[useAuth] Cleaning up auth state listener');
      unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.log('[useAuth] Sign out requested');
    try {
      if (auth) {
        await firebaseSignOut(auth);
      }
      await fetch('/api/auth/session', { method: 'DELETE' });
      console.log('[useAuth] Sign out complete, redirecting to home');
      router.push('/');
    } catch (error) {
      console.error('[useAuth] Sign out error:', error);
    }
  };

  return { user, loading, signOut };
}
