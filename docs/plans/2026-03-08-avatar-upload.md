# Avatar Upload Implementation Plan

Created: 2026-03-08
Status: VERIFIED
Approved: Yes
Iterations: 0
Worktree: No
Type: Feature

## Summary

**Goal:** Complete avatar upload feature — upload infrastructure is already built (AvatarUpload component, PATCH /api/user/avatar, R2Service, avatarUrl in schema). What remains is wiring avatarUrl into the session data source, updating client-side file size limit to 2MB, and refreshing the session after upload so the nav bar updates immediately.
**Architecture:** Existing 3-layer pattern (Route -> Service -> Repository). R2 presigned URL upload flow already complete.
**Tech Stack:** Next.js 15, Cloudflare R2, Firebase auth, Shadcn Avatar

## Scope

### In Scope

- Wire `avatarUrl` into `/api/auth/me` response, `verifyFirebaseToken` DB query, and `SessionUser` interface
- Update `AvatarUpload` client-side size limit from 5MB to 2MB
- Add session refresh after successful avatar upload so nav bar updates without page reload
- Unit tests for all changes

### Out of Scope

- Server-side image resizing (defer — client uploads directly to R2)
- Avatar deletion/reset to default
- Gravatar fallback
- Messaging UI changes (already fully wired with `avatarUrl`)

## Context for Implementer

**Patterns to follow:**

- `components/projects/ProjectCard.tsx:246` — uses `<AvatarImage src={project.seller.avatarUrl || undefined}>` pattern
- `app/u/[username]/page.tsx:191` — seller profile uses same pattern
- `components/reviews/ReviewsList.tsx:211-212` — reviews use `review.buyer.avatarUrl`

**Key files already built:**

- `components/settings/AvatarUpload.tsx` — full upload component (presigned URL -> R2 -> PATCH /api/user/avatar)
- `app/api/user/avatar/route.ts` — PATCH endpoint saves avatarUrl to DB
- `app/settings/page.tsx` — settings page already renders AvatarUpload
- `components/layout/UserMenu.tsx:82` — uses `user.image` from session (KEY GAP: `image` is always undefined)
- `components/layout/MobileMenu.tsx` — may also need avatar wiring

**Session data flow (critical path):**

1. `lib/firebase-auth.ts` `verifyFirebaseToken` — queries DB user, builds auth object (currently MISSING `avatarUrl`)
2. `app/api/auth/me/route.ts` — returns session user object (currently MISSING `avatarUrl`)
3. `lib/hooks/useSession.tsx` — `SessionUser` interface (currently has NO `image` or `avatarUrl` field)
4. `components/layout/NavigationAuthArea.tsx` → passes `session.user` to `UserMenu`/`MobileMenu`
5. `UserMenu` reads `user.image` → always `undefined` → always shows initials fallback

**Gotchas:**

- `UserMenu` uses `user.image` (line 82) but the DB field is `avatarUrl`. Must map through the entire session chain.
- After upload, `AvatarUpload` updates local state but does NOT refresh the session context. Nav bar won't update until page reload.
- Messaging UI (`app/messages/[userId]/page.tsx`) already renders `avatarUrl` — no changes needed there.

## Progress Tracking

- [x] Task 1: Wire avatarUrl through session chain to nav bar
- [x] Task 2: Update size limit + add session refresh after upload
- [x] Task 3: Tests
      **Total Tasks:** 3 | **Completed:** 3 | **Remaining:** 0

## Implementation Tasks

### Task 1: Wire avatarUrl through session chain to nav bar

**Objective:** Add `avatarUrl` to every layer of the session data flow so UserMenu and MobileMenu display the user's avatar.

**Dependencies:** None

**Files:**

- Modify: `lib/firebase-auth.ts` — add `avatarUrl` to the Prisma select in `verifyFirebaseToken`
- Modify: `app/api/auth/me/route.ts` — include `avatarUrl` in the response object
- Modify: `lib/hooks/useSession.tsx` — add `image?: string | null` to `SessionUser` interface, map from `avatarUrl`
- Inspect: `components/layout/MobileMenu.tsx` — check if it shows avatar, add if missing

**Key Decisions / Notes:**

- The session chain is: `verifyFirebaseToken` DB query -> `/api/auth/me` response -> `SessionUser` interface -> UserMenu/MobileMenu
- Map DB `avatarUrl` to `image` in the `SessionUser` so `UserMenu`'s existing `user.image` works
- Check MobileMenu.tsx for avatar display, wire if needed

**Definition of Done:**

- [ ] `GET /api/auth/me` for a user with `avatarUrl` set returns it in the response
- [ ] `SessionUser.image` is populated from `avatarUrl`
- [ ] UserMenu renders avatar image (not just initials) when `avatarUrl` is set
- [ ] MobileMenu shows avatar if applicable
- [ ] Type-check passes
- [ ] `npm run test:ci` passes

**Verify:**

- `npm run type-check`
- `npm run test:ci`

### Task 2: Update AvatarUpload size limit + session refresh after upload

**Objective:** Change client-side max file size from 5MB to 2MB. Add session refresh after successful upload so nav bar updates immediately without page reload.

**Dependencies:** Task 1 (session must include `avatarUrl` for refresh to show the avatar)

**Files:**

- Modify: `components/settings/AvatarUpload.tsx` (MAX_FILE_SIZE, error text, help text)
- Modify: `lib/hooks/useSession.tsx` or auth provider — expose `refreshSession` function
- Modify: `components/settings/AvatarUpload.tsx` — call `refreshSession` after successful PATCH

**Key Decisions / Notes:**

- Change `MAX_FILE_SIZE = 5 * 1024 * 1024` to `2 * 1024 * 1024`
- Update error message from "5MB" to "2MB" (line 46)
- Update help text from "Max 5MB" to "Max 2MB" (line 176)
- Expose `refreshSession()` from `useSession()` hook (or equivalent) that re-fetches `/api/auth/me`
- Call `refreshSession()` in `AvatarUpload` after the successful PATCH response

**Definition of Done:**

- [ ] AvatarUpload rejects files > 2MB with "Image must be smaller than 2MB." error
- [ ] Help text shows "Max 2MB"
- [ ] Nav bar avatar updates immediately after upload without page reload
- [ ] Type-check passes

**Verify:**

- `npm run type-check`

### Task 3: Tests

**Objective:** Add tests for session avatar mapping, size limit, and session refresh after upload.

**Dependencies:** Task 1, Task 2

**Files:**

- Modify: `components/settings/__tests__/` (AvatarUpload tests)
- Create or modify: test for `/api/auth/me` avatar response if route test exists

**Key Decisions / Notes:**

- Test AvatarUpload rejects files > 2MB
- Test AvatarUpload calls `refreshSession` (or equivalent) after successful upload
- Test `/api/auth/me` returns `avatarUrl` when user has one set (if route test file exists)

**Definition of Done:**

- [ ] Test validates 2MB size limit rejection in AvatarUpload
- [ ] Test verifies session refresh is called after successful upload
- [ ] All existing tests pass
- [ ] `npm run test:ci` green

**Verify:**

- `npm run test:ci`

## Testing Strategy

- Unit tests for AvatarUpload size validation and session refresh call
- Unit/integration test for `/api/auth/me` avatarUrl inclusion
- Type-check for session shape changes

## Risks and Mitigations

| Risk                                  | Likelihood | Impact | Mitigation                                                                                                      |
| ------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| avatarUrl missing from session chain  | Confirmed  | High   | Add `avatarUrl` to Prisma select in `verifyFirebaseToken`, `/api/auth/me` response, and `SessionUser` interface |
| Nav bar doesn't update after upload   | Confirmed  | High   | Expose `refreshSession` from auth provider, call after PATCH success                                            |
| MobileMenu doesn't accept avatar prop | Low        | Low    | Check MobileMenu interface, add if missing                                                                      |

## Goal Verification

### Truths

1. Uploading an avatar in settings saves it and the nav bar shows the new image immediately (no reload)
2. Files larger than 2MB are rejected with a clear error message
3. Seller avatars appear on project cards, seller profiles, reviews, and messages (all already wired)
4. The initials fallback still works when no avatar is set
5. `GET /api/auth/me` returns `avatarUrl` for users who have one

### Artifacts

- `components/settings/AvatarUpload.tsx` — upload flow
- `components/layout/UserMenu.tsx` — nav bar avatar
- `lib/hooks/useSession.tsx` — SessionUser interface
- `lib/firebase-auth.ts` — DB query for auth user
- `app/api/auth/me/route.ts` — session API

### Key Links

- AvatarUpload -> POST /api/upload -> R2 presigned URL -> PATCH /api/user/avatar -> DB
- DB avatarUrl -> verifyFirebaseToken -> /api/auth/me -> SessionUser.image -> UserMenu AvatarImage
- DB avatarUrl -> ProjectCard seller.avatarUrl -> AvatarImage (already wired)
- AvatarUpload success -> refreshSession() -> /api/auth/me -> updated SessionUser -> UserMenu re-renders

---

Done: 3 | Left: 0
