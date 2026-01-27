import type { NextConfig } from 'next';

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
};

export default nextConfig;
