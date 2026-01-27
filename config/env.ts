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
    'postgresql://projectfinish:password@localhost:5444/projectfinish'
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

  // SendGrid (optional during development)
  SENDGRID_API_KEY: getOptionalEnvVar('SENDGRID_API_KEY'),
  SENDGRID_FROM_EMAIL: getOptionalEnvVar('SENDGRID_FROM_EMAIL'),

  // Cron
  CRON_SECRET: getOptionalEnvVar('CRON_SECRET'),
} as const;

// Type-safe env check for production
export function validateEnv() {
  if (env.NODE_ENV === 'production') {
    const requiredVars = [
      'DATABASE_URL',
      'REDIS_URL',
      'AUTH_SECRET',
      'AUTH_GITHUB_ID',
      'AUTH_GITHUB_SECRET',
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLISHABLE_KEY',
      'R2_ENDPOINT',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
    ];

    const missing = requiredVars.filter((key) => !env[key as keyof typeof env]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required production environment variables: ${missing.join(', ')}`
      );
    }
  }
}
