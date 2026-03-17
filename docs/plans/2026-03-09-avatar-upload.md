# Avatar Upload Implementation Plan

Created: 2026-03-09
Status: VERIFIED
Approved: Yes
Iterations: 0
Worktree: No
Type: Feature

## Summary

**Goal:** Fix hardcoded avatar fallback gradients to use the teal design system tokens, completing the visual consistency of the avatar upload feature.

**Architecture:** The avatar upload pipeline is already complete (AvatarUpload component → presigned R2 upload → PATCH /api/user/avatar → refreshSession). The public profile page (`/u/[username]`) and project cards already display uploaded avatars. The only remaining gap is that three components render avatar initial-fallbacks using hardcoded `from-blue-500 to-purple-600` gradients instead of the teal design token (`bg-primary`).

**Tech Stack:** TypeScript, Tailwind CSS, Shadcn/ui Avatar primitives

---

## Scope

### In Scope

- Replace hardcoded `from-blue-500 to-purple-600` avatar fallback gradients with `bg-primary text-primary-foreground` design tokens in:
  - `components/layout/UserMenu.tsx` (AvatarFallback, line 83)
  - `components/layout/MobileMenu.tsx` (AvatarFallback, line 101)
  - `components/settings/AvatarUpload.tsx` (circular fallback div, line 117)

### Out of Scope

- Avatar upload functionality itself (already implemented and tested)
- Public profile avatar display (already implemented — `app/u/[username]/page.tsx`)
- Adding new upload UI or changing upload limits
- Adding avatar display to pages not currently showing avatars

---

## Context for Implementer

> The avatar upload feature is complete. This plan closes one visual gap: fallback colors.

**Key patterns:**

- Design token usage: `bg-primary text-primary-foreground` → maps to teal HSL(186 44% 50%) via `tailwind.config.ts:26-28`
- Existing correct usage: `components/layout/UserMenu.tsx:78` already uses `focus:ring-primary` (correct design token)
- Avatar primitive: Shadcn `<AvatarFallback className="...">` for UserMenu/MobileMenu; raw `<div className="...">` for AvatarUpload's preview circle

**Gotchas:**

- AvatarUpload (line 117) is a raw `<div>`, not `<AvatarFallback>`. It needs the gradient removed but does not use the Shadcn Avatar primitive.
- The public profile page (`app/u/[username]/page.tsx:192`) already has `AvatarFallback className="text-2xl"` with no background gradient — this is correct as-is (uses Shadcn default, neutral background). Do not change it.
- `text-white` in the fallback classes should become `text-primary-foreground` so it respects dark mode.

**No new files needed** — this is a pure CSS class change across 3 files, 1 line each.

---

## Progress Tracking

- [x] Task 1: Fix avatar fallback color tokens

**Total Tasks:** 1 | **Completed:** 1 | **Remaining:** 0

---

## Implementation Tasks

### Task 1: Fix avatar fallback color tokens

**Objective:** Replace the 3 hardcoded `from-blue-500 to-purple-600` gradient fallback classes with design tokens so avatar initials match the teal brand palette in all components.

**Dependencies:** None

**Files:**

- Modify: `components/layout/UserMenu.tsx`
- Modify: `components/layout/MobileMenu.tsx`
- Modify: `components/settings/AvatarUpload.tsx`
- Test: `components/settings/__tests__/AvatarUpload.test.tsx` (verify initials fallback still renders)

**Key Decisions / Notes:**

- `UserMenu.tsx:83` and `MobileMenu.tsx:101`: Change `AvatarFallback className` from `bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-semibold text-white` → `bg-primary text-sm font-semibold text-primary-foreground`
- `AvatarUpload.tsx:117`: Change outer div from `bg-gradient-to-br from-blue-500 to-purple-600` → `bg-primary`
- `AvatarUpload.tsx:126`: Change inner initials div from `text-white` → `text-primary-foreground` (hardcoded `text-white` would be invisible in dark mode where `bg-primary` is lighter)
- Existing AvatarUpload tests cover behavior (upload/validation), not CSS classes. No new assertions needed — tests must still pass unchanged.
- No new test file needed; existing tests remain the coverage proof.

**Definition of Done:**

- [ ] All tests pass (`npm run test:ci`)
- [ ] No TypeScript/lint errors (`npm run type-check && npm run lint`)
- [ ] `UserMenu.tsx:83` contains `bg-primary text-primary-foreground` instead of `from-blue-500 to-purple-600 text-white`
- [ ] `MobileMenu.tsx:101` contains `bg-primary text-primary-foreground` instead of `from-blue-500 to-purple-600 text-white`
- [ ] `AvatarUpload.tsx:117` contains `bg-primary` instead of `bg-gradient-to-br from-blue-500 to-purple-600`
- [ ] `AvatarUpload.tsx:126` contains `text-primary-foreground` instead of `text-white`
- [ ] No remaining `from-blue-500 to-purple-600` in the three targeted avatar fallback files (note: `app/auth/verify/page.tsx:151` uses the same gradient for a non-avatar icon circle and is intentionally excluded)

**Verify:**

- `grep -n "from-blue-500 to-purple-600" components/layout/UserMenu.tsx components/layout/MobileMenu.tsx components/settings/AvatarUpload.tsx` — must return no matches
- `npm run test:ci` — all tests pass

---

## Assumptions

- `bg-primary` resolves correctly in Tailwind — supported by `tailwind.config.ts:26-28` where `primary.DEFAULT = 'hsl(var(--primary))'`. Task 1 depends on this.
- The public profile fallback (`app/u/[username]/page.tsx:192`) is intentionally unstyled (Shadcn default gray). No change needed there. Task 1 depends on this assumption (do not change that file).

---

## Testing Strategy

- **Unit:** Existing `AvatarUpload.test.tsx` suite (16 tests) verifies upload behavior; they must continue passing after the class change. No new assertions required — CSS class changes are verified by grep in the DoD.
- **Manual:** Visually confirm the teal initials fallback in the nav bar (log in with a user that has no avatar set) and on the settings page avatar preview.

---

## Risks and Mitigations

| Risk                                                   | Likelihood | Impact | Mitigation                                                                                                              |
| ------------------------------------------------------ | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| `bg-primary` not visible on certain backgrounds        | Low        | Low    | `primary` is teal (HSL 186 44% 50%) with good contrast; `text-primary-foreground` ensures white text on both light/dark |
| Removing gradient creates noticeable visual regression | Low        | Low    | Single-color `bg-primary` is consistent with the design system updated in PR #95                                        |

---

## Pre-Mortem

_Assume this plan failed. Most likely internal reasons:_

1. **Wrong fallback element targeted** (Task 1) → Trigger: grep still finds `from-blue-500 to-purple-600` in the targeted files after editing — check line numbers shifted due to prior edits
2. **`text-white` not replaced with `text-primary-foreground`** (Task 1) → Trigger: avatar initials text appears invisible in dark mode because `text-white` stays alongside `bg-primary` (both could be light-colored in dark mode)

---

## Goal Verification

### Truths

1. Navigation avatar fallback (logged-in user, no uploaded photo) shows teal background with white/light initials
2. Mobile menu avatar fallback shows same teal style
3. Settings page avatar preview circle shows teal when no photo is uploaded
4. No `from-blue-500 to-purple-600` remains in avatar-fallback contexts
5. All existing unit tests continue passing

### Artifacts

- `components/layout/UserMenu.tsx` — `AvatarFallback` contains `bg-primary text-primary-foreground`
- `components/layout/MobileMenu.tsx` — `AvatarFallback` contains `bg-primary text-primary-foreground`
- `components/settings/AvatarUpload.tsx` — preview `div` contains `bg-primary`

### Key Links

- `globals.css:13` → `--primary: 186 44% 50%` (teal)
- `tailwind.config.ts:26-28` → `primary.DEFAULT = 'hsl(var(--primary))'`
- `AvatarUpload.tsx:117` → fallback preview div
- `UserMenu.tsx:83` → AvatarFallback
- `MobileMenu.tsx:101` → AvatarFallback
