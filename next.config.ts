import type { NextConfig } from 'next';

/**
 * Build-time validation for critical client-side environment variables.
 *
 * NEXT_PUBLIC_ variables are baked into the client JS bundle at build time.
 * If they're missing during `next build`, the deployed app will have null
 * Firebase auth, broken Stripe checkout, etc. — with no way to fix it
 * without rebuilding.
 *
 * This check fails the build early with a clear error message instead of
 * shipping a broken app that crashes at runtime.
 */
function validateBuildEnv() {
  // Only enforce in production builds (Railway sets NODE_ENV=production)
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const requiredClientVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  ];

  const missing = requiredClientVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      '\n[Build] FATAL: Missing required NEXT_PUBLIC_ environment variables:'
    );
    for (const key of missing) {
      console.error(`  - ${key}`);
    }
    console.error('\nThese variables are baked into the client JS bundle at build time.');
    console.error('Set them in your deployment environment BEFORE building.\n');
    process.exit(1);
  }

  // Warn about server-side vars (these are runtime-only, so don't fail the build,
  // but missing them at build time often means they're also missing at runtime)
  const requiredServerVars = [
    'FIREBASE_PROJECT_ID',
    'FIREBASE_SERVICE_ACCOUNT_BASE64',
  ];

  const missingServer = requiredServerVars.filter((key) => !process.env[key]);

  if (missingServer.length > 0) {
    console.warn(
      '\n[Build] WARNING: Missing server-side Firebase environment variables:'
    );
    for (const key of missingServer) {
      console.warn(`  - ${key}`);
    }
    console.warn('These are needed at runtime for Firebase Admin SDK (token verification).');
    console.warn('If they are injected at runtime by your platform, this warning can be ignored.\n');
  }
}

validateBuildEnv();

const nextConfig: NextConfig = {
  /* Performance & Production */
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,

  /* Output for Railway deployment */
  output: 'standalone',

  /* Image optimization */
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        pathname: '/u/**',
      },
      {
        protocol: 'https',
        hostname: '**.r2.dev',
        pathname: '/**',
      },
    ],
  },

  /* Logging */
  logging: {
    fetches: {
      fullUrl: true,
    },
  },

  /* TypeScript */
  typescript: {
    // Fail build on type errors in production
    ignoreBuildErrors: false,
  },

  /* ESLint */
  eslint: {
    // Allow build to succeed with lint warnings (fix later)
    ignoreDuringBuilds: true,
  },

  /* Server-only packages (not bundled by webpack for client) */
  serverExternalPackages: ['firebase-admin'],

  /* Experimental features for Next.js 15 */
  experimental: {
    // Server Actions
    serverActions: {
      bodySizeLimit: '10mb',
      allowedOrigins: [
        'localhost:3011',
        'codesalvage.com',
        'www.codesalvage.com',
        '*.railway.app',
      ],
    },
  },

  /* Turbopack for faster dev builds */
  turbopack: {},

  /* Environment variables that should be available on client */
  env: {
    NEXT_PUBLIC_APP_URL: process.env['NEXT_PUBLIC_APP_URL'] || 'http://localhost:3011',
  },

  /* Security headers */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
