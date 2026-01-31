/**
 * Magic Link Verification Page (Firebase)
 *
 * Responsibilities:
 * - Verify email sign-in link
 * - Complete passwordless authentication
 * - Handle verification errors
 * - Redirect to callback URL after successful verification
 *
 * Architecture:
 * - Client Component (Firebase requires browser APIs)
 * - Uses Firebase isSignInWithEmailLink and signInWithEmailLink
 * - Responsive design (mobile-first)
 * - Follows ataglance pattern for consistency
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

/**
 * Magic Link Verification Page Component
 */
export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  );
}

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromUrl = searchParams.get('email') ?? '';

  const [email, setEmail] = useState(emailFromUrl);
  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'prompt'>(
    'verifying'
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Guard against null auth (Firebase not configured)
    if (!auth) {
      setStatus('error');
      setError('Authentication is not configured. Please contact support.');
      return;
    }

    // Check if this is a valid sign-in link
    if (isSignInWithEmailLink(auth, window.location.href)) {
      console.log('[Verify] Valid sign-in link detected');

      // If email is in URL, verify automatically
      if (emailFromUrl) {
        verifyEmail(emailFromUrl);
      } else {
        // Prompt user to enter their email
        console.log('[Verify] Email not in URL, prompting user');
        setStatus('prompt');
      }
    } else {
      console.error('[Verify] Invalid sign-in link');
      setStatus('error');
      setError('This link is invalid or has expired. Please request a new magic link.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailFromUrl]);

  async function verifyEmail(emailToVerify: string) {
    setLoading(true);
    setStatus('verifying');

    console.log('[Verify] Verifying email:', emailToVerify);

    if (!auth) {
      setStatus('error');
      setError('Authentication is not configured. Please contact support.');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailLink(
        auth,
        emailToVerify,
        window.location.href
      );
      console.log('[Verify] Email verified successfully, creating session');

      const idToken = await userCredential.user.getIdToken();
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      console.log('[Verify] Session created');
      setStatus('success');

      // Redirect after short delay to show success message
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err: unknown) {
      console.error('[Verify] Verification error:', err);
      setStatus('error');

      const firebaseErr = err as { code?: string; message?: string };
      if (firebaseErr.code === 'auth/invalid-action-code') {
        setError(
          'This link has expired or has already been used. Please request a new magic link.'
        );
      } else if (firebaseErr.code === 'auth/invalid-email') {
        setError('Invalid email address. Please check and try again.');
      } else {
        setError(firebaseErr.message || 'Failed to verify email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (email) {
      verifyEmail(email);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
            {status === 'verifying' && (
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            )}
            {status === 'success' && <CheckCircle className="h-8 w-8 text-white" />}
            {status === 'error' && <AlertCircle className="h-8 w-8 text-white" />}
            {status === 'prompt' && (
              <span className="text-3xl font-bold text-white">✉</span>
            )}
          </div>

          <CardTitle className="text-center">
            {status === 'verifying' && 'Verifying Your Email'}
            {status === 'success' && 'Email Verified!'}
            {status === 'error' && 'Verification Failed'}
            {status === 'prompt' && 'Confirm Your Email'}
          </CardTitle>

          <CardDescription className="text-center">
            {status === 'verifying' && 'Please wait while we verify your email...'}
            {status === 'success' && 'Redirecting you to your dashboard...'}
            {status === 'error' && error}
            {status === 'prompt' &&
              'Please enter the email address you used to request the magic link'}
          </CardDescription>
        </CardHeader>

        {status === 'prompt' && (
          <CardContent>
            <form onSubmit={handleManualSubmit} className="space-y-4">
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify Email'}
              </Button>
            </form>
          </CardContent>
        )}

        {status === 'error' && (
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/auth/signin')}
            >
              Back to Sign In
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
