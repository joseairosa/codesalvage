/**
 * GitHub Sign In Button Component
 *
 * Responsibilities:
 * - Provide interactive GitHub OAuth sign-in button
 * - Handle sign-in action with loading state
 * - Show GitHub branding and icon
 * - Full accessibility support
 *
 * Architecture:
 * - Client Component (uses onClick handler)
 * - Calls Auth.js signIn() action
 * - Uses Shadcn Button component
 * - Handles loading and error states
 */

'use client';

import { useState } from 'react';
// Auth.js signIn replaced with Firebase - redirects to /auth/signin instead
import { Button } from '@/components/ui/button';
import { Github } from 'lucide-react';

interface GitHubSignInButtonProps {
  callbackUrl?: string;
}

/**
 * GitHub Sign In Button
 */
export function GitHubSignInButton({
  callbackUrl = '/dashboard',
}: GitHubSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    setIsLoading(true);

    try {
      console.log('[GitHubSignInButton] Redirecting to sign-in page');

      // Redirect to Firebase sign-in page
      window.location.href = '/auth/signin';
    } catch (error) {
      console.error('[GitHubSignInButton] Sign-in failed:', error);
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleSignIn}
      disabled={isLoading}
      size="lg"
      className="w-full gap-3 bg-gray-900 text-white transition-all duration-200 hover:scale-[1.02] hover:bg-gray-800 active:scale-[0.98]"
      aria-label="Sign in with GitHub"
    >
      {isLoading ? (
        <>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          <span>Signing in...</span>
        </>
      ) : (
        <>
          <Github className="h-5 w-5" aria-hidden="true" />
          <span>Continue with GitHub</span>
        </>
      )}
    </Button>
  );
}
