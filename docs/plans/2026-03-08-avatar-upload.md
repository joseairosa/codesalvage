# Avatar Upload Implementation Plan

Created: 2026-03-08
Status: VERIFIED
Approved: Yes
Iterations: 0
Worktree: No
Type: Feature

## Summary

**Goal:** Wire up the avatar upload feature end-to-end by fixing two auth utilities broken by the recent session-cookie security fix, and adding the R2 domain to the CSP so browser uploads aren't blocked.

**Architecture:** The UI component (`AvatarUpload`), API routes (`/api/upload`, `/api/user/avatar`), and Prisma schema field (`avatarUrl`) are already fully implemented. The upload flow is: client → presigned URL from `/api/upload` → PUT directly to R2 → PATCH `/api/user/avatar` with the public URL. The two auth utilities that power steps 1 and 3 call `verifyIdToken()` but the session cookie is now a Firebase Admin session cookie (after security fix #7), which requires `verifySessionCookie()`. Additionally the CSP `connect-src` doesn't include the R2 endpoint domain, so the browser blocks the presigned PUT.

**Tech Stack:** Next.js 15, Firebase Admin SDK, Cloudflare R2, Prisma, Vitest

## Scope

### In Scope
- Fix `lib/api-auth.ts` cookie path: `verifyFirebaseToken` → `verifyFirebaseSessionCookie`
- Fix `app/api/auth/me/route.ts`: `verifyFirebaseToken` → `verifyFirebaseSessionCookie`
- Fix `next.config.ts` CSP: add `https://*.r2.cloudflarestorage.com` to `connect-src`
- Update unit tests for both files

### Out of Scope
- Rate limiting on avatar endpoint (deferred)
- Client-side crop UI (current "pick file" UX is sufficient)
- Avatar deletion
- R2 URL validation on `PATCH /api/user/avatar` (currently accepts any valid URL as `avatarUrl`; a future hardening task should restrict to the project's own R2 public base URL)

## Context for Implementer

> The avatar upload feature is 90% done. All the UI and API are wired up. The only problems are in the auth layer and CSP.

- **Root cause:** Security fix #7 (PR #82, 2026-03-08) changed `POST /api/auth/session` to store a Firebase Admin session cookie (via `admin.auth().createSessionCookie()`) instead of the raw ID token. `auth-helpers.ts` was updated to use `verifyFirebaseSessionCookie`, but two other places that also read the `session` cookie were missed: `lib/api-auth.ts` (used by all API routes) and `app/api/auth/me/route.ts` (used by `refreshSession()` after upload).
- **Pattern to follow:** `lib/auth-helpers.ts:53,63,113,170` — all use `verifyFirebaseSessionCookie(sessionToken)`. Mirror this exact pattern.
- **`verifyFirebaseSessionCookie`** is exported from `lib/firebase-auth.ts:184`. It calls `authInstance.verifySessionCookie(cookie, true /* checkRevoked */)`.
- **CSP location:** `next.config.ts` in the `headers()` function, the `Content-Security-Policy` value string. The upload goes via a presigned S3-compatible URL to Cloudflare's R2 endpoint (`https://<account-id>.r2.cloudflarestorage.com`). The wildcard `https://*.r2.cloudflarestorage.com` covers all account IDs.
- **Key files:**
  - `lib/firebase-auth.ts` — `verifyFirebaseSessionCookie` (line 184), `verifyFirebaseToken` (line 52)
  - `lib/api-auth.ts` — `authenticateApiRequest` reads `session` cookie (line 49-56)
  - `app/api/auth/me/route.ts` — direct call to `verifyFirebaseToken` (line 22)
  - `next.config.ts` — `Content-Security-Policy` header (line ~162)
  - `lib/services/R2Service.ts` — `getUploadUrl` returns a presigned URL pointing at `env.R2_ENDPOINT`
- **Gotcha:** The Authorization header path in `api-auth.ts` calls `verifyAuth` → `verifyFirebaseToken`. This path handles programmatic API key/ID token access and must NOT be changed — ID tokens are still valid for the Authorization header. Only the cookie path changes.
- **Test files:**
  - `lib/__tests__/api-auth.test.ts` — does NOT exist yet; must be created
  - `app/api/auth/me/__tests__/route.test.ts` — EXISTS; mock key `verifyFirebaseToken` on line 20 must be renamed to `verifyFirebaseSessionCookie`

## Runtime Environment

- **Start:** `npm run docker:dev` (app on port 3011)
- **Health:** `curl http://localhost:3011/api/ping`
- **Settings page:** `http://localhost:3011/settings` (requires auth)

## Progress Tracking

- [x] Task 1: Fix cookie auth in `api-auth.ts` and `me` route
- [x] Task 2: Fix CSP to allow R2 presigned uploads

**Total Tasks:** 2 | **Completed:** 2 | **Remaining:** 0

## Implementation Tasks

### Task 1: Fix cookie-based session verification in auth utilities

**Objective:** Change `api-auth.ts` and `me/route.ts` to call `verifyFirebaseSessionCookie` for cookie-based auth, so that `/api/upload` and `/api/user/avatar` work correctly after the security fix that switched session cookies to Firebase Admin session cookie format.

**Dependencies:** None

**Files:**
- Modify: `lib/api-auth.ts`
- Modify: `app/api/auth/me/route.ts`
- Create: `lib/__tests__/api-auth.test.ts` (no test file exists; must be created)
- Modify: `app/api/auth/me/__tests__/route.test.ts` (rename mock)

**Key Decisions / Notes:**
- In `lib/api-auth.ts` line 30: add `verifyFirebaseSessionCookie` to the import alongside `verifyAuth`; remove `verifyFirebaseToken` from the import (it's no longer needed in this file). Change line 53: `verifyFirebaseToken(sessionToken)` → `verifyFirebaseSessionCookie(sessionToken)`.
- In `app/api/auth/me/route.ts`: change the import and the single call on line 22 from `verifyFirebaseToken` → `verifyFirebaseSessionCookie`.
- **Do NOT change** the Authorization header path in `api-auth.ts` — it calls `verifyAuth` which handles ID tokens. That path is correct.
- Follow the exact pattern from `lib/auth-helpers.ts:53`: `const auth = await verifyFirebaseSessionCookie(sessionToken);`

**Definition of Done:**
- [ ] `lib/api-auth.ts` imports and calls `verifyFirebaseSessionCookie` for cookie path
- [ ] `app/api/auth/me/route.ts` imports and calls `verifyFirebaseSessionCookie`
- [ ] `verifyFirebaseToken` is no longer imported in either file (for the cookie path)
- [ ] `app/api/auth/me/__tests__/route.test.ts`: `vi.mock('@/lib/firebase-auth')` exports `verifyFirebaseSessionCookie` (not `verifyFirebaseToken`); `mockVerifyFirebaseToken` renamed to `mockVerifyFirebaseSessionCookie` in `vi.hoisted()` and all three test bodies
- [ ] `lib/__tests__/api-auth.test.ts` created with at minimum: (1) cookie path calls `verifyFirebaseSessionCookie` not `verifyFirebaseToken`, (2) Authorization header path calls `verifyAuth`, (3) returns `null` when both paths fail
- [ ] All unit tests pass

**Verify:**
- `npm run test:ci -- --reporter=verbose 2>&1 | grep -E "api-auth|auth/me|PASS|FAIL"`

---

### Task 2: Fix CSP to allow R2 presigned URL uploads

**Objective:** Add Cloudflare R2's cloudflarestorage.com domain to the CSP `connect-src` directive so the browser doesn't block the presigned PUT upload in `AvatarUpload.tsx`.

**Dependencies:** None

**Files:**
- Modify: `next.config.ts`

**Key Decisions / Notes:**
- The presigned upload URL from `r2Service.getUploadUrl()` points to `env.R2_ENDPOINT` which is a Cloudflare R2 endpoint of the form `https://<account-id>.r2.cloudflarestorage.com`.
- The wildcard `https://*.r2.cloudflarestorage.com` in `connect-src` covers all valid R2 account endpoints.
- Location in `next.config.ts`: the `Content-Security-Policy` value is a joined string in `headers()`. Add the wildcard to the `connect-src` directive, keeping the existing domains.
- No test needed — this is a config change. Manual verification is the DoD.

**Definition of Done:**
- [ ] `connect-src` in `next.config.ts` includes `https://*.r2.cloudflarestorage.com`
- [ ] TypeScript type-check passes: `npm run type-check`
- [ ] The `Content-Security-Policy` header value in the response includes the R2 domain

**Verify:**
- `npm run type-check`
- `grep "r2.cloudflarestorage.com" next.config.ts`

---

## Testing Strategy

- **Unit tests:** For Task 1, run vitest to verify existing mock-based tests pass with the updated imports.
- **Integration test:** After both tasks, verify the full upload flow manually on the running app (settings page → pick image → upload succeeds, avatar appears in nav).
- **CSP check:** Use browser DevTools → Network → check the `Content-Security-Policy` response header on any page load.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Existing unit tests for `api-auth.ts` mock `verifyFirebaseToken` and break with import change | Medium | Low | Update test mocks to mock `verifyFirebaseSessionCookie` instead |
| R2 endpoint domain varies by region or config | Low | Medium | Use wildcard `*.r2.cloudflarestorage.com` to cover all Cloudflare R2 account subdomains |
| `me` route tests break if mocked incorrectly | Low | Low | Mirror test setup from `lib/hooks/__tests__/useSession.test.tsx` |

## Goal Verification

### Truths
1. Authenticated users can upload a profile image via the settings page
2. The uploaded image appears immediately in the `AvatarUpload` preview after upload
3. The `UserMenu` in the nav shows the uploaded avatar (via `user.image` in session)
4. Invalid files (wrong type, too large) are rejected client-side with a clear error
5. The `session` cookie is correctly verified for all avatar-related API calls

### Artifacts
- `lib/api-auth.ts` — `authenticateApiRequest` uses `verifyFirebaseSessionCookie` for cookie path
- `app/api/auth/me/route.ts` — uses `verifyFirebaseSessionCookie`
- `next.config.ts` — CSP `connect-src` includes `https://*.r2.cloudflarestorage.com`

### Key Links
- `AvatarUpload.tsx` → `POST /api/upload` (via `api-auth.ts`) → R2 presigned URL → `PUT *.r2.cloudflarestorage.com` (CSP gated) → `PATCH /api/user/avatar` (via `api-auth.ts`) → `GET /api/auth/me` (session refresh)
