/**
 * App Providers
 *
 * Client-side providers for the application.
 * Wraps the app with necessary context providers.
 *
 * Responsibilities:
 * - Provide Firebase authentication context
 * - Future: Add other global providers (React Query, etc.)
 */

'use client';

import * as React from 'react';
import { AuthProvider } from '@/lib/hooks/useSession';

interface ProvidersProps {
  children: React.ReactNode;
}

/**
 * Providers component
 *
 * Wraps the application with all necessary providers.
 */
export function Providers({ children }: ProvidersProps) {
  return <AuthProvider>{children}</AuthProvider>;
}
