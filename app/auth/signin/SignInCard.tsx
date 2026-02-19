'use client';

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

interface SignInCardProps {
  loading: boolean;
  error: string | null;
  magicLinkSent: boolean;
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onEmailPasswordSubmit: (e: React.FormEvent) => void;
  onMagicLinkSubmit: (e: React.FormEvent) => void;
  onGoogleSignIn: () => void;
  onGitHubSignIn: () => void;
  onBackToSignIn: () => void;
}

export function SignInCard({
  loading,
  error,
  magicLinkSent,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onEmailPasswordSubmit,
  onMagicLinkSubmit,
  onGoogleSignIn,
  onGitHubSignIn,
  onBackToSignIn,
}: SignInCardProps) {
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
            <Button variant="outline" className="w-full" onClick={onBackToSignIn}>
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
        <div className="absolute inset-0 overflow-hidden lg:hidden">
          <div className="absolute -left-4 top-0 h-72 w-72 animate-blob rounded-full bg-purple-300 opacity-20 mix-blend-multiply blur-xl filter" />
          <div className="animation-delay-2000 absolute -right-4 top-0 h-72 w-72 animate-blob rounded-full bg-yellow-300 opacity-20 mix-blend-multiply blur-xl filter" />
          <div className="animation-delay-4000 absolute -bottom-8 left-20 h-72 w-72 animate-blob rounded-full bg-pink-300 opacity-20 mix-blend-multiply blur-xl filter" />
        </div>

        <div className="relative w-full max-w-md">
          <Card className="hover:shadow-3xl border-2 shadow-2xl transition-all duration-300">
            <CardHeader className="space-y-2 text-center">
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
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onGoogleSignIn}
                  disabled={loading}
                >
                  Continue with Google
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onGitHubSignIn}
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

              <form onSubmit={onEmailPasswordSubmit} className="space-y-3">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => onEmailChange(e.target.value)}
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
                    onChange={(e) => onPasswordChange(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign in with Email'}
                </Button>
              </form>

              <form onSubmit={onMagicLinkSubmit}>
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

          <p className="mt-8 text-center text-sm text-gray-600">
            Join hundreds of developers building better software together
          </p>
        </div>
      </div>
    </div>
  );
}
