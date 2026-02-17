# Admin Escrow Management Implementation Plan

Created: 2026-02-17
Status: VERIFIED
Approved: Yes
Iterations: 0
Worktree: No

> **Status Lifecycle:** PENDING → COMPLETE → VERIFIED
> **Iterations:** Tracks implement→verify cycles (incremented by verify phase)
>
> - PENDING: Initial state, awaiting implementation
> - COMPLETE: All tasks implemented
> - VERIFIED: All checks passed
>
> **Approval Gate:** Implementation CANNOT proceed until `Approved: Yes`
> **Worktree:** Set at plan creation (from dispatcher). `Yes` uses git worktree isolation; `No` works directly on current branch (default)

## Summary

**Goal:** Add admin escrow management features: refund endpoint, escrow time remaining, and escrow analytics on the admin dashboard.

**Architecture:** Follows existing 3-layer pattern (Route → AdminService → Repository). Wires the existing `StripeService.refundPayment()` to a new admin API route, adds computed escrow time fields to transaction API responses, and extends the admin dashboard with escrow analytics cards.

**Tech Stack:** Next.js API Routes, Prisma, Stripe SDK (existing `refundPayment`), Postmark (existing `EmailService`), React (admin dashboard component), Vitest (tests)

## Scope

### In Scope

- Admin refund endpoint: `PUT /api/admin/transactions/[transactionId]/refund`
- `AdminService.refundTransaction()` method with validation, Stripe refund, audit logging, and buyer email notification
- Computed `escrowTimeRemainingMs` field added to admin transaction API responses
- Escrow analytics: total $ in escrow, counts by escrow status, overdue escrow count
- New `AdminService.getEscrowAnalytics()` method
- New `GET /api/admin/escrow-analytics` API route
- Escrow analytics cards on the admin dashboard UI
- Refund email notification to buyer (new EmailService method)
- Unit tests for all new service methods

### Out of Scope

- Dispute tracking / hold reason system (future feature)
- Bulk escrow operations
- Partial refunds (full refund only for now)
- Buyer-facing refund request UI
- Escrow time remaining on buyer/seller-facing pages (admin only)

## Prerequisites

- Existing `StripeService.refundPayment()` method (already implemented at `lib/services/StripeService.ts:266`)
- Existing admin auth infrastructure (`requireAdminApiAuth`, `getAdminService`)
- Existing `AdminService` patterns for validation, audit logging, email notifications
- Existing `EmailService` with Postmark integration

## Context for Implementer

- **Patterns to follow:** Admin route pattern in `app/api/admin/transactions/[transactionId]/release-escrow/route.ts` — Zod validation, `requireAdminApiAuth`, `getAdminService()`, audit logging via `AdminService`
- **Conventions:** `[ServiceName] message` logging, `AdminValidationError` for business rule violations, `getAdminService()` singleton from `lib/utils/admin-services.ts`
- **Key files:**
  - `lib/services/AdminService.ts` — Business logic layer, add new methods here
  - `lib/services/StripeService.ts:266` — Existing `refundPayment()` to wire
  - `lib/repositories/TransactionRepository.ts` — Data access, add new query methods
  - `lib/repositories/AdminRepository.ts` — Platform stats queries
  - `lib/utils/admin-services.ts` — Singleton service initialization (may need StripeService added)
  - `app/api/admin/transactions/route.ts` — Existing admin transactions list route
  - `components/admin/AdminDashboard.tsx` — Dashboard UI to extend
- **Gotchas:**
  - `AdminService` constructor doesn't currently receive `StripeService` — we need to add it as a dependency
  - Transaction model stores `stripePaymentIntentId` which is needed for Stripe refund
  - `escrowReleaseDate` is when escrow SHOULD release (7 days from payment), `releasedToSellerAt` is when it actually did
  - Transaction `paymentStatus` can be `'pending'`, `'succeeded'`, `'failed'`, `'refunded'` — the `'refunded'` status already exists in the schema comment
  - `escrowStatus` values: `'pending'`, `'held'`, `'released'`, `'disputed'`
- **Domain context:** Escrow holds buyer payment for 7 days before releasing to seller. Admin needs to refund buyer (reverse the payment via Stripe) during this window if something goes wrong.

## Progress Tracking

**MANDATORY: Update this checklist as tasks complete. Change `[ ]` to `[x]`.**

- [x] Task 1: Add StripeService dependency to AdminService + refundTransaction method
- [x] Task 2: Admin refund API route + refund email notification
- [x] Task 3: Escrow time remaining in transaction API responses
- [x] Task 4: Escrow analytics service method + API route + dashboard UI

**Total Tasks:** 4 | **Completed:** 4 | **Remaining:** 0

## Implementation Tasks

### Task 1: Add StripeService Dependency to AdminService + refundTransaction Method

**Objective:** Add `StripeService` as a dependency to `AdminService` and implement `refundTransaction()` method that validates the transaction, calls Stripe refund, updates transaction status, creates audit log, and sends buyer email notification.

**Dependencies:** None

**Files:**

- Modify: `lib/repositories/TransactionRepository.ts` — Add `markRefunded(id)` method that atomically updates both `paymentStatus` and `escrowStatus` in a single Prisma update
- Modify: `lib/services/AdminService.ts` — Add StripeService constructor param, add `refundTransaction()` method
- Modify: `lib/utils/admin-services.ts` — Pass `stripeService` to AdminService constructor
- Modify: `app/api/admin/stats/route.ts` — Update AdminService instantiation to pass stripeService as 6th arg
- Modify: `app/api/admin/users/route.ts` — Update AdminService instantiation to pass stripeService as 6th arg
- Modify: `lib/services/EmailService.ts` — Add `sendRefundNotification()` method and `RefundEmailData` interface
- Modify: `lib/services/index.ts` — Export new `RefundEmailData` type
- Test: `lib/services/__tests__/AdminService.test.ts` — Update existing AdminService instantiation to include mockStripeService as 6th param, add tests for `refundTransaction()`

**Key Decisions / Notes:**

- Add `StripeService` as 6th constructor param to `AdminService` (after `emailService`)
- Three files directly instantiate AdminService — update ALL three: `getAdminService()` in `lib/utils/admin-services.ts`, `app/api/admin/stats/route.ts`, and `app/api/admin/users/route.ts`
- Existing `AdminService.test.ts` beforeEach setup must be updated to add a `mockStripeService` (vi.fn() mock implementing `refundPayment`)
- `refundTransaction()` business rules:
  - Transaction must exist (find by ID)
  - Transaction payment status must be `'succeeded'` (can't refund pending/failed/already-refunded)
  - Transaction escrow status must be `'held'` or `'pending'` (can't refund already released)
  - Transaction must have `stripePaymentIntentId` (can't refund without Stripe reference)
  - Reason must be at least 10 characters (same pattern as release-escrow)
- Unlike `releaseEscrowManually()`, `refundTransaction()` MUST call `transactionRepository.findById(transactionId)` first and throw `AdminValidationError` if null — follow `banUser()` pattern, not `releaseEscrowManually()`
- If `codeDeliveryStatus === 'accessed'` or `githubAccessGrantedAt` is set, include a `warning: 'Buyer has already received code access'` in the response (refund still proceeds, but admin is informed)
- After Stripe refund succeeds:
  - Call `transactionRepository.markRefunded(id)` — single atomic Prisma update for both `paymentStatus: 'refunded'` and `escrowStatus: 'released'` (avoids inconsistent state if one update succeeds and the other fails)
  - Create audit log with action `'transaction.refund'`
  - Send refund notification email to buyer (non-blocking, catch errors)
- Follow `banUser()` pattern at `AdminService.ts:109` for structure (validate → action → audit log → email)
- `sendRefundNotification()` follows existing email patterns (recipient + data interface)
- Existing test mock `mockTransactionRepo` must be extended with `findById: vi.fn()` and `markRefunded: vi.fn()` (the existing mock only has `releaseEscrowManually` and `getAllTransactions`)

**Definition of Done:**

- [ ] `AdminService.refundTransaction()` validates transaction state before refunding
- [ ] Stripe `refundPayment()` is called with the transaction's `stripePaymentIntentId`
- [ ] Transaction `paymentStatus` updated to `'refunded'` and `escrowStatus` updated to `'released'`
- [ ] Audit log created with action `'transaction.refund'` including transaction metadata
- [ ] Buyer receives refund email notification
- [ ] `AdminService` constructor accepts `StripeService` as 6th parameter
- [ ] `getAdminService()` in admin-services.ts passes `stripeService` singleton
- [ ] `app/api/admin/stats/route.ts` AdminService instantiation updated to pass stripeService as 6th arg
- [ ] `app/api/admin/users/route.ts` AdminService instantiation updated to pass stripeService as 6th arg
- [ ] Existing AdminService instantiation in AdminService.test.ts updated to include mockStripeService as 6th parameter
- [ ] All tests pass (unit tests with mocked dependencies)
- [ ] No diagnostics errors

**Verify:**

- `npx vitest run lib/services/__tests__/AdminService.test.ts` — AdminService refund tests pass
- `npm run type-check` — No TypeScript errors

---

### Task 2: Admin Refund API Route

**Objective:** Create `PUT /api/admin/transactions/[transactionId]/refund` API route that validates admin session, parses request body with Zod, and delegates to `AdminService.refundTransaction()`.

**Dependencies:** Task 1

**Files:**

- Create: `app/api/admin/transactions/[transactionId]/refund/route.ts`
- Test: `lib/services/__tests__/AdminService.test.ts` — Additional edge case tests if needed

**Key Decisions / Notes:**

- Follow exact pattern from `app/api/admin/transactions/[transactionId]/release-escrow/route.ts`
- Zod schema: `{ reason: z.string().min(10).max(500) }` (same as release-escrow)
- Handle `AdminValidationError` with not-found message → 404, other `AdminValidationError` → 400, `z.ZodError` → 400, generic → 500
- Return `{ success: true, transaction: { id, amountCents, paymentStatus, escrowStatus } }`
- Use `requireAdminApiAuth(request)` for auth
- Extract IP from `x-forwarded-for` or `x-real-ip` headers

**Definition of Done:**

- [ ] PUT endpoint returns 200 with transaction data on successful refund
- [ ] Returns 400 for validation errors (bad reason, wrong transaction state)
- [ ] Returns 401 for unauthenticated requests
- [ ] Returns 404 when transactionId does not exist in the database
- [ ] Returns 500 for unexpected errors
- [ ] Zod validates reason (10-500 characters)
- [ ] No diagnostics errors

**Verify:**

- `npm run type-check` — No TypeScript errors
- `npm run lint` — No lint errors

---

### Task 3: Escrow Time Remaining in Transaction API Responses

**Objective:** Add computed `escrowTimeRemainingMs` field to admin transaction list API responses so the admin dashboard can show how long until escrow releases.

**Dependencies:** None

**Files:**

- Modify: `app/api/admin/transactions/route.ts` — Add computed field to each transaction in response

**Key Decisions / Notes:**

- Compute `escrowTimeRemainingMs` as `max(0, escrowReleaseDate - now)` for each transaction
- Only meaningful when `escrowStatus === 'held'` and `escrowReleaseDate` is set
- Set to `null` for transactions where escrow is already released, refunded, or has no release date
- Add `isOverdue: boolean` — true when `escrowReleaseDate < now && escrowStatus === 'held'`
- This is a purely computed field in the API response — no DB changes needed
- Map over transactions array before returning, adding these two fields

**Definition of Done:**

- [ ] GET `/api/admin/transactions` response includes `escrowTimeRemainingMs` (number | null) per transaction
- [ ] GET `/api/admin/transactions` response includes `isOverdue` (boolean) per transaction
- [ ] `escrowTimeRemainingMs` is `null` when escrow is not `'held'` or `escrowReleaseDate` is null
- [ ] `isOverdue` is `true` when `escrowReleaseDate < now` and escrow is still `'held'`
- [ ] No diagnostics errors

**Verify:**

- `npm run type-check` — No TypeScript errors

---

### Task 4: Escrow Analytics Service Method + API Route + Dashboard UI

**Objective:** Add escrow analytics to the admin dashboard showing total $ in escrow, counts by escrow status, and overdue escrow count.

**Dependencies:** None

**Files:**

- Modify: `lib/repositories/AdminRepository.ts` — Add `getEscrowAnalytics()` query method
- Modify: `lib/repositories/index.ts` — Export new types if needed
- Modify: `lib/services/AdminService.ts` — Add `getEscrowAnalytics()` method
- Create: `app/api/admin/escrow-analytics/route.ts` — GET endpoint
- Modify: `components/admin/AdminDashboard.tsx` — Add escrow analytics cards
- Test: `lib/services/__tests__/AdminService.test.ts` — Tests for analytics method

**Key Decisions / Notes:**

- `AdminRepository.getEscrowAnalytics()` uses `prisma.$transaction` for parallel queries (same pattern as `getPlatformStats` at `AdminRepository.ts:136`):
  - Count transactions by escrow status: `held`, `released`, `pending`, `disputed`
  - Sum `amountCents` where `escrowStatus === 'held'` (total $ currently in escrow)
  - Count overdue: where `escrowStatus === 'held' AND escrowReleaseDate < now`
  - Sum `amountCents` of overdue escrows
- Interface: `EscrowAnalytics { totalHeldCents, totalHeldCount, totalReleasedCount, totalPendingCount, totalDisputedCount, overdueCount, overdueAmountCents }`
- Admin dashboard adds a new section below the existing stats grid: "Escrow Overview" with 4 cards (In Escrow amount, Held count, Overdue count, Released count)
- Follow existing `AdminDashboard.tsx` card pattern with `StatCard` interface
- API route follows `app/api/admin/stats/route.ts` pattern

**Definition of Done:**

- [ ] `AdminRepository.getEscrowAnalytics()` returns escrow counts and amounts
- [ ] `AdminService.getEscrowAnalytics()` delegates to repository
- [ ] GET `/api/admin/escrow-analytics` returns analytics data with admin auth check
- [ ] Admin dashboard shows escrow analytics cards (In Escrow $, Held, Overdue, Released)
- [ ] Overdue card shows warning color (orange/red) when count > 0
- [ ] All tests pass
- [ ] No diagnostics errors

**Verify:**

- `npx vitest run lib/services/__tests__/AdminService.test.ts` — Analytics tests pass
- `npm run type-check` — No TypeScript errors
- `npm run lint` — No lint errors

## Testing Strategy

- **Unit tests:** Mock `TransactionRepository`, `StripeService`, `EmailService`, and `AdminRepository` to test `AdminService.refundTransaction()` and `getEscrowAnalytics()` in isolation
- **Integration tests:** Not needed — existing patterns are well-established
- **Manual verification:** After implementation, test refund endpoint via admin UI or curl, verify Stripe refund appears in dashboard, verify escrow analytics cards render on admin dashboard

## Risks and Mitigations

| Risk                                                    | Likelihood | Impact | Mitigation                                                                                                                                                                                 |
| ------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stripe refund fails after DB status updated             | Low        | High   | Call Stripe refund FIRST, only update DB status if Stripe succeeds                                                                                                                         |
| Transaction has no stripePaymentIntentId                | Low        | Medium | Validate `stripePaymentIntentId` exists before attempting refund, return clear error                                                                                                       |
| AdminService constructor change breaks existing callers | Low        | Medium | Three files directly instantiate AdminService — update all three: `getAdminService()` in `lib/utils/admin-services.ts`, `app/api/admin/stats/route.ts`, and `app/api/admin/users/route.ts` |

## Open Questions

- None — all requirements are clear from existing patterns.
