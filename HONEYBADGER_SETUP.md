# Honeybadger Error Monitoring Setup

**Status**: ✅ CONFIGURED
**Last Updated**: January 28, 2026

---

## Overview

Honeybadger provides error monitoring and uptime tracking for CodeSalvage. It captures unhandled exceptions, promise rejections, and custom error reports from both client-side (browser) and server-side (Node.js) code.

**Why Honeybadger?**
- Simple, developer-friendly error tracking
- Better privacy controls than alternatives
- Excellent Next.js integration
- Affordable pricing for startups
- Fast setup with minimal configuration

---

## Configuration Files

### 1. **honeybadger.client.config.ts**
Client-side (browser) error monitoring configuration.

**Features**:
- Automatic error capture in browser JavaScript
- Breadcrumb tracking for user actions
- Custom error filtering
- User context attachment

**Environment Variables**:
```bash
NEXT_PUBLIC_HONEYBADGER_API_KEY="your-api-key"
HONEYBADGER_ENV="production"
```

### 2. **honeybadger.server.config.ts**
Server-side (Node.js) error monitoring configuration.

**Features**:
- Automatic exception capture in API routes
- Server context (Node version, memory usage)
- Sensitive data filtering
- Custom error handlers

**Environment Variables**:
```bash
HONEYBADGER_API_KEY="your-api-key"
HONEYBADGER_ENV="production"
```

### 3. **lib/utils/honeybadger.ts**
Utility functions for manual error reporting.

**Functions**:
- `captureException(error, context)` - Report errors manually
- `captureMessage(message, severity, context)` - Log messages
- `setUserContext(user)` - Attach user info to errors
- `clearUserContext()` - Clear user info on logout
- `addBreadcrumb(message, metadata, category)` - Track user actions
- `withErrorCapture(fn, context)` - Wrap functions for automatic error capture

### 4. **app/global-error.tsx**
Global error boundary for unhandled errors.

**Features**:
- User-friendly error page
- Automatic error reporting to Honeybadger
- Development-only error details
- Recovery options (Try Again, Go Home)

---

## Setup Instructions

### Step 1: Create Honeybadger Account

1. Go to [honeybadger.io](https://www.honeybadger.io)
2. Sign up for a free account
3. Create a new project: **"CodeSalvage"**
4. Copy your API key

### Step 2: Configure Environment Variables

**Local Development** (`.env.local`):
```bash
# Honeybadger (Error Monitoring)
HONEYBADGER_API_KEY="your-honeybadger-api-key"
NEXT_PUBLIC_HONEYBADGER_API_KEY="your-honeybadger-api-key"
HONEYBADGER_ENV="development"
```

**Production** (Railway):
```bash
# Honeybadger (Error Monitoring)
HONEYBADGER_API_KEY="your-honeybadger-api-key"
NEXT_PUBLIC_HONEYBADGER_API_KEY="your-honeybadger-api-key"
HONEYBADGER_ENV="production"
NODE_ENV="production"
```

### Step 3: Verify Configuration

**Test Client-Side Error Reporting**:
```typescript
// In any client component
'use client';

import { captureException } from '@/lib/utils/honeybadger';

export default function TestButton() {
  const testError = () => {
    try {
      throw new Error('Test client-side error');
    } catch (error) {
      captureException(error as Error, {
        tags: { test: 'true' },
        context: { timestamp: Date.now() }
      });
    }
  };

  return <button onClick={testError}>Test Honeybadger</button>;
}
```

**Test Server-Side Error Reporting**:
```typescript
// In any API route
import { captureException } from '@/lib/utils/honeybadger';

export async function GET(request: Request) {
  try {
    throw new Error('Test server-side error');
  } catch (error) {
    captureException(error as Error, {
      tags: { test: 'true', route: '/api/test' },
    });
    return Response.json({ error: 'Test error' }, { status: 500 });
  }
}
```

**Check Honeybadger Dashboard**:
- Go to your Honeybadger project dashboard
- Navigate to "Errors" tab
- You should see your test errors appear within 1-2 minutes

---

## Usage Examples

### 1. Automatic Error Capture

Honeybadger automatically captures:
- Unhandled exceptions
- Unhandled promise rejections
- React component errors (via error boundaries)

**No code required** - errors are automatically reported!

### 2. Manual Error Reporting

**Capture Exception**:
```typescript
import { captureException } from '@/lib/utils/honeybadger';

try {
  await riskyOperation();
} catch (error) {
  captureException(error as Error, {
    tags: { feature: 'payment', severity: 'critical' },
    context: { userId: 'user123', amount: 500 }
  });
  // Handle error gracefully
}
```

**Capture Message** (for warnings or info):
```typescript
import { captureMessage } from '@/lib/utils/honeybadger';

// Warning about unusual activity
captureMessage('Unusual login pattern detected', 'warning', {
  tags: { feature: 'auth' },
  context: { userId: 'user123', attempts: 5 }
});
```

### 3. User Context

**Set User Context** (on login):
```typescript
import { setUserContext } from '@/lib/utils/honeybadger';

// After successful login
const session = await auth();
if (session?.user) {
  setUserContext({
    id: session.user.id,
    email: session.user.email,
    username: session.user.username,
  });
}
```

**Clear User Context** (on logout):
```typescript
import { clearUserContext } from '@/lib/utils/honeybadger';

// On logout
await signOut();
clearUserContext();
```

### 4. Breadcrumbs

Track user actions leading up to errors:

```typescript
import { addBreadcrumb } from '@/lib/utils/honeybadger';

// User clicked button
addBreadcrumb('User clicked checkout', {
  cartTotal: 500,
  itemCount: 3
}, 'user_action');

// API call made
addBreadcrumb('Fetching user data', {
  userId: 'user123',
  endpoint: '/api/users/user123'
}, 'api_call');

// Navigation
addBreadcrumb('Navigated to dashboard', {
  from: '/projects',
  to: '/dashboard'
}, 'navigation');
```

### 5. Wrap Functions

Automatically capture errors from functions:

```typescript
import { withErrorCapture } from '@/lib/utils/honeybadger';

const processPayment = withErrorCapture(
  async (userId: string, amount: number) => {
    // Payment logic
    await stripe.charges.create({ amount, customer: userId });
  },
  { tags: { feature: 'payment' } }
);

// Errors automatically captured and reported
await processPayment('user123', 500);
```

---

## Integration Points

### API Routes

Add error handling to all API routes:

```typescript
// app/api/projects/route.ts
import { captureException } from '@/lib/utils/honeybadger';

export async function POST(request: Request) {
  try {
    // Your logic
    const project = await createProject(data);
    return Response.json(project);
  } catch (error) {
    captureException(error as Error, {
      tags: { route: '/api/projects', method: 'POST' },
      context: { body: await request.json() }
    });
    return Response.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
```

### Server Actions

```typescript
'use server';

import { captureException } from '@/lib/utils/honeybadger';

export async function createProject(data: FormData) {
  try {
    // Server action logic
    const project = await prisma.project.create({ data });
    return { success: true, project };
  } catch (error) {
    captureException(error as Error, {
      tags: { action: 'createProject' },
      context: { formData: Object.fromEntries(data) }
    });
    return { success: false, error: 'Failed to create project' };
  }
}
```

### React Components

```typescript
'use client';

import { captureException } from '@/lib/utils/honeybadger';

export default function MyComponent() {
  const handleClick = async () => {
    try {
      await someAsyncOperation();
    } catch (error) {
      captureException(error as Error, {
        tags: { component: 'MyComponent' }
      });
      // Show user-friendly error
    }
  };

  return <button onClick={handleClick}>Click Me</button>;
}
```

---

## Best Practices

### 1. **Use Tags for Organization**

Group errors by feature, severity, or component:

```typescript
captureException(error, {
  tags: {
    feature: 'payment',      // Feature area
    severity: 'critical',    // Error severity
    component: 'Checkout',   // Component name
    user_type: 'buyer',      // User type
  }
});
```

### 2. **Add Relevant Context**

Include information that helps debug the error:

```typescript
captureException(error, {
  context: {
    userId: session.user.id,
    projectId: project.id,
    action: 'purchase',
    timestamp: Date.now(),
    // Avoid sensitive data (passwords, tokens, etc.)
  }
});
```

### 3. **Filter Sensitive Data**

Honeybadger is configured to filter:
- `password`, `password_confirmation`
- `credit_card`, `ssn`
- `token`, `api_key`, `secret`
- `stripe_key`, `stripe_secret`
- `github_secret`, `sendgrid_key`

**Never log sensitive data manually!**

### 4. **Use Breadcrumbs Wisely**

Add breadcrumbs for critical user actions:

```typescript
// Good: Important actions
addBreadcrumb('User started checkout', { cartTotal: 500 });
addBreadcrumb('Payment submitted', { amount: 500 });

// Avoid: Too granular
addBreadcrumb('Mouse moved'); // ❌ Too noisy
```

### 5. **Error Fingerprinting**

Group similar errors together:

```typescript
captureException(error, {
  fingerprint: 'payment-stripe-api-error', // Custom grouping
});
```

---

## Monitoring and Alerts

### Honeybadger Dashboard

**Access**: [app.honeybadger.io](https://app.honeybadger.io)

**Key Metrics**:
- Error rate (errors per hour)
- Most common errors
- Affected users
- Error trends over time

**Filters**:
- Environment (development, production)
- Tags (feature, severity, component)
- Time range (last hour, day, week)

### Email Alerts

**Setup**:
1. Go to Project Settings → Notifications
2. Add email addresses for alerts
3. Configure alert rules:
   - New error types
   - Error rate thresholds
   - Critical errors (tagged `severity: critical`)

**Recommended Alerts**:
- Immediate: Errors with `severity: critical` tag
- Daily digest: All errors in production
- Weekly summary: Error trends and top issues

### Slack Integration

**Setup**:
1. Go to Project Settings → Integrations → Slack
2. Connect your Slack workspace
3. Choose channel (#engineering or #alerts)
4. Configure notification rules

**Recommended**:
- Critical errors → #alerts
- All errors → #engineering
- Daily summary → #engineering

---

## Troubleshooting

### Issue: Errors not appearing in Honeybadger

**Check**:
1. Is API key configured?
   ```bash
   echo $HONEYBADGER_API_KEY
   echo $NEXT_PUBLIC_HONEYBADGER_API_KEY
   ```

2. Is `reportData` enabled?
   - Set `NODE_ENV=production` OR
   - Modify config: `reportData: true` (for testing)

3. Check browser console:
   ```
   [Honeybadger] Client error monitoring initialized
   ```

4. Check server logs:
   ```
   [Honeybadger] Server error monitoring initialized
   ```

**Solution**: Verify environment variables and redeploy.

---

### Issue: Too many errors being reported

**Cause**: Noisy errors (ResizeObserver, network errors, etc.)

**Solution**: Add filters in `beforeNotify` callback:

```typescript
// honeybadger.client.config.ts
beforeNotify: (notice: any) => {
  // Filter out ResizeObserver errors
  if (notice.message?.includes('ResizeObserver loop limit exceeded')) {
    return false; // Don't report
  }

  // Filter out network errors
  if (notice.message?.includes('Failed to fetch')) {
    return false;
  }

  return true; // Report all others
},
```

---

### Issue: Missing user context in errors

**Cause**: User context not set on login

**Solution**: Set context after authentication:

```typescript
// After login
const session = await auth();
if (session?.user) {
  setUserContext({
    id: session.user.id,
    email: session.user.email,
    username: session.user.username,
  });
}
```

---

## Performance Impact

**Overhead**: ~1-2ms per error report
**Bundle Size**: ~25KB (client), ~35KB (server)
**Network**: Errors sent asynchronously (non-blocking)

**Recommendation**: Keep Honeybadger enabled in production. The benefits (error visibility) far outweigh the minimal performance cost.

---

## Testing

### Manual Testing

**1. Test Client-Side Error**:
```typescript
// Add to any page
<button onClick={() => { throw new Error('Test error'); }}>
  Trigger Error
</button>
```

**2. Test Server-Side Error**:
```bash
curl http://localhost:3011/api/test-error
```

**3. Verify in Honeybadger**:
- Go to Honeybadger dashboard
- Check "Errors" tab
- Errors should appear within 1-2 minutes

### Automated Testing

**Disable Honeybadger in Tests**:
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    env: {
      HONEYBADGER_API_KEY: '', // Disable in tests
      NODE_ENV: 'test',
    },
  },
});
```

---

## Cost

**Free Tier**:
- 25,000 error events/month
- Unlimited team members
- 30-day error retention

**Recommended Plan** (after launch):
- **Developer Plan**: $49/month
- 125,000 error events/month
- 3-month error retention
- Uptime monitoring

**Estimate**: Should stay within free tier for first 3-6 months.

---

## Resources

- **Honeybadger Docs**: https://docs.honeybadger.io
- **Next.js Integration**: https://docs.honeybadger.io/lib/javascript/integration/nextjs/
- **JavaScript API**: https://docs.honeybadger.io/lib/javascript/
- **Support**: support@honeybadger.io

---

## Checklist

Before launching to production:

- [x] Honeybadger account created
- [x] API keys configured in Railway
- [x] Client-side monitoring tested
- [x] Server-side monitoring tested
- [x] User context integration added (on login)
- [x] Email alerts configured
- [ ] Slack integration setup (optional)
- [x] Error filtering configured
- [x] Global error boundary tested

---

**Last Updated**: January 28, 2026
**Next Review**: March 2026 (post-launch)

---

**Questions?** Check the Honeybadger dashboard or contact support@honeybadger.io
