/**
 * Sign In Page (Firebase)
 *
 * Responsibilities:
 * - Multi-provider authentication (Email/Password, Magic Link, Google, GitHub)
 * - Redirect to callbackUrl if user is already authenticated
 * - Handle sign-in errors gracefully
 *
 * Architecture:
 * - Client Component (Firebase requires browser APIs)
 * - UI extracted to SignInCard to keep this file focused on logic
 */

'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  sendSignInLinkToEmail,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { SignInCard } from './SignInCard';

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';
  const urlError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace(callbackUrl);
      }
    });
    return () => unsubscribe();
  }, [router, callbackUrl]);

  useEffect(() => {
    if (urlError) {
      if (urlError === 'OAuthAccountNotLinked') {
        setError('This email is already associated with another account.');
      } else if (urlError === 'OAuthCallback') {
        setError('There was an error signing in. Please try again.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    }
  }, [urlError]);

  async function handleEmailPasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!auth) {
      setError('Authentication is not configured. Please contact support.');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      router.push(callbackUrl);
    } catch (err: any) {
      console.error('[SignIn] Email/Password sign-in error:', err);
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLinkSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!auth) {
      setError('Authentication is not configured. Please contact support.');
      setLoading(false);
      return;
    }

    try {
      await sendSignInLinkToEmail(auth, email, {
        url: `${window.location.origin}/auth/verify?email=${encodeURIComponent(email)}`,
        handleCodeInApp: true,
      });
      setMagicLinkSent(true);
    } catch (err: any) {
      console.error('[SignIn] Magic link error:', err);
      setError(err.message || 'Failed to send magic link');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);

    if (!auth) {
      setError('Authentication is not configured. Please contact support.');
      setLoading(false);
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const idToken = await userCredential.user.getIdToken();
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      router.push(callbackUrl);
    } catch (err: any) {
      console.error('[SignIn] Google sign-in error:', err);
      if (err.code === 'auth/account-exists-with-different-credential') {
        const linkedEmail = err.customData?.email;
        setError(
          `This email${linkedEmail ? ` (${linkedEmail})` : ''} is already linked to a different sign-in method. Please try signing in with GitHub instead.`
        );
      } else if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Failed to sign in with Google');
      }
      setLoading(false);
    }
  }

  async function handleGitHubSignIn() {
    setError(null);
    setLoading(true);

    if (!auth) {
      setError('Authentication is not configured. Please contact support.');
      setLoading(false);
      return;
    }

    try {
      const provider = new GithubAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const idToken = await userCredential.user.getIdToken();
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      router.push(callbackUrl);
    } catch (err: any) {
      console.error('[SignIn] GitHub sign-in error:', err);
      if (err.code === 'auth/account-exists-with-different-credential') {
        const linkedEmail = err.customData?.email;
        setError(
          `This email${linkedEmail ? ` (${linkedEmail})` : ''} is already linked to a different sign-in method. Please try signing in with Google instead.`
        );
      } else if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Failed to sign in with GitHub');
      }
      setLoading(false);
    }
  }

  return (
    <SignInCard
      loading={loading}
      error={error}
      magicLinkSent={magicLinkSent}
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onEmailPasswordSubmit={handleEmailPasswordSignIn}
      onMagicLinkSubmit={handleMagicLinkSignIn}
      onGoogleSignIn={handleGoogleSignIn}
      onGitHubSignIn={handleGitHubSignIn}
      onBackToSignIn={() => setMagicLinkSent(false)}
    />
  );
}
