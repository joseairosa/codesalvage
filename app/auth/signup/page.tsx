/**
 * Sign Up Page (Firebase)
 *
 * Responsibilities:
 * - Provide multi-provider registration (Email/Password, Google, GitHub)
 * - Display welcoming, joyful branding
 * - Handle sign-up errors gracefully
 * - Redirect to callback URL after successful sign-up
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

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
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
 * Sign Up Page Component
 */
export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpContent />
    </Suspense>
  );
}

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleEmailPasswordSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    console.log('[SignUp] Email/Password sign-up attempt for:', email);

    if (!auth) {
      setError('Authentication is not configured. Please contact support.');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log('[SignUp] Email/Password sign-up successful, creating session');

      const idToken = await userCredential.user.getIdToken();
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      console.log('[SignUp] Session created, redirecting to:', callbackUrl);
      router.push(callbackUrl);
    } catch (err: any) {
      console.error('[SignUp] Email/Password sign-up error:', err);

      // Provide user-friendly error messages
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Try signing in instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please use a stronger password.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address.');
      } else {
        setError(err.message || 'Failed to create account');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    setError(null);
    setLoading(true);

    console.log('[SignUp] Google sign-up attempt');

    if (!auth) {
      setError('Authentication is not configured. Please contact support.');
      setLoading(false);
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      console.log('[SignUp] Google sign-up successful, creating session');

      const idToken = await userCredential.user.getIdToken();
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      console.log('[SignUp] Session created, redirecting to:', callbackUrl);
      router.push(callbackUrl);
    } catch (err: any) {
      console.error('[SignUp] Google sign-up error:', err);

      if (err.code === 'auth/account-exists-with-different-credential') {
        setError('An account with this email already exists. Try signing in instead.');
      } else {
        setError(err.message || 'Failed to sign up with Google');
      }
      setLoading(false);
    }
  }

  async function handleGitHubSignUp() {
    setError(null);
    setLoading(true);

    console.log('[SignUp] GitHub sign-up attempt');

    if (!auth) {
      setError('Authentication is not configured. Please contact support.');
      setLoading(false);
      return;
    }

    try {
      const provider = new GithubAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      console.log('[SignUp] GitHub sign-up successful, creating session');

      const idToken = await userCredential.user.getIdToken();
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      console.log('[SignUp] Session created, redirecting to:', callbackUrl);
      router.push(callbackUrl);
    } catch (err: any) {
      console.error('[SignUp] GitHub sign-up error:', err);

      if (err.code === 'auth/account-exists-with-different-credential') {
        setError('An account with this email already exists. Try signing in instead.');
      } else {
        setError(err.message || 'Failed to sign up with GitHub');
      }
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4 py-12 sm:px-6 lg:px-8">
      {/* Background decorative elements for "joyful" aesthetic */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-4 top-0 h-72 w-72 animate-blob rounded-full bg-purple-300 opacity-20 mix-blend-multiply blur-xl filter" />
        <div className="animation-delay-2000 absolute -right-4 top-0 h-72 w-72 animate-blob rounded-full bg-yellow-300 opacity-20 mix-blend-multiply blur-xl filter" />
        <div className="animation-delay-4000 absolute -bottom-8 left-20 h-72 w-72 animate-blob rounded-full bg-pink-300 opacity-20 mix-blend-multiply blur-xl filter" />
      </div>

      {/* Sign-up card */}
      <div className="relative w-full max-w-md">
        <Card className="hover:shadow-3xl border-2 shadow-2xl transition-all duration-300">
          <CardHeader className="space-y-2 text-center">
            {/* Logo/Branding */}
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
              <span className="text-3xl font-bold text-white">CS</span>
            </div>

            <CardTitle className="text-3xl font-bold tracking-tight">
              Join{' '}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                CodeSalvage
              </span>
            </CardTitle>

            <CardDescription className="text-base text-gray-600">
              Start buying and selling incomplete projects today
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
                onClick={handleGoogleSignUp}
                disabled={loading}
              >
                Sign up with Google
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleGitHubSignUp}
                disabled={loading}
              >
                Sign up with GitHub
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
            <form onSubmit={handleEmailPasswordSignUp} className="space-y-3">
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
                  minLength={8}
                />
                <p className="mt-1 text-xs text-gray-500">At least 8 characters</p>
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>

            <p className="text-center text-xs text-gray-500">
              Already have an account?{' '}
              <a href="/auth/signin" className="underline hover:text-gray-700">
                Sign in
              </a>
            </p>

            {/* Terms and privacy */}
            <p className="text-center text-xs text-gray-500">
              By signing up, you agree to our{' '}
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
