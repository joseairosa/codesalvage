#!/usr/bin/env tsx
/**
 * Environment Variables Validation Script
 *
 * Validates that all required environment variables are set before deployment.
 * Run this script before deploying to production to catch configuration issues early.
 *
 * Usage:
 *   npm run validate:env
 *   OR
 *   npx tsx scripts/validate-env.ts
 *
 * Exit codes:
 *   0 - All required variables present
 *   1 - Missing required variables
 */

interface EnvVar {
  name: string;
  required: boolean;
  category: string;
  description: string;
  example?: string;
}

const ENV_VARS: EnvVar[] = [
  // Database
  {
    name: 'DATABASE_URL',
    required: true,
    category: 'Database',
    description: 'PostgreSQL connection string',
    example: 'postgresql://user:password@host:5432/dbname',
  },

  // Redis
  {
    name: 'REDIS_URL',
    required: true,
    category: 'Redis',
    description: 'Redis connection string',
    example: 'redis://host:6379',
  },

  // Auth.js
  {
    name: 'AUTH_SECRET',
    required: true,
    category: 'Authentication',
    description: 'Auth.js secret key (generate with: openssl rand -base64 32)',
  },
  {
    name: 'AUTH_GITHUB_ID',
    required: true,
    category: 'Authentication',
    description: 'GitHub OAuth App Client ID',
  },
  {
    name: 'AUTH_GITHUB_SECRET',
    required: true,
    category: 'Authentication',
    description: 'GitHub OAuth App Client Secret',
  },
  {
    name: 'NEXTAUTH_URL',
    required: true,
    category: 'Authentication',
    description: 'Full application URL',
    example: 'https://codesalvage.com',
  },

  // Stripe
  {
    name: 'STRIPE_SECRET_KEY',
    required: true,
    category: 'Payments',
    description: 'Stripe secret key (sk_live_... for production)',
  },
  {
    name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    required: true,
    category: 'Payments',
    description: 'Stripe publishable key (pk_live_... for production)',
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    required: true,
    category: 'Payments',
    description: 'Stripe webhook signing secret (whsec_...)',
  },

  // Cloudflare R2
  {
    name: 'R2_ACCOUNT_ID',
    required: true,
    category: 'Storage',
    description: 'Cloudflare account ID',
  },
  {
    name: 'R2_ACCESS_KEY_ID',
    required: true,
    category: 'Storage',
    description: 'Cloudflare R2 access key ID',
  },
  {
    name: 'R2_SECRET_ACCESS_KEY',
    required: true,
    category: 'Storage',
    description: 'Cloudflare R2 secret access key',
  },
  {
    name: 'R2_BUCKET_NAME',
    required: true,
    category: 'Storage',
    description: 'Cloudflare R2 bucket name',
    example: 'codesalvage-storage',
  },
  {
    name: 'NEXT_PUBLIC_R2_PUBLIC_URL',
    required: true,
    category: 'Storage',
    description: 'Public URL for R2 bucket',
    example: 'https://pub-xxx.r2.dev',
  },

  // Postmark
  {
    name: 'POSTMARK_SERVER_TOKEN',
    required: false,
    category: 'Email',
    description: 'Postmark Server API Token (emails will be logged only if not set)',
  },
  {
    name: 'POSTMARK_FROM_EMAIL',
    required: false,
    category: 'Email',
    description: 'Sender email address',
    example: 'noreply@codesalvage.com',
  },

  // Honeybadger
  {
    name: 'HONEYBADGER_API_KEY',
    required: true,
    category: 'Monitoring',
    description: 'Honeybadger API key (server-side)',
  },
  {
    name: 'NEXT_PUBLIC_HONEYBADGER_API_KEY',
    required: true,
    category: 'Monitoring',
    description: 'Honeybadger API key (client-side)',
  },
  {
    name: 'HONEYBADGER_ENV',
    required: false,
    category: 'Monitoring',
    description: 'Honeybadger environment name',
    example: 'production',
  },

  // Cron Jobs
  {
    name: 'CRON_SECRET',
    required: true,
    category: 'Cron',
    description: 'Secret for authenticating cron job requests',
  },

  // Application
  {
    name: 'NEXT_PUBLIC_APP_URL',
    required: true,
    category: 'Application',
    description: 'Full application URL (for emails, redirects, etc.)',
    example: 'https://codesalvage.com',
  },
  {
    name: 'NODE_ENV',
    required: false,
    category: 'Application',
    description: 'Node environment',
    example: 'production',
  },
];

function validateEnvironment(): {
  valid: boolean;
  missing: EnvVar[];
  present: EnvVar[];
  warnings: string[];
} {
  const missing: EnvVar[] = [];
  const present: EnvVar[] = [];
  const warnings: string[] = [];

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];

    if (!value || value.trim() === '') {
      if (envVar.required) {
        missing.push(envVar);
      } else {
        warnings.push(`Optional variable ${envVar.name} not set`);
      }
    } else {
      present.push(envVar);

      // Additional validation checks
      if (envVar.name === 'DATABASE_URL' && !value.startsWith('postgresql://')) {
        warnings.push('DATABASE_URL should start with postgresql://');
      }

      if (envVar.name === 'REDIS_URL' && !value.startsWith('redis://')) {
        warnings.push('REDIS_URL should start with redis://');
      }

      if (envVar.name === 'STRIPE_SECRET_KEY' && value.startsWith('sk_test_')) {
        warnings.push(
          '⚠️  STRIPE_SECRET_KEY is in TEST mode (sk_test_...). Use sk_live_... for production!'
        );
      }

      if (
        envVar.name === 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY' &&
        value.startsWith('pk_test_')
      ) {
        warnings.push(
          '⚠️  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is in TEST mode (pk_test_...). Use pk_live_... for production!'
        );
      }

      if (envVar.name === 'NODE_ENV' && value !== 'production') {
        warnings.push(
          `⚠️  NODE_ENV is "${value}", should be "production" for production deployments`
        );
      }

      if (envVar.name === 'NEXTAUTH_URL' && value.includes('localhost')) {
        warnings.push(
          '⚠️  NEXTAUTH_URL contains "localhost", should be production domain'
        );
      }

      if (envVar.name === 'NEXT_PUBLIC_APP_URL' && value.includes('localhost')) {
        warnings.push(
          '⚠️  NEXT_PUBLIC_APP_URL contains "localhost", should be production domain'
        );
      }
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    present,
    warnings,
  };
}

function printResults(results: ReturnType<typeof validateEnvironment>) {
  console.log('\n🔍 Environment Variables Validation\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Group by category
  const categories = new Map<string, { present: EnvVar[]; missing: EnvVar[] }>();

  for (const envVar of ENV_VARS) {
    if (!categories.has(envVar.category)) {
      categories.set(envVar.category, { present: [], missing: [] });
    }

    const cat = categories.get(envVar.category)!;
    if (results.present.includes(envVar)) {
      cat.present.push(envVar);
    } else if (results.missing.includes(envVar)) {
      cat.missing.push(envVar);
    }
  }

  // Print by category
  for (const [category, vars] of categories) {
    console.log(`📦 ${category}`);
    console.log('─────────────────────────────────────────────────');

    for (const envVar of vars.present) {
      console.log(`  ✅ ${envVar.name}`);
    }

    for (const envVar of vars.missing) {
      console.log(`  ❌ ${envVar.name} - ${envVar.description}`);
      if (envVar.example) {
        console.log(`     Example: ${envVar.example}`);
      }
    }

    console.log('');
  }

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(
    `✅ Present: ${results.present.length}/${ENV_VARS.filter((v) => v.required).length} required variables`
  );
  console.log(`❌ Missing: ${results.missing.length} required variables\n`);

  // Warnings
  if (results.warnings.length > 0) {
    console.log('⚠️  Warnings:\n');
    for (const warning of results.warnings) {
      console.log(`  ${warning}`);
    }
    console.log('');
  }

  // Final verdict
  if (results.valid && results.warnings.length === 0) {
    console.log('✅ All required environment variables are set!\n');
    console.log('🚀 Ready for deployment\n');
  } else if (results.valid && results.warnings.length > 0) {
    console.log('⚠️  All required variables present, but warnings detected.\n');
    console.log('   Review warnings above before deploying.\n');
  } else {
    console.log('❌ Missing required environment variables!\n');
    console.log('   Set the missing variables before deploying.\n');
  }
}

// Run validation
const results = validateEnvironment();
printResults(results);

// Exit with appropriate code
if (!results.valid) {
  process.exit(1);
}

process.exit(0);
