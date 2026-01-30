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

import { useState, useEffect } from 'react';
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

/**
 * Sign In Page Component
 */
export default function SignInPage() {
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

    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log(
        '[SignIn] Email/Password sign-in successful, redirecting to:',
        callbackUrl
      );
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

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      console.log('[SignIn] Google sign-in successful, redirecting to:', callbackUrl);
      router.push(callbackUrl);
    } catch (err: any) {
      console.error('[SignIn] Google sign-in error:', err);
      setError(err.message || 'Failed to sign in with Google');
      setLoading(false);
    }
  }

  async function handleGitHubSignIn() {
    setError(null);
    setLoading(true);

    console.log('[SignIn] GitHub sign-in attempt');

    try {
      const provider = new GithubAuthProvider();
      await signInWithPopup(auth, provider);
      console.log('[SignIn] GitHub sign-in successful, redirecting to:', callbackUrl);
      router.push(callbackUrl);
    } catch (err: any) {
      console.error('[SignIn] GitHub sign-in error:', err);
      setError(err.message || 'Failed to sign in with GitHub');
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-12 sm:px-6 lg:px-8">
      {/* Background decorative elements for "joyful" aesthetic */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-4 top-0 h-72 w-72 animate-blob rounded-full bg-purple-300 opacity-20 mix-blend-multiply blur-xl filter" />
        <div className="animation-delay-2000 absolute -right-4 top-0 h-72 w-72 animate-blob rounded-full bg-yellow-300 opacity-20 mix-blend-multiply blur-xl filter" />
        <div className="animation-delay-4000 absolute -bottom-8 left-20 h-72 w-72 animate-blob rounded-full bg-pink-300 opacity-20 mix-blend-multiply blur-xl filter" />
      </div>

      {/* Sign-in card */}
      <div className="relative w-full max-w-md">
        <Card className="hover:shadow-3xl border-2 shadow-2xl transition-all duration-300">
          <CardHeader className="space-y-2 text-center">
            {/* Logo/Branding */}
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
              <span className="text-3xl font-bold text-white">CS</span>
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
  );
}
