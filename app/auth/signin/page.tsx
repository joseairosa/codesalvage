/**
 * Sign In Page (Firebase)
 *
 * Responsibilities:
 * - Provide multi-provider authentication (Email/Password, Magic Link, Google, GitHub)
 * - Display welcoming, joyful branding
 * - Handle sign-in errors gracefully
 * - Redirect to callback URL after successful sign-in
 * - Full accessibility support
 *
 * Architecture:
 * - Client Component (Firebase requires browser APIs)
 * - Uses Firebase Authentication
 * - Responsive design (mobile-first)
 * - Shadcn/ui components for consistency
 * - Follows ataglance pattern for consistency
 *
 * Design:
 * - Modern, clean, happy aesthetic
 * - Subtle animations for delight
 * - Clear CTAs with visual hierarchy
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
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import Image from 'next/image';

/**
 * Sign In Page Component
 */
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

  // Show URL error on mount if present
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

    console.log('[SignIn] Email/Password sign-in attempt for:', email);

    if (!auth) {
      setError('Authentication is not configured. Please contact support.');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('[SignIn] Email/Password sign-in successful, creating session');

      const idToken = await userCredential.user.getIdToken();
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      console.log('[SignIn] Session created, redirecting to:', callbackUrl);
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

    console.log('[SignIn] Magic link sign-in attempt for:', email);

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
      console.log('[SignIn] Magic link sent successfully to:', email);
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

    console.log('[SignIn] Google sign-in attempt');

    if (!auth) {
      setError('Authentication is not configured. Please contact support.');
      setLoading(false);
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      console.log('[SignIn] Google sign-in successful, creating session');

      const idToken = await userCredential.user.getIdToken();
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      console.log('[SignIn] Session created, redirecting to:', callbackUrl);
      router.push(callbackUrl);
    } catch (err: any) {
      console.error('[SignIn] Google sign-in error:', err);
      if (err.code === 'auth/account-exists-with-different-credential') {
        const email = err.customData?.email;
        if (email) {
          setError(
            `This email (${email}) is already linked to a different sign-in method. Please try signing in with GitHub instead.`
          );
        } else {
          setError(
            'This email is already linked to a different sign-in method. Please try signing in with GitHub instead.'
          );
        }
      } else if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup, no error needed
      } else {
        setError(err.message || 'Failed to sign in with Google');
      }
      setLoading(false);
    }
  }

  async function handleGitHubSignIn() {
    setError(null);
    setLoading(true);

    console.log('[SignIn] GitHub sign-in attempt');

    if (!auth) {
      setError('Authentication is not configured. Please contact support.');
      setLoading(false);
      return;
    }

    try {
      const provider = new GithubAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      console.log('[SignIn] GitHub sign-in successful, creating session');

      const idToken = await userCredential.user.getIdToken();
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      console.log('[SignIn] Session created, redirecting to:', callbackUrl);
      router.push(callbackUrl);
    } catch (err: any) {
      console.error('[SignIn] GitHub sign-in error:', err);
      if (err.code === 'auth/account-exists-with-different-credential') {
        const email = err.customData?.email;
        if (email) {
          setError(
            `This email (${email}) is already linked to a different sign-in method. Please try signing in with Google instead.`
          );
        } else {
          setError(
            'This email is already linked to a different sign-in method. Please try signing in with Google instead.'
          );
        }
      } else if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup, no error needed
      } else {
        setError(err.message || 'Failed to sign in with GitHub');
      }
      setLoading(false);
    }
  }

  if (magicLinkSent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Check Your Email</CardTitle>
            <CardDescription>
              We sent a magic link to <strong>{email}</strong>. Click the link to sign in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setMagicLinkSent(false)}
            >
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Side illustration (visible on lg+) */}
      <div className="hidden items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 p-12 lg:flex lg:w-1/2">
        <Image
          src="/images/auth-illustration.png"
          alt="Welcome to CodeSalvage"
          width={600}
          height={400}
          className="max-w-full"
          priority
        />
      </div>

      {/* Sign-in card */}
      <div className="flex w-full items-center justify-center px-4 py-12 sm:px-6 lg:w-1/2 lg:px-8">
        {/* Background decorative elements for "joyful" aesthetic */}
        <div className="absolute inset-0 overflow-hidden lg:hidden">
          <div className="absolute -left-4 top-0 h-72 w-72 animate-blob rounded-full bg-purple-300 opacity-20 mix-blend-multiply blur-xl filter" />
          <div className="animation-delay-2000 absolute -right-4 top-0 h-72 w-72 animate-blob rounded-full bg-yellow-300 opacity-20 mix-blend-multiply blur-xl filter" />
          <div className="animation-delay-4000 absolute -bottom-8 left-20 h-72 w-72 animate-blob rounded-full bg-pink-300 opacity-20 mix-blend-multiply blur-xl filter" />
        </div>

        <div className="relative w-full max-w-md">
          <Card className="hover:shadow-3xl border-2 shadow-2xl transition-all duration-300">
            <CardHeader className="space-y-2 text-center">
              {/* Logo/Branding */}
              <div className="mx-auto mb-4">
                <Image
                  src="/images/logo.png"
                  alt="CodeSalvage"
                  width={64}
                  height={64}
                  className="rounded-full shadow-lg"
                />
              </div>

              <CardTitle className="text-3xl font-bold tracking-tight">
                Welcome to{' '}
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  CodeSalvage
                </span>
              </CardTitle>

              <CardDescription className="text-base text-gray-600">
                The marketplace for incomplete software projects
              </CardDescription>

              {error && (
                <div
                  className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                  role="alert"
                  aria-live="assertive"
                >
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-4">
              {/* OAuth Providers */}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  Continue with Google
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleGitHubSignIn}
                  disabled={loading}
                >
                  Continue with GitHub
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              {/* Email/Password Form */}
              <form onSubmit={handleEmailPasswordSignIn} className="space-y-3">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign in with Email'}
                </Button>
              </form>

              {/* Magic Link */}
              <form onSubmit={handleMagicLinkSignIn}>
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full"
                  disabled={loading || !email}
                >
                  Send Magic Link
                </Button>
              </form>

              <p className="text-center text-xs text-gray-500">
                Don&apos;t have an account?{' '}
                <a href="/auth/signup" className="underline hover:text-gray-700">
                  Sign up
                </a>
              </p>

              {/* Terms and privacy */}
              <p className="text-center text-xs text-gray-500">
                By signing in, you agree to our{' '}
                <a href="/terms" className="underline hover:text-gray-700">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" className="underline hover:text-gray-700">
                  Privacy Policy
                </a>
              </p>
            </CardContent>
          </Card>

          {/* Footer tagline */}
          <p className="mt-8 text-center text-sm text-gray-600">
            Join hundreds of developers building better software together
          </p>
        </div>
      </div>
    </div>
  );
}
