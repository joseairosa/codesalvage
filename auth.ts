/**
 * Auth.js v5 - Root-level exports
 *
 * This file re-exports auth helpers from lib/auth.ts
 * to match NextAuth v5 convention of having auth.ts at project root.
 *
 * @see https://authjs.dev/getting-started/installation#setup
 */

export { auth, signIn, signOut, handlers } from '@/lib/auth';
