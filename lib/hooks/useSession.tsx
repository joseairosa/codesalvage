/**
 * useSession Hook (Firebase replacement for next-auth/react)
 *
 * Provides the same interface as next-auth's useSession hook:
 * - { data: session, status }
 * - status: 'loading' | 'authenticated' | 'unauthenticated'
 * - session.user: { id, email, username, isSeller, isVerifiedSeller, isAdmin }
 *
 * Also exports AuthProvider to replace SessionProvider.
 */

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User as FirebaseUser } from 'firebase/auth';
import { auth as firebaseAuth } from '@/lib/firebase';

/**
 * Session user shape - matches what components expect from next-auth
 */
interface SessionUser {
  id: string;
  email: string;
  name?: string;
  username: string;
  isSeller: boolean;
  isVerifiedSeller: boolean;
  isAdmin: boolean;
  isBanned: boolean;
}

/**
 * Session shape - matches next-auth's session
 */
interface Session {
  user: SessionUser;
}

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  data: Session | null;
  status: SessionStatus;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  data: null,
  status: 'loading',
  signOut: async () => {},
});

/**
 * AuthProvider - replaces next-auth's SessionProvider
 *
 * Subscribes to Firebase auth state, syncs session cookie,
 * and fetches database user data.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');

  const fetchUserData = useCallback(async (): Promise<SessionUser | null> => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return null;
      const data = await res.json();
      return data.user || null;
    } catch {
      console.error('[AuthProvider] Failed to fetch user data');
      return null;
    }
  }, []);

  useEffect(() => {
    console.log('[AuthProvider] Setting up auth state listener');

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser: FirebaseUser | null) => {
      console.log('[AuthProvider] Auth state changed:', firebaseUser ? firebaseUser.uid : 'null');

      if (firebaseUser) {
        // Store ID token in httpOnly cookie
        try {
          const idToken = await firebaseUser.getIdToken();

          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });

          // Fetch database user data
          const userData = await fetchUserData();

          if (userData) {
            setSession({
              user: {
                ...userData,
                name: firebaseUser.displayName || userData.email,
              },
            });
            setStatus('authenticated');
            console.log('[AuthProvider] Authenticated:', userData.id);
          } else {
            // User exists in Firebase but not in database yet
            // This can happen on first sign-in before auto-create completes
            setSession(null);
            setStatus('unauthenticated');
            console.log('[AuthProvider] Firebase user exists but no database user');
          }
        } catch (error) {
          console.error('[AuthProvider] Session sync error:', error);
          setSession(null);
          setStatus('unauthenticated');
        }
      } else {
        // Clear session
        try {
          await fetch('/api/auth/session', { method: 'DELETE' });
        } catch {
          // Ignore cleanup errors
        }
        setSession(null);
        setStatus('unauthenticated');
        console.log('[AuthProvider] Unauthenticated');
      }
    });

    return () => {
      console.log('[AuthProvider] Cleaning up auth state listener');
      unsubscribe();
    };
  }, [fetchUserData]);

  const signOut = async () => {
    console.log('[AuthProvider] Sign out requested');
    try {
      await firebaseSignOut(firebaseAuth);
      await fetch('/api/auth/session', { method: 'DELETE' });
      setSession(null);
      setStatus('unauthenticated');
    } catch (error) {
      console.error('[AuthProvider] Sign out error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ data: session, status, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useSession - drop-in replacement for next-auth's useSession
 *
 * Returns { data: session, status } matching the old interface.
 */
export function useSession() {
  return useContext(AuthContext);
}

/**
 * useSignOut - convenience hook for sign out
 */
export function useSignOut() {
  const { signOut } = useContext(AuthContext);
  return signOut;
}
