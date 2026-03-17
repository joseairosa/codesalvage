# Remove Stripe Connect & In-House Seller Onboarding Implementation Plan

Created: 2026-03-17
Status: COMPLETE
Approved: Yes
Iterations: 0
Worktree: Yes
Type: Feature

## Summary

**Goal:** Remove all Stripe Connect dependency and replace with in-house seller onboarding (PayPal payout details collection) and automated weekly PayPal Payouts for seller payments.

**Architecture:** Replace Stripe Connect's account creation, hosted onboarding, and automatic transfers with: (1) an in-house multi-step form collecting PayPal email as payout method, (2) a `PayoutRequest` model tracking pending/completed payouts, (3) modification of the escrow release cron to create PayoutRequests instead of Stripe transfers, (4) a new weekly cron job using PayPal Payouts API for batch processing every Friday 8pm HKT, and (5) an admin Payouts tab for oversight.

**Tech Stack:** Next.js 15, Prisma (new models with ULID IDs), PayPal Payouts SDK (`@paypal/payouts-sdk`), Postmark (payout emails), existing admin panel pattern.

## Scope

### In Scope

- Remove all Stripe Connect code (account creation, onboarding links, transfers, login links, `account.updated` webhook)
- New `SellerPayoutDetails` and `PayoutRequest` Prisma models
- In-house seller onboarding page (PayPal email form, terms acceptance, auto-approve)
- Modify escrow release cron to create PayoutRequests
- New weekly payout processing cron with PayPal Payouts API
- Admin Payouts management tab
- Update checkout flow (replace `stripeAccountId` check with payout details check)
- Update dashboard pages (remove Stripe self-heal logic)
- Migration of existing sellers' payout data
- Payout notification emails to sellers
- Environment variable additions (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`)
- Tests for all new services, repositories, and API routes

### Out of Scope

- Wise/bank transfer payout method (Phase 2 — schema designed for extensibility)
- PayPal webhook integration for payout status callbacks (manual status tracking sufficient for now)
- Seller payout history page (sellers can see payout status in their dashboard — dedicated history page is Phase 2)
- Removing `User.stripeAccountId` column (keep for backwards compatibility, not referenced in new code)
- Subscription system changes (SubscriptionService uses Stripe Billing, not Connect — unaffected)

## Context for Implementer

> Write for an implementer who has never seen the codebase.

- **Patterns to follow:**
  - Service pattern: `lib/services/FeedbackService.ts` — error classes, constructor injection, singleton in barrel export
  - Repository pattern: `lib/repositories/FeedbackRepository.ts` — ULID IDs via `generateUlid()` from `ulidx`, Prisma queries
  - API route pattern: `app/api/stripe/connect/onboard/route.ts` — auth check, validation, service call, error handling
  - Admin page pattern: `app/admin/transactions/page.tsx` — `requireAdmin()`, delegates to client component
  - Admin nav pattern: `components/admin/AdminNav.tsx:42-83` — add new item to `navItems` array
  - Cron job pattern: `app/api/cron/release-escrow/route.ts` — CRON_SECRET auth, batch processing, error counting
  - Email pattern: `lib/services/email/purchase-emails.ts` — email templates in dedicated files
  - Onboarding page pattern: `app/seller/onboard/page.tsx` — current file to rewrite

- **Conventions:**
  - New tables use ULID IDs: `id String @id` + `generateUlid()` in repository
  - Barrel exports in `lib/services/index.ts` and `lib/repositories/index.ts`
  - Error classes: `PayoutValidationError`, `PayoutNotFoundError`, `PayoutPermissionError`
  - Logging: `console.log('[ServiceName] message', { context })`
  - Cache keys in `lib/utils/cache.ts`

- **Key files:**
  - `prisma/schema.prisma` — add new models here
  - `lib/services/StripeService.ts` — strip Connect methods, keep `createPaymentIntent`, `refundPayment`
  - `app/api/cron/release-escrow/route.ts` — modify to create PayoutRequest instead of Stripe transfer
  - `app/dashboard/page.tsx` — heavy Stripe Connect self-heal logic to remove (lines 70-116)
  - `app/seller/dashboard/page.tsx` — Stripe verification check to remove (lines 51-70)
  - `app/seller/onboard/page.tsx` — full rewrite from Stripe redirect to in-house form
  - `app/api/checkout/create-intent/route.ts:99` — seller verification check to update
  - `components/admin/AdminNav.tsx:42` — add Payouts nav item
  - `config/env.ts` — add PayPal env vars
  - `lib/utils/cache.ts:310` — remove `stripeConnectStatus` cache key

- **Gotchas:**
  - `AdminService` constructor takes `StripeService` for `refundPayment()` — this stays, don't break it
  - `app/api/admin/stats/route.ts` and `app/api/admin/users/route.ts` pass `stripeService` to AdminService constructor — keep these
  - `handleAccountUpdated` in webhook handler is the ONLY webhook handler being removed — all others (payment, subscription, invoice) stay
  - The `stripeService` singleton export in `lib/services/index.ts` must stay (used by admin routes for refunds)
  - `User.payoutMethod` and `User.payoutEmail` already exist in schema — new `SellerPayoutDetails` model is the canonical source; keep User fields for backwards compat
  - `STRIPE_CONNECT_CONFIG` in `lib/stripe.ts` is only used by Connect — safe to remove
  - `calculateSellerPayout` in `lib/stripe.ts` is used by escrow cron's `transferToSeller` call — will use `calculatePaymentBreakdown` for PayoutRequest amounts instead

- **Domain context:**
  - Current flow: Buyer pays via Stripe Payment Intent → 7-day escrow → cron releases escrow and calls `stripeService.transferToSeller()` to send money to seller's Connect account
  - New flow: Buyer pays via Stripe Payment Intent (unchanged) → 7-day escrow → cron releases escrow and creates `PayoutRequest` → Friday 8pm HKT batch cron processes pending PayoutRequests via PayPal Payouts API
  - Platform fee: 15% (defined in `lib/stripe.ts` as `PLATFORM_FEE_PERCENTAGE`)
  - Commission in TransactionService uses 18% (`commissionRate = 0.18`) at `TransactionService.ts:149` — this is different from `lib/stripe.ts`'s 15%. The PayoutRequest should use the transaction's `sellerReceivesCents` as the payout amount (already commission-deducted).

## Runtime Environment

- **Start command:** `npm run docker:dev` (app:3011, postgres:5444, redis:6390)
- **Deploy:** Railway (auto-deploy on merge to `main`)
- **Health check:** `GET /` returns 200
- **Cron jobs:** Called via external HTTP (Railway Cron or GitHub Actions) with `Authorization: Bearer $CRON_SECRET`

## Feature Inventory

### Files Being Deleted

| File | Functions/Classes | Mapped To |
|------|------------------|-----------|
| `app/api/stripe/connect/onboard/route.ts` | `POST` handler (create Connect account, generate onboarding link) | Task 4 (new onboard API) |
| `app/api/stripe/connect/onboard/__tests__/route.test.ts` | Tests for onboard route | Task 4 |
| `app/api/stripe/connect/status/route.ts` | `GET` handler (check Connect account status) | Task 4 (new status API) |
| `app/api/stripe/connect/status/__tests__/route.test.ts` | Tests for status route | Task 4 |
| `app/api/stripe/connect/dashboard/route.ts` | `POST` handler (Stripe Express dashboard login link) | Out of Scope: REMOVED — no equivalent needed |

### Files Being Modified

| File | What Changes | Mapped To |
|------|-------------|-----------|
| `prisma/schema.prisma` | Add `SellerPayoutDetails` + `PayoutRequest` models | Task 1 |
| `lib/services/StripeService.ts` | Remove Connect methods (createConnectAccount, createAccountLink, getAccount, isAccountOnboarded, getOnboardingStatus, transferToSeller, createLoginLink). Keep createPaymentIntent, refundPayment. | Task 3 |
| `lib/stripe.ts` | Remove `STRIPE_CONNECT_CONFIG`. Keep fee calculations. | Task 3 |
| `lib/utils/cache.ts` | Remove `stripeConnectStatus` cache key | Task 3 |
| `lib/services/index.ts` | Add PayoutService export, keep StripeService export | Task 2 |
| `lib/repositories/index.ts` | Add PayoutRepository, SellerPayoutDetailsRepository exports | Task 2 |
| `app/api/cron/release-escrow/route.ts` | Replace `stripeService.transferToSeller()` with PayoutRequest creation | Task 5 |
| `app/api/checkout/create-intent/route.ts` | Replace `stripeAccountId`/`isVerifiedSeller` check with `SellerPayoutDetails` check | Task 6 |
| `app/api/webhooks/stripe/stripe-handlers-subscription.ts` | Remove `handleAccountUpdated` function | Task 3 |
| `app/api/webhooks/stripe/route.ts` | Remove `account.updated` case from switch | Task 3 |
| `app/seller/onboard/page.tsx` | Full rewrite: in-house PayPal email form | Task 4 |
| `app/seller/dashboard/page.tsx` | Remove Stripe verification self-heal, update onboarding step | Task 8 |
| `app/dashboard/page.tsx` | Remove Stripe self-heal logic (lines 70-116), update onboarding steps and status cards | Task 8 |
| `components/admin/AdminNav.tsx` | Add "Payouts" nav item | Task 7 |
| `config/env.ts` | Add `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE` | Task 2 |
| `lib/services/EmailService.ts` | Add `sendPayoutCompletedNotification`, remove `sendStripeConnectConfirmedNotification` | Task 5 |
| `lib/services/email/account-emails.ts` | Remove Stripe Connect confirmation email, add payout completed email | Task 5 |

### Files Being Created

| File | Purpose | Mapped To |
|------|---------|-----------|
| `prisma/migrations/YYYYMMDD_add_payout_models/migration.sql` | DB migration | Task 1 |
| `lib/repositories/SellerPayoutDetailsRepository.ts` | CRUD for seller payout details | Task 2 |
| `lib/repositories/PayoutRequestRepository.ts` | CRUD for payout requests | Task 2 |
| `lib/services/PayoutService.ts` | Payout business logic, PayPal API integration | Task 2 |
| `lib/paypal.ts` | PayPal client initialization | Task 2 |
| `app/api/seller/onboard/route.ts` | POST: submit payout details + become seller | Task 4 |
| `app/api/seller/onboard/status/route.ts` | GET: check onboarding status | Task 4 |
| `app/api/cron/process-payouts/route.ts` | Weekly payout batch processing cron | Task 5 |
| `app/admin/payouts/page.tsx` | Admin payout management page | Task 7 |
| `components/admin/PayoutManagement.tsx` | Admin payout management client component | Task 7 |
| `app/api/admin/payouts/route.ts` | GET: list payouts, POST: manual actions | Task 7 |
| `app/api/admin/payouts/[id]/route.ts` | PATCH: mark completed/retry failed | Task 7 |
| Tests for all new files | Unit tests | Tasks 2, 4, 5, 7 |

## Assumptions

- PayPal Business account with Payouts API access is available — Task 2 (PayPal client), Task 5 (batch processing) depend on this
- PayPal Payouts SDK (`@paypal/payouts-sdk`) is the correct npm package for server-side batch payouts — Task 2 depends on this
- Existing sellers in production have `payoutMethod` and `payoutEmail` populated — Task 9 (migration) depends on this
- Friday 8pm HKT = Friday 12:00 UTC (HKT is UTC+8) — Task 5 cron schedule depends on this
- The `sellerReceivesCents` field on Transaction already represents the correct payout amount (after platform commission) — Tasks 2, 5 depend on this

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PayPal Payouts API rejects batch (insufficient balance, invalid email) | Medium | High | PayoutRequest tracks individual failures with `failedReason`. Admin can retry. Email notification on failure. |
| Existing seller migration misses some users | Low | Medium | Migration script logs all processed users. Post-migration verification query counts users with `payoutEmail` but no `SellerPayoutDetails`. |
| Weekly payout timing (Friday 8pm HKT) falls on holiday/outage | Low | Low | PayoutRequests remain in `pending` until next successful batch. Admin can trigger manual batch. |
| PayPal account limits hit for large batches | Low | Medium | Batch processes in chunks of 50. Logs remaining count for next run. |
| Seller enters invalid PayPal email | Medium | Medium | Validate email format on submission. PayPal API returns error for invalid recipients — marked as `failed` with reason, seller notified to update. |

## Goal Verification

### Truths

1. A new user can complete seller onboarding entirely within CodeSalvage (no Stripe redirect)
2. After onboarding, `isVerifiedSeller` is `true` and `SellerPayoutDetails` exists with their PayPal email
3. Buyers can purchase projects from onboarded sellers (checkout creates Payment Intent)
4. After 7-day escrow release, a `PayoutRequest` is created automatically
5. The weekly cron processes pending PayoutRequests via PayPal Payouts API
6. Admin can view, retry, and manually complete payouts in the admin panel
7. No Stripe Connect API calls exist anywhere in the codebase

### Artifacts

1. `app/seller/onboard/page.tsx` — in-house form, no Stripe redirect
2. `lib/services/PayoutService.ts` — PayPal batch processing logic
3. `app/api/cron/process-payouts/route.ts` — weekly batch cron
4. `app/api/cron/release-escrow/route.ts` — creates PayoutRequest, no Stripe transfer
5. `app/api/checkout/create-intent/route.ts` — checks `SellerPayoutDetails`, not `stripeAccountId`
6. `components/admin/PayoutManagement.tsx` — admin oversight UI
7. `lib/services/StripeService.ts` — only `createPaymentIntent` and `refundPayment` remain

## Progress Tracking

- [x] Task 1: Database schema (SellerPayoutDetails + PayoutRequest models)
- [x] Task 2: PayoutService + Repositories + PayPal client
- [x] Task 3: Remove Stripe Connect code
- [x] Task 4: In-house seller onboarding (API routes + UI)
- [x] Task 5: Escrow release + weekly payout cron
- [x] Task 6: Update checkout flow
- [x] Task 7: Admin payout management
- [x] Task 8: Update dashboard pages
- [x] Task 9: Existing seller migration
- [x] Task 10: Update tests for modified files

**Total Tasks:** 10 | **Completed:** 10 | **Remaining:** 0

## Implementation Tasks

### Task 1: Database Schema — SellerPayoutDetails + PayoutRequest Models

**Objective:** Add two new Prisma models for payout tracking and create the migration.

**Dependencies:** None

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_payout_models/migration.sql` (auto-generated by `prisma migrate dev`)

**Key Decisions / Notes:**

- Both models use ULID IDs (`id String @id` — generated in repository layer via `generateUlid()`)
- `SellerPayoutDetails` has a unique constraint on `userId` (one active payout method per seller)
- `PayoutRequest` links to `Transaction` (unique — one payout per transaction) and `User` (seller)
- `PayoutRequest.status` enum: `pending`, `processing`, `completed`, `failed`
- `PayoutRequest.processedBy` references admin user who manually completed (nullable — null for automated)
- Add relations to `User` model: `sellerPayoutDetails SellerPayoutDetails?` and `payoutRequests PayoutRequest[]`
- Add relation to `Transaction` model: `payoutRequest PayoutRequest?`

**Definition of Done:**

- [ ] `SellerPayoutDetails` model with fields: id, userId (unique), payoutMethod, payoutEmail, payoutDetails (Json?), isActive, createdAt, updatedAt
- [ ] `PayoutRequest` model with fields: id, transactionId (unique), sellerId, amountCents, commissionCents, payoutMethod, payoutEmail, status, externalReference, processedAt, processedBy, failedReason, batchId, createdAt, updatedAt
- [ ] Relations added to User and Transaction models
- [ ] Indexes on status, sellerId, batchId for PayoutRequest
- [ ] Migration runs successfully: `npx prisma migrate dev --name add_payout_models`
- [ ] `npx prisma generate` succeeds

**Verify:**

- `npx prisma migrate dev --name add_payout_models && npx prisma generate`

---

### Task 2: PayoutService + Repositories + PayPal Client

**Objective:** Create the service layer for payout operations and the PayPal client.

**Dependencies:** Task 1

**Files:**

- Install: `npm install @paypal/payouts-sdk` (update package.json + package-lock.json)
- Create: `lib/paypal.ts`
- Create: `lib/repositories/SellerPayoutDetailsRepository.ts`
- Create: `lib/repositories/PayoutRequestRepository.ts`
- Create: `lib/services/PayoutService.ts`
- Modify: `lib/services/index.ts` (add exports)
- Modify: `lib/repositories/index.ts` (add exports)
- Modify: `config/env.ts` (add PayPal env vars)
- Create: `lib/repositories/__tests__/SellerPayoutDetailsRepository.test.ts`
- Create: `lib/repositories/__tests__/PayoutRequestRepository.test.ts`
- Create: `lib/services/__tests__/PayoutService.test.ts`

**Key Decisions / Notes:**

- `lib/paypal.ts`: Initialize PayPal environment (Sandbox/Live based on `PAYPAL_MODE` env var), create PayPal HTTP client. Use `@paypal/payouts-sdk` package.
- `SellerPayoutDetailsRepository`: `create`, `findByUserId`, `update`, `deactivate`
- `PayoutRequestRepository`: `create`, `findById`, `findPending`, `findBySellerId`, `updateStatus`, `findByBatchId`, `listWithFilters` (for admin)
- `PayoutService`: constructor takes both repos + EmailService. Methods: `submitPayoutDetails(userId, data)` — creates SellerPayoutDetails + sets isSeller/isVerifiedSeller; `createPayoutRequest(transactionId)` — creates pending request; `processBatch()` — finds pending, calls PayPal Payouts API, updates statuses; `markCompleted(id, adminId, reference)` — manual completion; `retryFailed(id)` — resets to pending
- PayPal Payouts API: batch create with `sender_batch_header` (unique batch ID) and `items[]` (each with `recipient_type: 'EMAIL'`, `receiver`, `amount`)
- Follow error class pattern: `PayoutValidationError`, `PayoutPermissionError`, `PayoutNotFoundError`

**Definition of Done:**

- [ ] `@paypal/payouts-sdk` installed and in package.json (verify correct package vs newer `@paypal/paypal-server-sdk`)
- [ ] PayPal client initializes correctly with env vars
- [ ] SellerPayoutDetailsRepository CRUD operations work
- [ ] PayoutRequestRepository CRUD and query operations work
- [ ] PayoutService.submitPayoutDetails creates details and updates user flags
- [ ] PayoutService.processBatch calls PayPal API and updates statuses
- [ ] PayoutRequest.amountCents always equals transaction.sellerReceivesCents — never recalculated from price
- [ ] Unit test assertion: given transaction with sellerReceivesCents=82000, PayoutRequest has amountCents=82000
- [ ] All unit tests pass with mocked PayPal API
- [ ] Barrel exports updated

**Verify:**

- `npx vitest run lib/repositories/__tests__/SellerPayoutDetailsRepository.test.ts lib/repositories/__tests__/PayoutRequestRepository.test.ts lib/services/__tests__/PayoutService.test.ts`

---

### Task 3: Remove Stripe Connect Code

**Objective:** Strip all Stripe Connect functionality while preserving Payment Intents and refunds.

**Dependencies:** None (can run parallel with Tasks 1-2)

**Files:**

- Modify: `lib/services/StripeService.ts` (remove 7 methods, keep 2)
- Modify: `lib/stripe.ts` (remove `STRIPE_CONNECT_CONFIG`)
- Modify: `lib/utils/cache.ts` (remove `stripeConnectStatus` key)
- Modify: `app/api/webhooks/stripe/stripe-handlers-subscription.ts` (remove `handleAccountUpdated`)
- Modify: `app/api/webhooks/stripe/route.ts` (remove `account.updated` case)
- Delete: `app/api/stripe/connect/onboard/route.ts`
- Delete: `app/api/stripe/connect/onboard/__tests__/route.test.ts`
- Delete: `app/api/stripe/connect/status/route.ts`
- Delete: `app/api/stripe/connect/status/__tests__/route.test.ts`
- Delete: `app/api/stripe/connect/dashboard/route.ts`
- Modify: `lib/services/email/account-emails.ts` (remove `sendStripeConnectConfirmedNotification`)
- Modify: `lib/services/EmailService.ts` (remove Connect-related method)

**Key Decisions / Notes:**

- StripeService keeps: `createPaymentIntent`, `refundPayment` (used by AdminService)
- StripeService removes: `createConnectAccount`, `createAccountLink`, `getAccount`, `isAccountOnboarded`, `getOnboardingStatus`, `transferToSeller`, `createLoginLink`
- Remove `StripeUserData` interface (only used by Connect methods)
- Remove `STRIPE_CONNECT_CONFIG` and `calculateSellerPayout` from `lib/stripe.ts` — `calculatePaymentBreakdown` stays (still used in checkout)
- The `stripeService` singleton and its barrel export stay (AdminService needs it for refunds)
- `handleAccountUpdated` is removed from subscription handlers but the file keeps all subscription/invoice handlers
- Delete the entire `app/api/stripe/connect/` directory tree

**Definition of Done:**

- [ ] StripeService only has `createPaymentIntent` and `refundPayment`
- [ ] No references to Connect API calls anywhere in codebase
- [ ] `STRIPE_CONNECT_CONFIG` removed from `lib/stripe.ts`
- [ ] `account.updated` webhook handler removed
- [ ] Connect API routes deleted (onboard, status, dashboard)
- [ ] `stripeConnectStatus` cache key removed
- [ ] TypeScript compiles: `npm run type-check`
- [ ] Existing tests pass (AdminService tests still work with refund)

**Verify:**

- `npm run type-check && npx vitest run lib/services/__tests__/AdminService.test.ts`

---

### Task 4: In-House Seller Onboarding (API + UI)

**Objective:** Replace Stripe-hosted onboarding with an in-house form for collecting PayPal payout details.

**Dependencies:** Task 1, Task 2

**Files:**

- Create: `app/api/seller/onboard/route.ts` (POST: submit payout details)
- Create: `app/api/seller/onboard/status/route.ts` (GET: check onboarding status)
- Rewrite: `app/seller/onboard/page.tsx` (full rewrite)
- Create: `app/api/seller/onboard/__tests__/route.test.ts`
- Create: `app/api/seller/onboard/status/__tests__/route.test.ts`

**Key Decisions / Notes:**

- `POST /api/seller/onboard`: Validates PayPal email (Zod), calls `payoutService.submitPayoutDetails()`, which creates SellerPayoutDetails and sets `isSeller=true`, `isVerifiedSeller=true`. Returns success.
- `GET /api/seller/onboard/status`: Returns `{ isOnboarded: boolean, payoutMethod: string | null, payoutEmail: string | null }` based on `SellerPayoutDetails` existence.
- UI: Single-page form with: (1) PayPal email input with validation, (2) Terms acceptance checkbox (15% commission, 7-day escrow, weekly Friday payouts), (3) Submit button. Show success state after submission with link to seller dashboard.
- Follow existing UI patterns: Shadcn Card components, Lucide icons, loading/error states.
- Non-sellers who submit this form become sellers in one step (isSeller + isVerifiedSeller + payout details all set atomically).

**Definition of Done:**

- [ ] POST /api/seller/onboard creates SellerPayoutDetails and sets user as verified seller
- [ ] GET /api/seller/onboard/status returns correct onboarding status
- [ ] Onboarding page renders form with PayPal email input and terms
- [ ] Form validates email format before submission
- [ ] Success state shows after submission with dashboard link
- [ ] Error states display for network/validation errors
- [ ] All API route tests pass

**Verify:**

- `npx vitest run app/api/seller/onboard/__tests__/route.test.ts app/api/seller/onboard/status/__tests__/route.test.ts`

---

### Task 5: Escrow Release + Weekly Payout Cron

**Objective:** Modify escrow release to create PayoutRequests and add weekly batch processing cron.

**Dependencies:** Task 1, Task 2

**Files:**

- Modify: `app/api/cron/release-escrow/route.ts` (replace Stripe transfer with PayoutRequest creation)
- Create: `app/api/cron/process-payouts/route.ts` (weekly PayPal batch payout)
- Modify: `lib/services/EmailService.ts` (add payout notification methods)
- Create: `lib/services/email/payout-emails.ts` (payout email templates)
- Create: `app/api/cron/__tests__/process-payouts.test.ts`

**Key Decisions / Notes:**

- Escrow release cron: After calling `transactionService.releaseEscrow(id)`, create `PayoutRequest` via `payoutService.createPayoutRequest(transactionId)` using the transaction's `sellerReceivesCents`. Remove `stripeService.transferToSeller()` call and `seller.stripeAccountId` check. Instead check seller has active `SellerPayoutDetails`.
- Weekly payout cron: `GET /api/cron/process-payouts`, CRON_SECRET auth (same pattern). Schedule: `0 12 * * 5` (Friday 12:00 UTC = Friday 20:00 HKT). Calls `payoutService.processBatch()` which: finds all `pending` PayoutRequests, groups by payout method, calls PayPal Payouts API for PayPal batch, updates statuses, sends email notifications.
- Email: `sendPayoutCompletedNotification(recipient, { sellerName, amount, transactionId, payoutMethod })` and `sendPayoutFailedNotification(recipient, { sellerName, amount, reason })`
- Payout email replaces Stripe Connect confirmation email in `account-emails.ts`

**Definition of Done:**

- [ ] Escrow release cron creates PayoutRequest instead of Stripe transfer
- [ ] Escrow release cron no longer references `stripeService` or `stripeAccountId`
- [ ] If seller has no active SellerPayoutDetails at escrow release time, log error, increment errorCount, skip (do not create PayoutRequest)
- [ ] Weekly payout cron authenticates and processes pending PayoutRequests
- [ ] PayPal Payouts API called with correct batch format (item amount from payoutRequest.amountCents, not recalculated)
- [ ] Payout completion email sent to seller
- [ ] Payout failure email sent to seller with reason
- [ ] Cron tests pass with mocked PayPal API

**Verify:**

- `npx vitest run app/api/cron/__tests__/process-payouts.test.ts`

---

### Task 6: Update Checkout Flow

**Objective:** Replace seller Stripe Connect verification with SellerPayoutDetails check in checkout.

**Dependencies:** Task 1, Task 2

**Files:**

- Modify: `app/api/checkout/create-intent/route.ts`

**Key Decisions / Notes:**

- Current check at line 99: `if (!project.seller.stripeAccountId || !project.seller.isVerifiedSeller)` — replace with a check that the seller has an active `SellerPayoutDetails` record.
- Query: change the `seller` select in the Prisma include to fetch `sellerPayoutDetails` (where `isActive: true`) instead of `stripeAccountId` and `isVerifiedSeller`.
- Error message: change from "Seller has not completed payment setup" to same or similar.
- Keep `isVerifiedSeller` in the select for the `project.seller` as other code may reference it, but the primary check is now `sellerPayoutDetails`.

**Definition of Done:**

- [ ] Checkout no longer checks `stripeAccountId`
- [ ] Checkout verifies seller has active `SellerPayoutDetails`
- [ ] Buyers cannot purchase from sellers without payout setup
- [ ] Existing checkout test updated to reflect new check

**Verify:**

- `npx vitest run app/api/checkout/__tests__/create-intent.test.ts 2>/dev/null || echo "no existing test"`

---

### Task 7: Admin Payout Management

**Objective:** Add a Payouts tab to the admin panel for oversight and manual actions.

**Dependencies:** Task 1, Task 2

**Files:**

- Create: `app/admin/payouts/page.tsx`
- Create: `components/admin/PayoutManagement.tsx`
- Create: `app/api/admin/payouts/route.ts` (GET: list payouts with filters)
- Create: `app/api/admin/payouts/[id]/route.ts` (PATCH: mark completed/retry)
- Modify: `components/admin/AdminNav.tsx` (add Payouts item)

**Key Decisions / Notes:**

- Admin page pattern: server component with `requireAdmin()`, delegates to `PayoutManagement` client component.
- `PayoutManagement` component: table with columns (ID, Seller, Amount, Method, Status, Created, Actions). Filters: status (all/pending/processing/completed/failed). Actions: "Mark Completed" (opens dialog for external reference), "Retry" (for failed).
- `GET /api/admin/payouts`: Paginated list with status filter. Returns PayoutRequests with seller info.
- `PATCH /api/admin/payouts/[id]`: Body `{ action: 'complete' | 'retry', externalReference?: string }`. Complete: sets status=completed, processedAt, processedBy. Retry: resets status=pending, clears failedReason.
- AdminNav: add `{ href: '/admin/payouts', label: 'Payouts', icon: Wallet }` (import `Wallet` from lucide-react). Insert after Transactions in the nav items array.

**Definition of Done:**

- [ ] "Payouts" appears in admin sidebar navigation
- [ ] Admin payouts page lists PayoutRequests with seller details
- [ ] Status filter works (all/pending/processing/completed/failed)
- [ ] "Mark Completed" action sets status and records admin + reference
- [ ] "Retry" action resets failed payout to pending
- [ ] Admin API routes require admin authentication

**Verify:**

- `npm run type-check`

---

### Task 8: Update Dashboard Pages

**Objective:** Remove all Stripe Connect self-heal logic and update onboarding references.

**Dependencies:** Task 2, Task 3, Task 4

**Files:**

- Modify: `app/dashboard/page.tsx`
- Modify: `app/seller/dashboard/page.tsx`

**Key Decisions / Notes:**

- `app/dashboard/page.tsx`:
  - Remove `import { stripeService } from '@/lib/services'` (line 11)
  - Remove `stripeAccountId` and `stripeService.getOnboardingStatus()` self-heal block (lines 70-116)
  - Remove `onboardingStatus` variable and Stripe-specific status cards (lines 206-252 "Account Under Review" and "Complete Your Payment Setup")
  - Replace `isVerifiedSeller` check with query for `SellerPayoutDetails` existence
  - Update seller onboarding step description from "Connect payment account" to "Set up payout details"
  - Update Account Status card: replace Stripe-specific states with "Payout setup: Connected/Not set up"
  - Select `sellerPayoutDetails` in user query instead of `stripeAccountId`

- `app/seller/dashboard/page.tsx`:
  - Remove `import { stripeService } from '@/lib/services'` (line 19)
  - Remove Stripe verification self-heal block (lines 51-70)
  - Replace `stripeAccountId`/`isVerifiedSeller` logic with `SellerPayoutDetails` check
  - Update onboarding step: label "Set up payout details", description "Required before buyers can purchase your projects.", href stays `/seller/onboard`

**Definition of Done:**

- [ ] No `stripeService` import in either dashboard page
- [ ] No Stripe Connect self-heal logic in either page
- [ ] Onboarding steps reference payout details, not Stripe
- [ ] Dashboard status cards reflect new payout system
- [ ] Both pages render without errors

**Verify:**

- `npm run type-check`

---

### Task 9: Existing Seller Migration

**Objective:** Migrate existing sellers with payoutMethod/payoutEmail to SellerPayoutDetails.

**Dependencies:** Task 1

**Files:**

- Create: `prisma/migrations/<timestamp>_migrate_existing_seller_payouts/migration.sql` (data migration)

**Key Decisions / Notes:**

- SQL migration: `INSERT INTO seller_payout_details (id, user_id, payout_method, payout_email, is_active, created_at, updated_at) SELECT gen_random_uuid()::text, id, payout_method, payout_email, true, now(), now() FROM users WHERE payout_email IS NOT NULL AND payout_method IS NOT NULL`
- Note: Using `gen_random_uuid()` in SQL since ULID generation requires app code. The IDs from this migration will be UUID-format rather than ULID, which is fine for existing data. Add SQL comment: `-- NOTE: Using gen_random_uuid() here instead of ULID (app-only generation). Both are valid text PKs.`
- This is a data-only migration — no schema changes.
- Include a count verification: `DO $$ DECLARE migrated INT; source INT; BEGIN SELECT count(*) INTO source FROM users WHERE payout_email IS NOT NULL AND payout_method IS NOT NULL; SELECT count(*) INTO migrated FROM seller_payout_details; RAISE NOTICE 'Migrated % of % sellers', migrated, source; END $$;`

**Definition of Done:**

- [ ] Migration creates SellerPayoutDetails for all existing sellers with payout data
- [ ] Migration is idempotent (can run twice without duplicates — ON CONFLICT DO NOTHING)
- [ ] Verification count logged
- [ ] Migrated records have UUID-format IDs (valid text PKs). New records from app will have ULID-format IDs. Both coexist correctly.
- [ ] Migration file created in prisma/migrations

**Verify:**

- `npx prisma migrate dev --name migrate_existing_seller_payouts`

---

### Task 10: Update Tests for Modified Files

**Objective:** Fix and update existing tests broken by Stripe Connect removal.

**Dependencies:** Tasks 3, 5, 6, 8

**Files:**

- Modify: `app/api/cron/__tests__/release-escrow.test.ts` (if exists — update to expect PayoutRequest creation instead of Stripe transfer)
- Modify: `app/dashboard/__tests__/page.test.tsx` (remove Stripe status mocks)
- Modify: `app/seller/dashboard/__tests__/page.test.tsx` (remove Stripe status mocks)
- Modify: `app/api/checkout/create-intent/__tests__/route.test.ts` (if exists — update seller verification check)
- Modify: Any other tests that mock `stripeService.transferToSeller`, `stripeService.createConnectAccount`, etc.

**Key Decisions / Notes:**

- Run `npm run test:ci` to find all failing tests
- For each failure: remove/update Stripe Connect mocks, add SellerPayoutDetails mocks where needed
- The `AdminService.test.ts` should still pass — it only mocks `refundPayment` which we kept
- `stripe-handlers-subscription` tests need `handleAccountUpdated` references removed

**Definition of Done:**

- [ ] `npm run test:ci` passes with 0 failures
- [ ] `npm run type-check` passes
- [ ] No test references to removed Stripe Connect methods
- [ ] New test coverage for PayoutRequest creation in escrow release
- [ ] Test: escrow cron should skip and increment errorCount when seller has no SellerPayoutDetails

**Verify:**

- `npm run test:ci && npm run type-check`

## Open Questions

1. **PayPal API credentials** — José needs to provide `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` and confirm whether to use Sandbox or Live mode for initial development.

### Deferred Ideas

- **Wise Business API** — add as alternative payout method when PayPal coverage is insufficient
- **Seller payout history page** — dedicated `/seller/payouts` page showing all payout requests and statuses
- **PayPal webhook** — listen for `PAYMENT.PAYOUTS-ITEM.SUCCEEDED` etc. to auto-update PayoutRequest status instead of polling
- **Automated retry** — cron that retries failed payouts after 24 hours instead of waiting for admin
- **Payout dashboard widget** — seller dashboard card showing pending/completed payout amounts
