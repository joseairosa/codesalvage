# Sentry Error Monitoring Setup

**Comprehensive error tracking and performance monitoring for ProjectFinish.**

---

## Table of Contents

1. [Overview](#overview)
2. [What's Installed](#whats-installed)
3. [Configuration](#configuration)
4. [Environment Variables](#environment-variables)
5. [Usage Examples](#usage-examples)
6. [Error Boundaries](#error-boundaries)
7. [Performance Monitoring](#performance-monitoring)
8. [Testing Sentry](#testing-sentry)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

**Sentry** provides real-time error tracking and performance monitoring for ProjectFinish. When errors occur, Sentry captures:

- Error messages and stack traces
- User context (who experienced the error)
- Breadcrumbs (activity trail leading to error)
- Request data (API calls, URLs, headers)
- Environment information (browser, OS, device)
- Performance metrics (slow API routes, page load times)

### Why Sentry?

- ✅ **Proactive Debugging**: Know about errors before users report them
- ✅ **Context-Rich**: See exactly what the user did before the error
- ✅ **Performance Insights**: Identify slow API routes and pages
- ✅ **Alerting**: Get notified immediately when critical errors occur
- ✅ **Trends**: Track error frequency and patterns over time

---

## What's Installed

### Installed Packages

```json
{
  "dependencies": {
    "@sentry/nextjs": "latest"
  }
}
```

### Configuration Files

```
projectfinish/
├── sentry.client.config.ts      # Client-side (browser) config
├── sentry.server.config.ts      # Server-side (Node.js) config
├── sentry.edge.config.ts        # Edge runtime config
├── instrumentation.ts           # Next.js lifecycle hook
├── next.config.ts               # Updated with Sentry webpack plugin
├── app/
│   └── global-error.tsx         # Global error boundary
└── lib/
    └── utils/
        └── sentry.ts            # Utility functions
```

### Features Enabled

- ✅ **Client-side error tracking** (browser JavaScript errors)
- ✅ **Server-side error tracking** (API routes, SSR)
- ✅ **Edge runtime tracking** (middleware, edge functions)
- ✅ **Session Replay** (10% of sessions, 100% with errors)
- ✅ **Performance monitoring** (10% sample rate in production)
- ✅ **Breadcrumbs** (activity trail before errors)
- ✅ **User context** (attach user info to errors)
- ✅ **Source maps** (hidden from public, uploaded to Sentry)

---

## Configuration

### Client Configuration (Browser)

**File**: `sentry.client.config.ts`

**Key Settings**:
- `tracesSampleRate: 0.1` - Monitor 10% of transactions (performance)
- `replaysSessionSampleRate: 0.1` - Record 10% of sessions
- `replaysOnErrorSampleRate: 1.0` - Record 100% of error sessions
- `enabled: false` in development (don't spam Sentry)

**Privacy**:
- `maskAllText: true` - Mask all text in session replays
- `blockAllMedia: true` - Block images/videos in replays
- Filters out authorization headers, cookies, API keys

### Server Configuration (Node.js)

**File**: `sentry.server.config.ts`

**Key Settings**:
- `tracesSampleRate: 0.1` - Monitor 10% of API transactions
- Filters sensitive data (auth headers, cookies, secrets)
- Excludes expected errors (validation, permissions)

**Privacy**:
- Redacts `authorization`, `cookie` headers
- Removes sensitive query params (`token`, `apiKey`, `password`)
- Filters validation and permission errors (user mistakes, not bugs)

### Edge Configuration

**File**: `sentry.edge.config.ts`

**Key Settings**:
- Lightweight configuration for edge runtime
- Used by middleware and edge API routes

---

## Environment Variables

### Required Variables

**Create a Sentry project**: https://sentry.io/signup/

Add to `.env.local`:

```bash
# Client-side Sentry DSN (public, safe to expose)
NEXT_PUBLIC_SENTRY_DSN="https://YOUR_KEY@o123456.ingest.sentry.io/1234567"

# Server-side Sentry DSN (same value, but not public)
SENTRY_DSN="https://YOUR_KEY@o123456.ingest.sentry.io/1234567"

# Environment (development, staging, production)
NEXT_PUBLIC_ENV="production"
```

### Optional Variables

```bash
# Sentry organization (for uploading source maps)
SENTRY_ORG="your-org-name"

# Sentry project name
SENTRY_PROJECT="projectfinish"

# Auth token for uploading source maps (CI/CD only)
SENTRY_AUTH_TOKEN="your-auth-token"
```

### Railway Configuration

Add environment variables in Railway dashboard:
1. Navigate to your project → Variables
2. Add `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN`
3. Set `NEXT_PUBLIC_ENV` to `production`

---

## Usage Examples

### 1. Basic Error Capture

```typescript
import { captureException } from '@/lib/utils/sentry';

try {
  await dangerousOperation();
} catch (error) {
  captureException(error as Error);
  // Show user-friendly message
  return { error: 'Something went wrong' };
}
```

### 2. Error with Context

```typescript
import { captureException } from '@/lib/utils/sentry';

try {
  await processPayment(userId, amount);
} catch (error) {
  captureException(error as Error, {
    tags: {
      component: 'payment',
      provider: 'stripe',
    },
    extra: {
      userId,
      amount,
      transactionId: 'txn_123',
    },
    user: {
      id: userId,
      email: user.email,
    },
  });

  return { error: 'Payment failed' };
}
```

### 3. Capture Non-Error Events

```typescript
import { captureMessage } from '@/lib/utils/sentry';

// Log unusual behavior
if (purchaseCount > 100) {
  captureMessage('User made unusually large number of purchases', 'warning', {
    tags: { component: 'fraud-detection' },
    extra: { userId, purchaseCount },
  });
}
```

### 4. Add Breadcrumbs

```typescript
import { addBreadcrumb } from '@/lib/utils/sentry';

// Track user actions
function handleCheckout() {
  addBreadcrumb('User clicked checkout button', 'ui', 'info', {
    cartTotal: 5000,
    itemCount: 3,
  });

  // ... checkout logic
}
```

### 5. Set User Context (Auth)

```typescript
import { setUserContext, clearUserContext } from '@/lib/utils/sentry';

// On login
async function handleLogin(user) {
  setUserContext({
    id: user.id,
    email: user.email,
    username: user.username,
  });
}

// On logout
async function handleLogout() {
  clearUserContext();
}
```

### 6. Wrap Async Functions

```typescript
import { withErrorCapture } from '@/lib/utils/sentry';

const fetchUserWithErrorTracking = withErrorCapture(
  async (userId: string) => {
    const user = await db.user.findUnique({ where: { id: userId } });
    return user;
  },
  { tags: { component: 'user-service' } }
);

// Use it
const user = await fetchUserWithErrorTracking('user_123');
```

### 7. API Route Error Handling

```typescript
// app/api/projects/route.ts
import { captureException } from '@/lib/utils/sentry';

export async function GET(request: Request) {
  try {
    const projects = await db.project.findMany();
    return NextResponse.json({ projects });
  } catch (error) {
    console.error('[API] Error fetching projects:', error);

    captureException(error as Error, {
      tags: {
        route: '/api/projects',
        method: 'GET',
      },
    });

    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}
```

---

## Error Boundaries

### Global Error Boundary

**File**: `app/global-error.tsx`

Catches all uncaught errors in the app and displays a user-friendly error page.

**Features**:
- Automatically reports error to Sentry
- Shows error ID (digest) for support reference
- "Try Again" button to reset error boundary
- "Go Home" button to navigate to homepage

### Usage in Components

```typescript
'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
```

---

## Performance Monitoring

### Automatic Monitoring

Sentry automatically tracks:
- ✅ Page load times
- ✅ API route response times
- ✅ Database query performance (via Prisma instrumentation)
- ✅ External API calls (Stripe, SendGrid, etc.)

### Manual Performance Tracking

```typescript
import * as Sentry from '@sentry/nextjs';

const transaction = Sentry.startTransaction({
  op: 'function',
  name: 'processLargeDataset',
});

const span = transaction.startChild({
  op: 'db',
  description: 'Fetch all projects',
});

// Your code here
const projects = await db.project.findMany();

span.finish();
transaction.finish();
```

### Slow API Route Detection

Sentry will alert you if API routes exceed thresholds:
- **Warning**: > 1 second response time
- **Critical**: > 3 seconds response time

**In Sentry Dashboard**:
- Navigate to Performance → Transactions
- Sort by P95 response time
- Identify slowest routes

---

## Testing Sentry

### 1. Test Error Capture (Development)

Create a test endpoint:

```typescript
// app/api/test-sentry/route.ts
import { captureException } from '@/lib/utils/sentry';

export async function GET() {
  // This will be captured in development console
  captureException(new Error('Test error from API route'), {
    tags: { test: 'true' },
  });

  return Response.json({ message: 'Error captured' });
}
```

Visit: `http://localhost:3011/api/test-sentry`

Check console for `[Sentry]` log.

### 2. Test in Production

**Set Environment**:
```bash
NEXT_PUBLIC_ENV=production npm run dev
```

**Trigger Error**:
- Visit your app
- Throw an error (e.g., click a broken button)
- Check Sentry dashboard for new error event

### 3. Verify Environment

```typescript
// Check if Sentry is enabled
console.log('Sentry enabled:', Sentry.isEnabled());
```

---

## Best Practices

### 1. **Don't Over-Report**

**Bad**:
```typescript
// Don't report expected errors
if (!user) {
  captureException(new Error('User not found')); // NO
  return { error: 'User not found' };
}
```

**Good**:
```typescript
// Only report unexpected errors
if (!user) {
  return { error: 'User not found' }; // Expected, not a bug
}

try {
  await processPayment();
} catch (error) {
  captureException(error as Error); // Unexpected failure, report it
  return { error: 'Payment failed' };
}
```

### 2. **Add Context**

**Bad**:
```typescript
captureException(error); // No context
```

**Good**:
```typescript
captureException(error, {
  tags: {
    component: 'checkout',
    step: 'payment-processing',
  },
  extra: {
    userId,
    amount,
    paymentMethod: 'stripe',
  },
});
```

### 3. **Use Breadcrumbs**

Add breadcrumbs for user actions:
```typescript
// On button click
addBreadcrumb('User clicked Buy Now', 'ui', 'info', { projectId });

// Before API call
addBreadcrumb('Fetching project details', 'api', 'info', { projectId });

// After API call
addBreadcrumb('Project details loaded', 'api', 'info', { projectId });
```

### 4. **Set User Context**

Always set user context after login:
```typescript
// In your auth callback
async function onLoginSuccess(user) {
  setUserContext({
    id: user.id,
    email: user.email,
    username: user.username,
  });
}
```

### 5. **Filter Sensitive Data**

Already configured in `sentry.server.config.ts`, but be aware:
- Authorization headers are filtered
- Query params with `token`, `apiKey`, `secret` are redacted
- Cookies are not sent to Sentry

### 6. **Use Error Boundaries**

Add error boundaries for each major feature:
```typescript
// app/seller/dashboard/error.tsx
export default function SellerDashboardError({ error, reset }) {
  // Custom error UI for seller dashboard
}
```

---

## Troubleshooting

### Issue: Errors not appearing in Sentry

**Check**:
1. Is `NEXT_PUBLIC_SENTRY_DSN` set correctly?
2. Is `NEXT_PUBLIC_ENV` set to `production` or `staging` (not `development`)?
3. Check browser console for Sentry initialization logs
4. Verify Sentry project is active (not paused)

**Solution**:
```bash
# In terminal
echo $NEXT_PUBLIC_SENTRY_DSN
echo $NEXT_PUBLIC_ENV

# Should output valid DSN and 'production'
```

### Issue: Too many errors reported

**Cause**: Over-reporting expected errors (validation, auth, permissions)

**Solution**:
- Review `beforeSend` filters in `sentry.*.config.ts`
- Add more error types to ignore list
- Don't capture validation errors or user mistakes

### Issue: Sensitive data in Sentry

**Check**:
- Are you logging passwords, API keys, or tokens in error messages?
- Are you adding sensitive data to `extra` context?

**Solution**:
- Never log sensitive data in error messages
- Review `beforeSend` filters in `sentry.server.config.ts`
- Add more sensitive params to filter list

### Issue: Source maps not uploading

**Cause**: Missing `SENTRY_AUTH_TOKEN` in CI/CD

**Solution**:
```bash
# Generate auth token in Sentry dashboard
# Settings → Developer Settings → Auth Tokens

# Add to Railway or GitHub Actions
SENTRY_AUTH_TOKEN="your-token-here"
SENTRY_ORG="your-org"
SENTRY_PROJECT="projectfinish"
```

---

## Sentry Dashboard

### Key Features

**Issues Tab**:
- View all errors grouped by type
- See error frequency and affected users
- Mark as resolved or ignored

**Performance Tab**:
- View slow transactions
- Identify bottleneck API routes
- Monitor database query performance

**Releases Tab**:
- Track errors by deployment
- Compare error rates between releases
- See which release introduced a bug

**Alerts**:
- Configure alerts for critical errors
- Email or Slack notifications
- Set thresholds (e.g., > 10 errors/hour)

---

## Alerting Configuration (Recommended)

### Critical Alerts

**Setup in Sentry Dashboard**:
1. Navigate to Alerts → Create Alert
2. Configure conditions:
   - **New Issue**: Alert when a new error type appears
   - **High Volume**: Alert when error count > 10/hour
   - **Regression**: Alert when resolved error reappears

**Notification Channels**:
- Email: your-email@example.com
- Slack: #engineering-alerts channel (recommended)

### Example Alert Rules

**Critical Errors**:
- Trigger: Any error in `/api/payments` or `/api/transactions`
- Notify: Immediately via Slack + Email
- Assign: Payment team

**Performance Degradation**:
- Trigger: API route P95 > 3 seconds
- Notify: Daily digest via Email
- Assign: Backend team

---

## Cost Optimization

### Free Tier Limits
- **5,000 errors/month** (usually sufficient)
- **50,000 transactions/month** (performance monitoring)
- **50 replays/month** (session replay)

### Staying Under Limits

**1. Sample Rates**:
- Performance: 10% (already configured)
- Session Replay: 10% (already configured)

**2. Error Filtering**:
- Filter expected errors (validation, auth)
- Ignore noisy errors (browser extensions)

**3. Monitor Usage**:
- Check Sentry dashboard → Stats
- Adjust sample rates if approaching limits

### If You Exceed Limits

**Options**:
- Upgrade to paid plan ($26/month for 50K errors)
- Reduce sample rates (5% instead of 10%)
- Filter more aggressively

---

## Next Steps

1. **Create Sentry Project**: https://sentry.io/signup/
2. **Add Environment Variables**: `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN`
3. **Deploy to Railway**: Push changes, verify Sentry works
4. **Configure Alerts**: Setup critical error alerts
5. **Test Error Capture**: Trigger a test error in production
6. **Monitor Dashboard**: Check Sentry daily for new issues

---

## Resources

- **Sentry Documentation**: https://docs.sentry.io/platforms/javascript/guides/nextjs/
- **Next.js Integration**: https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
- **Performance Monitoring**: https://docs.sentry.io/product/performance/
- **Session Replay**: https://docs.sentry.io/product/session-replay/

---

**Questions?** Email support@projectfinish.com or check Sentry documentation.

**Last Updated**: January 28, 2026
