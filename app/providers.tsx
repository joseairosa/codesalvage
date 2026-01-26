/**
 * App Providers
 *
 * Client-side providers for the application.
 * Wraps the app with necessary context providers.
 *
 * Responsibilities:
 * - Provide NextAuth session context
 * - Future: Add other global providers (React Query, etc.)
 */

'use client';

import * as React from 'react';
import { SessionProvider } from 'next-auth/react';

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Providers component
 *
 * Wraps the application with all necessary providers.
 */
export function Providers({ children }: ProvidersProps) {
  return <SessionProvider>{children}</SessionProvider>;
}
