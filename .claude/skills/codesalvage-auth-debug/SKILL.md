---
name: codesalvage-auth-debug
description: |
  Debug authentication failures in CodeSalvage. Use when: (1) users report
  page errors like "Failed to load" on authenticated pages after a deploy,
  (2) API routes return 401 unexpectedly, (3) session cookie changes break
  existing logins, (4) auth migration issues between Firebase and Auth.js.
author: Claude Code
version: 1.0.0
---

# Auth Debugging in CodeSalvage

## Problem

Authentication failures surface as misleading page-level errors ("Failed to load purchases", "Failed to load messages") rather than clear auth errors. The dual auth system (cookies + Authorization header) with an ongoing Firebase migration makes root cause non-obvious.

## Context / Trigger Conditions

- User reports a page error after a deploy (especially one touching auth/session code)
- API routes return 401 when they shouldn't
- Changes to session cookie format or auth verification functions
- PRs modifying `lib/firebase-auth.ts`, `lib/api-auth.ts`, `lib/auth-helpers.ts`, or `middleware.ts`

## Auth Chain (trace order for debugging)

```
Browser request
  |
  v
middleware.ts              -- checks `session` cookie exists (redirect-only, no verification)
  |
  v
API route handler
  |
  v
authenticateApiRequest()   -- lib/api-auth.ts
  |
  +-- 1. Try cookie: cookies().get('session')
  |     |
  |     v
  |   verifySessionCookieOrIdToken()  -- lib/firebase-auth.ts
  |     |
  |     +-- Try verifyFirebaseSessionCookie() (proper session cookie, PR #82+)
  |     |
  |     +-- Fallback: verifyFirebaseToken() (legacy raw ID token, pre-PR #82)
  |
  +-- 2. Try header: request.headers.get('authorization')
        |
        v
      verifyAuth()  -- lib/firebase-auth.ts
        |
        +-- sk- prefix → verifyApiKey() (API key path)
        +-- otherwise → verifyFirebaseToken() (Firebase ID token)
```

For Server Components (not API routes):

```
requireAuth() / requireAdmin() / getSession()  -- lib/auth-helpers.ts
  |
  v
cookies().get('session')
  |
  v
verifySessionCookieOrIdToken()  -- same fallback chain as above
```

## Solution Pattern: Cookie/Token Format Migrations

When a cookie or token format changes (e.g., PR #82 switched from raw ID tokens to Firebase session cookies):

1. **Never break existing sessions** — users with old cookies must not get 401s
2. **Add a fallback function** that tries new format first, falls back to old:
   ```typescript
   async function verifySessionCookieOrIdToken(token: string) {
     try {
       return await verifyNewFormat(token);
     } catch {
       console.log('[Auth] New format failed, retrying as old format');
       return await verifyOldFormat(token);
     }
   }
   ```
3. **Wire the fallback into ALL auth paths** — both `api-auth.ts` AND `auth-helpers.ts`
4. **Add a removal deadline comment** — "Remove fallback once session TTLs cycle (~7d)"
5. **Update all test mocks** — tests mock at the module boundary; renamed functions break mocks silently

## Debugging Checklist

1. **Identify the failing API route** — browser Network tab shows which endpoint returns 401
2. **Check recent PRs** — `git log --oneline -10` for changes to auth files
3. **Trace the auth path** — does the route use `authenticateApiRequest` (cookie+header) or `requireAuth` (cookie-only)?
4. **Check cookie format** — is the `session` cookie a Firebase session cookie or a raw ID token? `verifyFirebaseSessionCookie` rejects raw ID tokens.
5. **Check all auth entry points** — a fix in `api-auth.ts` but not `auth-helpers.ts` leaves Server Components broken

## Key Files

| File                            | Role                                                         |
| ------------------------------- | ------------------------------------------------------------ |
| `lib/firebase-auth.ts`          | Core verification functions (token, session cookie, API key) |
| `lib/api-auth.ts`               | API route auth (cookie-first, header-fallback)               |
| `lib/auth-helpers.ts`           | Server Component auth (cookie-only, redirects)               |
| `lib/firebase-admin.ts`         | Firebase Admin SDK initialization                            |
| `lib/firebase.ts`               | Firebase client SDK                                          |
| `middleware.ts`                 | Edge middleware (cookie existence check only)                |
| `app/api/auth/session/route.ts` | Creates session cookie on login                              |

## Verification

After fixing auth issues:

```bash
# Run auth-specific tests
npx vitest run lib/__tests__/api-auth.test.ts

# Run full test suite
npm run test:ci

# Grep for hardcoded mock names that might be stale
grep -r "mockVerifyFirebase" lib/__tests__/
```

## Example: PR #82 Session Cookie Migration Bug

**Symptom:** "Failed to load purchases" on My Purchases page after deploy.
**Misleading signal:** 16 passing tests, page worked before deploy.
**Root cause:** PR #82 changed `session` cookie from raw Firebase ID token to proper session cookie. `verifyFirebaseSessionCookie()` rejects raw ID tokens. Users with old cookies got 401 on every API call.
**Fix:** Added `verifySessionCookieOrIdToken()` fallback in `firebase-auth.ts`, wired into both `api-auth.ts` and `auth-helpers.ts`.
**Lesson:** Tests passed because they mocked the old function name. Always update test mocks when renaming auth functions.
