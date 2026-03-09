# Onboarding Checklist Implementation Plan

Created: 2026-03-08
Status: VERIFIED
Approved: Yes
Iterations: 0
Worktree: No
Type: Feature

## Summary

**Goal:** Extend the existing onboarding checklist with missing steps (buyer: favorite a project; seller: send first message) and add the checklist to the seller dashboard.
**Architecture:** The `OnboardingChecklist` component and dismiss API already exist. This plan adds two new onboarding steps (computed server-side from DB counts) and wires the checklist into the seller dashboard page.
**Tech Stack:** Next.js 15 Server Components, Prisma queries, existing `OnboardingChecklist` component

## Scope

### In Scope

- Add "Favorite a project" step to buyer onboarding checklist on `/dashboard`
- Add "Send your first message" step to seller onboarding checklist on `/dashboard`
- Add `OnboardingChecklist` to `/seller/dashboard` with seller-specific steps
- Unit tests for all changes

### Out of Scope

- "Browse projects" step (skipped — no natural DB event for page visits)
- New DB migrations (all data already queryable via existing Favorite and Message models)
- Changes to the `OnboardingChecklist` component itself (already fully built)
- Changes to the dismiss API (already works)

## Context for Implementer

**Patterns to follow:**

- `app/dashboard/page.tsx:73-114` — existing onboarding step construction from DB state
- `app/dashboard/page.tsx:139-145` — passing `steps` and `dismissed` props to `OnboardingChecklist`
- `components/onboarding/OnboardingChecklist.tsx` — the component (no changes needed)

**Key files already built:**

- `components/onboarding/OnboardingChecklist.tsx` — full component with dismiss button, progress bar, auto-hide when all done
- `app/api/user/onboarding-dismiss/route.ts` — PATCH endpoint to persist dismissal
- `prisma/schema.prisma:63` — `onboardingDismissedAt` field on User model

**Data sources for new steps:**

- Favorite count: `prisma.favorite.count({ where: { userId } })` — `model Favorite` at `prisma/schema.prisma:353`
- Seller sent message count: `prisma.message.count({ where: { senderId: userId } })` — `model Message` at `prisma/schema.prisma:320`

**Gotchas:**

- The buyer dashboard (`/dashboard`) is used by BOTH buyers and sellers. Sellers see seller-specific steps, buyers see buyer-specific steps. The `session.user.isSeller` flag determines which set.
- The seller dashboard (`/seller/dashboard`) is a separate page that currently has NO onboarding checklist. It needs to query the same data as the buyer dashboard does for seller steps.
- `OnboardingChecklist` auto-hides when all steps are `done: true` — no extra logic needed.

## Progress Tracking

- [x] Task 1: Add missing onboarding steps to buyer dashboard
- [x] Task 2: Wire onboarding checklist to seller dashboard
- [x] Task 3: Tests
      **Total Tasks:** 3 | **Completed:** 3 | **Remaining:** 0

## Implementation Tasks

### Task 1: Add missing onboarding steps to buyer dashboard

**Objective:** Add "Favorite a project" to the buyer steps and "Send your first message" to the seller steps on `/dashboard`.

**Dependencies:** None

**Files:**

- Modify: `app/dashboard/page.tsx`

**Key Decisions / Notes:**

- Add `favoriteCount` to the existing `Promise.all` at line 21 — `prisma.favorite.count({ where: { userId: session.user.id } })`
- Add `sentMessageCount` to the same `Promise.all` — `prisma.message.count({ where: { senderId: session.user.id } })`
- Insert the "Favorite a project" step into the buyer steps array (between "Complete profile" and "Make first purchase")
- Insert the "Send your first message" step into the seller steps array (after "List your first project"). Label is "Send your first message" (not "Respond to") because the `senderId` query detects any message sent, not specifically replies to inbound inquiries.
- `done` flag for favorite: `favoriteCount > 0`
- `done` flag for message: `sentMessageCount > 0`

**Definition of Done:**

- [ ] Buyer dashboard shows 3 steps: profile, favorite, purchase
- [ ] Seller dashboard shows 4 steps: profile, stripe, project, message
- [ ] Each step's `done` state reflects real DB data
- [ ] Type-check passes

**Verify:**

- `npm run type-check`

### Task 2: Wire onboarding checklist to seller dashboard

**Objective:** Add `OnboardingChecklist` to `/seller/dashboard` so sellers see their onboarding steps there too, using the same dismiss state.

**Dependencies:** Task 1 (the seller steps definition should be consistent)

**Files:**

- Modify: `app/seller/dashboard/page.tsx`

**Key Decisions / Notes:**

- Import `OnboardingChecklist` and `OnboardingStep` from `@/components/onboarding/OnboardingChecklist`
- Add Prisma queries in `Promise.all`: `projectCount`, `user` (with `bio`, `onboardingDismissedAt`, `stripeAccountId`, `isVerifiedSeller`), `sentMessageCount`
- Build the same 4 seller steps as in Task 1
- Render `<OnboardingChecklist steps={...} dismissed={...} />` above the existing `<AnalyticsDashboard />`
- Reuse the same `stripeService.getOnboardingStatus()` pattern from `app/dashboard/page.tsx:55-71` for the Stripe step. **Important:** Only call `getOnboardingStatus()` when `user.stripeAccountId` is non-null AND `isVerifiedSeller` is false. Guard with try/catch — if stripeAccountId is null, skip the call and leave `isVerifiedSeller = false`. See buyer dashboard lines 55-71 for exact pattern.

**Definition of Done:**

- [ ] Seller dashboard renders `OnboardingChecklist` with 4 seller steps
- [ ] Checklist respects `onboardingDismissedAt` (hidden if dismissed)
- [ ] Checklist auto-hides when all steps are done
- [ ] Type-check passes

**Verify:**

- `npm run type-check`

### Task 3: Tests

**Objective:** Add tests for the new onboarding steps on both dashboards.

**Dependencies:** Task 1, Task 2

**Files:**

- Create or modify: `app/dashboard/__tests__/page.test.tsx` (if exists, add tests for new steps)
- Create or modify: `app/seller/dashboard/__tests__/page.test.tsx` (if exists, add tests for checklist)

**Key Decisions / Notes:**

- Test that buyer steps include "Favorite a project" with `done: true` when favorite count > 0
- Test that seller steps include "Send your first message" with `done: true` when sent message count > 0
- Test that seller dashboard renders `OnboardingChecklist`
- These are async server component pages — mock `@/lib/auth-helpers` (requireAuth), `@/lib/prisma` (prisma), and `@/lib/services` (stripeService) using `vi.mock()`. Then call the page function directly: `const result = await DashboardPage(); render(result)`. Assert that OnboardingChecklist receives the expected steps with correct `done` flags.
- Do NOT use the client component test pattern from `OnboardingChecklist.test.tsx` — that pattern does not work for async server components.

**Definition of Done:**

- [ ] Tests validate buyer steps include favorite step
- [ ] Tests validate seller steps include message step
- [ ] Tests validate seller dashboard renders onboarding checklist
- [ ] All existing tests pass
- [ ] `npm run test:ci` green

**Verify:**

- `npm run test:ci`

## Testing Strategy

- Unit tests for step construction logic on both dashboard pages
- Existing `OnboardingChecklist` component tests remain unchanged (component itself is not modified)
- Type-check for all changes

## Risks and Mitigations

| Risk                                         | Likelihood | Impact | Mitigation                                                                                         |
| -------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------- |
| Seller dashboard query adds latency          | Low        | Low    | All counts are simple indexed queries; run in `Promise.all`                                        |
| Seller dashboard Stripe check fails          | Low        | Medium | Wrap in try/catch as done in buyer dashboard (lines 55-71); fallback to `isVerifiedSeller = false` |
| Steps mismatch between buyer and seller dash | Medium     | Medium | Extract step definitions into a shared helper if they diverge; for now inline is fine (3 tasks)    |

## Goal Verification

### Truths

1. A new buyer with no favorites sees 3 onboarding steps (profile, favorite, purchase) on `/dashboard`
2. A new seller with no messages sees 4 onboarding steps (profile, stripe, project, message) on `/dashboard`
3. The seller dashboard (`/seller/dashboard`) shows the same 4 seller onboarding steps
4. Completing a step (e.g., adding a favorite) marks it as done on next page load
5. Dismissing the checklist hides it on both dashboards (shared `onboardingDismissedAt` field)
6. The checklist auto-hides once all steps are complete

### Artifacts

- `app/dashboard/page.tsx` — buyer + seller step definitions with favorite and message steps
- `app/seller/dashboard/page.tsx` — seller dashboard with onboarding checklist
- `components/onboarding/OnboardingChecklist.tsx` — component (unchanged)
- `app/api/user/onboarding-dismiss/route.ts` — dismiss API (unchanged)

### Key Links

- DB Favorite count -> buyer step `done` flag -> OnboardingChecklist `steps` prop
- DB Message count (sender) -> seller step `done` flag -> OnboardingChecklist `steps` prop
- Seller dashboard -> same OnboardingChecklist component -> same dismiss API
- `onboardingDismissedAt` field shared between both dashboards

---

Done: 3 | Left: 0
