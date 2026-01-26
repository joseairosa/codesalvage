/**
 * Auth.js v5 Configuration
 *
 * Responsibilities:
 * - Configure NextAuth with GitHub OAuth provider
 * - Setup Prisma adapter for session management
 * - Handle user profile mapping and transformation
 * - Provide auth helpers (signIn, signOut, auth)
 *
 * Architecture:
 * - Uses Auth.js v5 (NextAuth v5) with App Router support
 * - Prisma adapter for database session storage
 * - Custom callbacks for user profile enrichment
 * - Type-safe session data
 *
 * @example
 * import { auth } from '@/lib/auth';
 * const session = await auth();
 */

import NextAuth, { type DefaultSession } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import { UserRepository } from '@/lib/repositories';
import { AuthService, type GitHubProfile } from '@/lib/services';
import { env } from '@/config/env';

/**
 * Extend NextAuth session types with custom user fields
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      username: string | null;
      isSeller: boolean;
      isVerifiedSeller: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    username: string | null;
    isSeller: boolean;
    isVerifiedSeller: boolean;
  }
}

/**
 * Initialize repositories and services for auth callbacks
 */
const userRepository = new UserRepository(prisma);
const authService = new AuthService(userRepository);

/**
 * Auth.js v5 configuration
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),

  providers: [
    GitHub({
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,

      /**
       * Transform GitHub profile to NextAuth user
       * Maps GitHub data to our User model fields
       */
      profile(profile: GitHubProfile) {
        console.log('[Auth] GitHub profile received:', {
          id: profile.id,
          login: profile.login,
          email: profile.email,
        });

        return {
          id: profile.id.toString(),
          email: profile.email,
          emailVerified: null, // GitHub doesn't provide verified status
          name: profile.name,
          image: profile.avatar_url,
          username: profile.login,
          isSeller: false, // Default to non-seller, user can enable later
          isVerifiedSeller: false,
        };
      },
    }),
  ],

  /**
   * Custom pages for auth flows
   */
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/dashboard', // Redirect new users to dashboard
  },

  /**
   * Callbacks for customizing auth behavior
   */
  callbacks: {
    /**
     * JWT callback - runs when JWT is created or updated
     * We don't use JWT strategy (using database sessions), but this runs anyway
     */
    async jwt({ token, user, trigger }) {
      console.log('[Auth] JWT callback triggered:', { trigger });

      if (user) {
        // Initial sign in - add custom fields to token
        token.id = user.id;
        token.username = user.username;
        token.isSeller = user.isSeller;
        token.isVerifiedSeller = user.isVerifiedSeller;
      }

      return token;
    },

    /**
     * Session callback - runs when session is checked
     * Enriches session data with custom user fields
     */
    async session({ session, user }) {
      console.log('[Auth] Session callback called for user:', user.id);

      if (session.user) {
        // Add custom fields to session
        session.user.id = user.id;
        session.user.username = user.username;
        session.user.isSeller = user.isSeller;
        session.user.isVerifiedSeller = user.isVerifiedSeller;

        // Update last login timestamp (non-blocking)
        authService.updateLastLogin(user.id).catch((err) => {
          console.error('[Auth] Failed to update last login:', err);
        });
      }

      return session;
    },

    /**
     * SignIn callback - runs when sign in is attempted
     * Can be used to block sign ins or perform additional checks
     */
    async signIn({ user, account, profile }) {
      console.log('[Auth] SignIn callback:', {
        userId: user.id,
        provider: account?.provider,
      });

      // GitHub OAuth sign in
      if (account?.provider === 'github' && profile) {
        try {
          // Handle GitHub sign in via AuthService
          // This will create or update the user profile
          await authService.handleGitHubSignIn(profile as GitHubProfile);
          return true;
        } catch (error) {
          console.error('[Auth] GitHub sign in failed:', error);
          return false; // Block sign in on error
        }
      }

      return true; // Allow sign in
    },

    /**
     * Redirect callback - runs on redirects
     * Ensures redirects stay within the app domain
     */
    async redirect({ url, baseUrl }) {
      console.log('[Auth] Redirect callback:', { url, baseUrl });

      // Allows relative callback URLs
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }

      // Allows callback URLs on the same origin
      if (new URL(url).origin === baseUrl) {
        return url;
      }

      return baseUrl;
    },
  },

  /**
   * Session strategy - use database sessions (not JWT)
   * This provides better security and allows session revocation
   */
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // Update session every 24 hours
  },

  /**
   * Events - hooks for various auth events
   */
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log('[Auth] Sign in event:', {
        userId: user.id,
        isNewUser,
        provider: account?.provider,
      });

      if (isNewUser) {
        console.log('[Auth] New user registered:', user.email);
        // Could send welcome email here
      }
    },

    async signOut({ session, token }) {
      console.log('[Auth] Sign out event');
    },

    async createUser({ user }) {
      console.log('[Auth] User created:', user.id);
    },

    async linkAccount({ user, account, profile }) {
      console.log('[Auth] Account linked:', {
        userId: user.id,
        provider: account.provider,
      });
    },
  },

  /**
   * Debug mode (development only)
   */
  debug: env.NODE_ENV === 'development',
});
