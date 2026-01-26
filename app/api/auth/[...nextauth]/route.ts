/**
 * Auth.js API Route Handler
 *
 * Handles all authentication routes:
 * - GET /api/auth/signin - Sign in page
 * - POST /api/auth/signin/:provider - Initiate provider sign in
 * - GET /api/auth/callback/:provider - OAuth callback
 * - POST /api/auth/signout - Sign out
 * - GET /api/auth/session - Get current session
 * - GET /api/auth/csrf - Get CSRF token
 * - GET /api/auth/providers - Get configured providers
 *
 * Uses Next.js App Router dynamic route [...nextauth] to catch all auth routes
 */

import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
