/**
 * Sign In Page
 *
 * Responsibilities:
 * - Provide GitHub OAuth sign-in interface
 * - Display welcoming, joyful branding
 * - Handle sign-in errors gracefully
 * - Redirect to callback URL after successful sign-in
 * - Full accessibility support
 *
 * Architecture:
 * - Server Component (default in App Router)
 * - Uses Auth.js signIn action
 * - Responsive design (mobile-first)
 * - Shadcn/ui components for consistency
 *
 * Design:
 * - Modern, clean, happy aesthetic
 * - Subtle animations for delight
 * - Clear CTAs with visual hierarchy
 */

import { Suspense } from 'react';
import { GitHubSignInButton } from '@/components/auth/GitHubSignInButton';
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
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? '/dashboard';
  const error = params.error;

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
        <Suspense fallback={<SignInCardSkeleton />}>
          <Card className="hover:shadow-3xl border-2 shadow-2xl transition-all duration-300">
            <CardHeader className="space-y-2 text-center">
              {/* Logo/Branding */}
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
                <span className="text-3xl font-bold text-white">PF</span>
              </div>

              <CardTitle className="text-3xl font-bold tracking-tight">
                Welcome to{' '}
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  ProjectFinish
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
                  <span>
                    {error === 'OAuthAccountNotLinked'
                      ? 'This email is already associated with another account.'
                      : error === 'OAuthCallback'
                        ? 'There was an error signing in. Please try again.'
                        : 'An unexpected error occurred. Please try again.'}
                  </span>
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Value propositions */}
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
                    <span className="text-xs">✓</span>
                  </div>
                  <p>Buy unfinished projects and complete them</p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100">
                    <span className="text-xs">✓</span>
                  </div>
                  <p>Sell your incomplete projects to interested developers</p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-purple-100">
                    <span className="text-xs">✓</span>
                  </div>
                  <p>Secure escrow system protects all transactions</p>
                </div>
              </div>

              {/* Sign in button */}
              <GitHubSignInButton callbackUrl={callbackUrl} />

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
        </Suspense>

        {/* Footer tagline */}
        <p className="mt-8 text-center text-sm text-gray-600">
          Join hundreds of developers building better software together
        </p>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for sign-in card
 */
function SignInCardSkeleton() {
  return (
    <Card className="border-2 shadow-2xl">
      <CardHeader className="space-y-2">
        <div className="mx-auto h-16 w-16 animate-pulse rounded-full bg-gray-200" />
        <div className="mx-auto h-8 w-64 animate-pulse rounded bg-gray-200" />
        <div className="mx-auto h-4 w-48 animate-pulse rounded bg-gray-200" />
      </CardHeader>
      <CardContent>
        <div className="h-12 animate-pulse rounded-lg bg-gray-200" />
      </CardContent>
    </Card>
  );
}

/**
 * Metadata for SEO
 */
export const metadata = {
  title: 'Sign In | ProjectFinish',
  description: 'Sign in to ProjectFinish to buy and sell incomplete software projects',
};
