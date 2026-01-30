# Firebase API Routes Migration Guide

This guide shows how to update existing API routes to support **dual authentication**:

1. **Firebase session tokens** (httpOnly cookies) - for browser requests
2. **API keys** (sk-xxx format) - for programmatic access
3. **Firebase ID tokens** (Authorization header) - for mobile/external apps

## Overview

We've implemented a unified authentication system that supports multiple authentication methods:

- **Browser requests**: Use Firebase session tokens stored in httpOnly cookies (automatically handled)
- **Programmatic access**: Use API keys (`Authorization: Bearer sk-xxx...`)
- **Mobile/External apps**: Use Firebase ID tokens (`Authorization: Bearer <firebase-token>`)

## New Helper Functions

### `authenticateApiRequest(request: Request)`

Located in [`lib/api-auth.ts`](lib/api-auth.ts)

Authenticates API requests using cookies OR Authorization header.

**Returns**: `AuthResult | null`

```typescript
interface AuthResult {
  user: {
    id: string;
    email: string;
    username: string;
    isAdmin: boolean;
    isSeller: boolean;
    isVerifiedSeller: boolean;
    isBanned: boolean;
  };
  firebaseUid?: string; // Present if authenticated via Firebase
  apiKeyId?: string; // Present if authenticated via API key
}
```

### `requireAdminApiAuth(request: Request)`

Located in [`lib/api-auth.ts`](lib/api-auth.ts)

Same as `authenticateApiRequest` but requires admin privileges.

**Returns**: `AuthResult | null` (null if not admin)

## Migration Steps

### Step 1: Replace Auth.js imports

**Before** (Auth.js):

```typescript
import { auth } from '@/auth';
import { requireAdminApi } from '@/lib/auth-helpers';
```

**After** (Firebase):

```typescript
import { authenticateApiRequest, requireAdminApiAuth } from '@/lib/api-auth';
```

### Step 2: Update authentication logic

#### For Regular API Routes (requires any authenticated user)

**Before**:

```typescript
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use session.user.id, session.user.email, etc.
  const userId = session.user.id;
}
```

**After**:

```typescript
export async function POST(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use auth.user.id, auth.user.email, etc.
  const userId = auth.user.id;
}
```

#### For Admin API Routes (requires admin privileges)

**Before**:

```typescript
export async function GET(request: NextRequest) {
  const session = await requireAdminApi();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Admin logic here
}
```

**After**:

```typescript
export async function GET(request: NextRequest) {
  const auth = await requireAdminApiAuth(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Admin logic here
}
```

### Step 3: Update all references from `session` to `auth`

Find and replace throughout the function:

- `session.user.id` → `auth.user.id`
- `session.user.email` → `auth.user.email`
- `session.user.isAdmin` → `auth.user.isAdmin`
- `session.user.isSeller` → `auth.user.isSeller`
- etc.

## Complete Example: Projects API

### Before (Auth.js):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a seller
    if (!session.user.isSeller) {
      return NextResponse.json(
        { error: 'Only sellers can create projects' },
        { status: 403 }
      );
    }

    // Create project
    const project = await projectService.createProject(session.user.id, createData);

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### After (Firebase with Dual Auth):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    // Check authentication (supports both cookie and Authorization header)
    const auth = await authenticateApiRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a seller
    if (!auth.user.isSeller) {
      return NextResponse.json(
        { error: 'Only sellers can create projects' },
        { status: 403 }
      );
    }

    // Create project
    const project = await projectService.createProject(auth.user.id, createData);

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

## Routes Already Updated

✅ [`app/api/admin/projects/route.ts`](app/api/admin/projects/route.ts) - Admin project listing
✅ [`app/api/projects/route.ts`](app/api/projects/route.ts) - Project creation

## Routes That Need Updating

Search for these patterns to find routes that need updating:

```bash
# Find routes using Auth.js
grep -r "from '@/auth'" app/api/

# Find routes using requireAdminApi
grep -r "requireAdminApi" app/api/

# Find routes using auth()
grep -r "await auth()" app/api/
```

Common routes that need updating:

- `/api/messages/*` - Message endpoints
- `/api/favorites/*` - Favorite endpoints
- `/api/admin/*` - Admin endpoints (most already done)
- `/api/projects/[id]/*` - Project management endpoints
- `/api/transactions/*` - Transaction endpoints
- Any route that checks `session.user`

## Testing Dual Authentication

### 1. Browser Requests (Cookie-based)

Browser requests automatically use the Firebase session cookie. No changes needed for frontend.

```typescript
// Client-side code (no changes needed)
const response = await fetch('/api/projects', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(projectData),
});
```

### 2. API Key Requests

For programmatic access, use the `Authorization` header with an API key:

```bash
curl -X GET https://codesalvage.com/api/projects \
  -H "Authorization: Bearer sk-abc123..."
```

```typescript
// Node.js/External app
const response = await fetch('https://codesalvage.com/api/projects', {
  headers: {
    Authorization: 'Bearer sk-abc123...',
    'Content-Type': 'application/json',
  },
});
```

### 3. Firebase Token Requests

For mobile/external apps using Firebase directly:

```typescript
// Mobile app with Firebase SDK
const user = firebase.auth().currentUser;
const token = await user.getIdToken();

const response = await fetch('https://codesalvage.com/api/projects', {
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});
```

## API Key Management

Users can manage their API keys through these endpoints:

- `GET /api/user/api-keys` - List all API keys
- `POST /api/user/api-keys` - Create new API key
  ```json
  {
    "name": "Production API",
    "expiresInDays": 90 // Optional
  }
  ```
- `POST /api/user/api-keys/[keyId]/revoke` - Revoke an API key
  ```json
  {
    "reason": "Compromised key" // Optional
  }
  ```

## Benefits of Dual Authentication

1. **Backward Compatible**: Existing browser-based auth continues to work
2. **Programmatic Access**: External tools can use API keys
3. **Mobile Apps**: Apps can use Firebase tokens directly
4. **Security**: API keys are hashed (SHA-256), never stored in plaintext
5. **Audit Trail**: Track usage via `lastUsedAt` and `usageCount` fields
6. **Flexible Expiration**: API keys can have expiration dates
7. **Easy Revocation**: Keys can be revoked instantly

## Common Issues

### Issue: "Unauthorized" even though user is signed in

**Cause**: Route still using old Auth.js `auth()` function

**Fix**: Update to use `authenticateApiRequest(request)`

### Issue: API key not working

**Checklist**:

1. Is the Authorization header present? `Authorization: Bearer sk-xxx`
2. Is the API key active? Check `status` field in database
3. Has the API key expired? Check `expiresAt` field
4. Is the user banned? Check `isBanned` field

### Issue: Admin route returns 401

**Cause**: Using `authenticateApiRequest` instead of `requireAdminApiAuth`

**Fix**: Use `requireAdminApiAuth(request)` for admin-only routes

## Next Steps

1. ✅ Update all routes to support dual authentication
2. Create API key management UI (dashboard)
3. Add rate limiting per API key
4. Add API key scopes/permissions (read-only, write, admin)
5. Add API key usage analytics

## Questions?

If you encounter any issues or have questions about migrating a specific route, refer to:

- [`lib/api-auth.ts`](lib/api-auth.ts) - Authentication helper implementation
- [`lib/firebase-auth.ts`](lib/firebase-auth.ts) - Dual auth verification logic
- [`app/api/user/api-keys/route.ts`](app/api/user/api-keys/route.ts) - API key management example
