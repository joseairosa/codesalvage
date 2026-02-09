/**
 * Environment Variables Configuration
 *
 * Type-safe environment variable access with validation.
 * Throws errors at build time if required variables are missing.
 */

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function getOptionalEnvVar(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}

export const env = {
  // App
  NODE_ENV: getEnvVar('NODE_ENV', 'development'),
  NEXT_PUBLIC_APP_URL: getEnvVar('NEXT_PUBLIC_APP_URL', 'http://localhost:3011'),

  // Public Stripe key (client-side)
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: getOptionalEnvVar(
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'
  ),

  // Database
  DATABASE_URL: getEnvVar(
    'DATABASE_URL',
    'postgresql://codesalvage:password@localhost:5444/codesalvage'
  ),

  // Redis
  REDIS_URL: getEnvVar('REDIS_URL', 'redis://localhost:6390'),

  // Auth (optional during development)
  AUTH_SECRET: getOptionalEnvVar('AUTH_SECRET'),
  AUTH_GITHUB_ID: getOptionalEnvVar('AUTH_GITHUB_ID'),
  AUTH_GITHUB_SECRET: getOptionalEnvVar('AUTH_GITHUB_SECRET'),
  NEXTAUTH_URL: getOptionalEnvVar('NEXTAUTH_URL', 'http://localhost:3011'),

  // Stripe (optional during development)
  STRIPE_SECRET_KEY: getOptionalEnvVar('STRIPE_SECRET_KEY'),
  STRIPE_PUBLISHABLE_KEY: getOptionalEnvVar('STRIPE_PUBLISHABLE_KEY'),
  STRIPE_WEBHOOK_SECRET: getOptionalEnvVar('STRIPE_WEBHOOK_SECRET'),

  // Cloudflare R2 (optional during development)
  R2_ENDPOINT: getOptionalEnvVar('R2_ENDPOINT'),
  R2_ACCESS_KEY_ID: getOptionalEnvVar('R2_ACCESS_KEY_ID'),
  R2_SECRET_ACCESS_KEY: getOptionalEnvVar('R2_SECRET_ACCESS_KEY'),
  R2_BUCKET_NAME: getOptionalEnvVar('R2_BUCKET_NAME'),
  R2_PUBLIC_URL: getOptionalEnvVar('R2_PUBLIC_URL'),

  // Postmark (optional during development)
  POSTMARK_SERVER_TOKEN: getOptionalEnvVar('POSTMARK_SERVER_TOKEN'),
  POSTMARK_FROM_EMAIL: getOptionalEnvVar('POSTMARK_FROM_EMAIL'),

  // Firebase Client SDK (required for auth, baked into client bundle at build time)
  NEXT_PUBLIC_FIREBASE_API_KEY: getOptionalEnvVar('NEXT_PUBLIC_FIREBASE_API_KEY'),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: getOptionalEnvVar('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: getOptionalEnvVar('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: getOptionalEnvVar(
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'
  ),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: getOptionalEnvVar(
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'
  ),
  NEXT_PUBLIC_FIREBASE_APP_ID: getOptionalEnvVar('NEXT_PUBLIC_FIREBASE_APP_ID'),

  // Firebase Admin SDK (server-side)
  FIREBASE_PROJECT_ID: getOptionalEnvVar('FIREBASE_PROJECT_ID'),
  FIREBASE_SERVICE_ACCOUNT_BASE64: getOptionalEnvVar('FIREBASE_SERVICE_ACCOUNT_BASE64'),

  // Honeybadger (Error Monitoring)
  HONEYBADGER_API_KEY: getOptionalEnvVar('HONEYBADGER_API_KEY'),
  NEXT_PUBLIC_HONEYBADGER_API_KEY: getOptionalEnvVar('NEXT_PUBLIC_HONEYBADGER_API_KEY'),
  HONEYBADGER_ENV: getOptionalEnvVar('HONEYBADGER_ENV'),

  // Cron
  CRON_SECRET: getOptionalEnvVar('CRON_SECRET'),

  // Image Generation (script-only, not needed at runtime)
  GEMINI_API_KEY: getOptionalEnvVar('GEMINI_API_KEY'),
} as const;

// Type-safe env check for production
export function validateEnv() {
  if (env.NODE_ENV === 'production') {
    const requiredVars = [
      'DATABASE_URL',
      'REDIS_URL',
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLISHABLE_KEY',
      'R2_ENDPOINT',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'FIREBASE_PROJECT_ID',
    ];

    const missing = requiredVars.filter((key) => !env[key as keyof typeof env]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required production environment variables: ${missing.join(', ')}`
      );
    }
  }
}
