# Purchase Flow Implementation Plan

Created: 2026-02-18
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

**Goal:** Redesign the purchase flow into a 5-step process where: (1) offer accepted, (2) payment triggers escrow + **immediate** collaborator access for the buyer, (3) 7-day review period with countdown and dispute window, (4) automatic ownership transfer after review period ends, (5) escrow release after ownership transfer.

**Architecture:** Extend the existing `RepositoryTransferService` + `GitHubService` + `TransactionService` layered architecture. The key behavioral changes are: (a) buyer gets collaborator access automatically when they provide their GitHub username (no seller action needed), (b) after the 7-day review period, a cron/background process auto-initiates ownership transfer via the GitHub Transfer API, and (c) escrow release is triggered by successful ownership transfer rather than a timer. A 14-day absolute fallback ensures funds are released even if transfer fails.

**Tech Stack:** Next.js 15, TypeScript, Prisma, GitHub REST API v3, Stripe (existing escrow), Shadcn/ui components

## Scope

### In Scope

- **Auto-collaborator at payment:** When buyer submits GitHub username, system immediately adds them as collaborator (no seller action)
- New `transferOwnership()` method on `GitHubService` using GitHub Transfer API (`POST /repos/{owner}/{repo}/transfer`)
- New `ownershipTransferredAt` field + `ownership_transferred` status on RepositoryTransfer
- Auto-transfer logic: after 7-day review period, system automatically initiates ownership transfer
- Escrow release trigger: changes from time-based to event-based (ownership transfer completion)
- API endpoint for transfer (cron trigger + optional early seller action)
- 7-day review countdown UI on transaction detail page
- Updated timeline stages reflecting the corrected flow
- Updated how-it-works page with 5-step flow
- Updated home page with purchase flow marketing section
- Updated success page step descriptions
- Unit tests for all new/modified service and repository methods

### Out of Scope

- Dispute flow (separate feature — but the countdown and dispute window UI is in scope)
- Email notifications for ownership transfer events
- Changes to Stripe payment processing
- Changes to the offer system (step 1 already works)
- Seller collaborator access removal post-transfer (deferred — seller retains collaborator access on buyer-owned repo after transfer, to be addressed in a follow-up)

## Prerequisites

- GitHub App installed on seller's repos with Administration permission (for transfer API)
- Existing RepositoryTransfer infrastructure (already exists)
- Existing timeline components: `TransactionTimeline`, `RepositoryTransferCard`, `ReviewPeriodCard`

## Context for Implementer

- **Patterns to follow:** Follow the existing `addCollaborator()` pattern in `lib/services/GitHubService.ts:288` for the new `transferOwnership()` method. Uses `githubRequest()` private helper.
- **Conventions:** Services use constructor injection. Repositories use ULID for IDs. All status transitions go through `RepositoryTransferRepository.updateStatus()`.
- **Key files:**
  - `lib/services/GitHubService.ts` — GitHub API integration (has `githubRequest()` helper for authenticated requests)
  - `lib/services/RepositoryTransferService.ts` — Transfer lifecycle logic, timeline builder (5 stages already exist)
  - `lib/services/TransactionService.ts` — Escrow creation (line 155: `escrowReleaseDate.setDate(escrowReleaseDate.getDate() + 7)`)
  - `lib/repositories/RepositoryTransferRepository.ts` — CRUD for transfer records
  - `lib/repositories/TransactionRepository.ts` — Has `releaseEscrow()` method
  - `prisma/schema.prisma` — RepositoryTransfer model at line 606, Transaction at line 221
  - `components/transactions/TransactionTimeline.tsx` — Timeline UI component
  - `components/transactions/RepositoryTransferCard.tsx` — Repo transfer action card
  - `components/transactions/ReviewPeriodCard.tsx` — Review period card with countdown
  - `app/transactions/[id]/page.tsx` — Transaction detail page (already wired to timeline + cards)
  - `app/api/transactions/[id]/buyer-github/route.ts` — Buyer GitHub username submission endpoint
  - `app/how-it-works/page.tsx` — Public marketing page (419 lines)
  - `app/checkout/success/page.tsx` — Post-payment success page
- **Gotchas:**
  - GitHub Transfer API requires the authenticated user/app to be an **admin** of the repository
  - The transfer creates an invitation that the **new owner must accept** via email/notification
  - `RepositoryTransfer.status` current values: `pending`, `invitation_sent`, `accepted`, `completed`, `failed`
  - Currently, `setBuyerGithubUsername()` just saves the username. Separately, `initiateTransfer()` calls `addCollaborator()`. These need to be merged so username submission auto-triggers collaborator access.
  - The `buildEscrowReleasedStage()` currently keys off `escrowStatus === 'released'` — needs to also check ownership transfer status
  - The existing escrow auto-release cron checks `escrowReleaseDate` — this needs to be changed to initiate ownership transfer instead of directly releasing escrow
- **Domain context:** The corrected "test drive" model: buyer pays → immediately gets collaborator access (when they provide their GitHub username). They have 7 days to review the code and can raise disputes. After 7 days, the dispute window closes and ownership is automatically transferred from the seller to the buyer via the GitHub Transfer API. Escrow funds are released after successful ownership transfer. A 14-day absolute fallback ensures the seller gets paid even if the transfer encounters technical issues.

## Runtime Environment

- **Start command:** `npm run docker:dev` (Docker containers)
- **Port:** 3011
- **Health check:** `curl http://localhost:3011`
- **Test command:** `npm run test:ci`

## Progress Tracking

**MANDATORY: Update this checklist as tasks complete. Change `[ ]` to `[x]`.**

- [x] Task 1: Schema — add `transferInitiatedAt` + `ownershipTransferredAt` fields + new statuses
- [x] Task 2: Auto-collaborator on buyer GitHub username submission
- [x] Task 3: `GitHubService.transferOwnership()` — GitHub Transfer API method
- [x] Task 4: `RepositoryTransferService` — auto-transfer + escrow release logic
- [x] Task 5: API endpoint for ownership transfer (cron trigger + optional early transfer)
- [x] Task 6: Timeline UI + review countdown updates
- [x] Task 7: How-it-works page — 5-step corrected flow
- [x] Task 8: Success page + home page marketing updates

**Total Tasks:** 8 | **Completed:** 8 | **Remaining:** 0

## Implementation Tasks

### Task 1: Schema — add `ownershipTransferredAt` field + `ownership_transferred` status

**Objective:** Add a new timestamp field to track when GitHub ownership transfer was completed, and document `ownership_transferred` as a valid status value.

**Dependencies:** None

**Files:**

- Modify: `prisma/schema.prisma` (RepositoryTransfer model, line 606)
- Create: New Prisma migration (user will run it)

**Key Decisions / Notes:**

- Add `ownershipTransferredAt DateTime? @map("ownership_transferred_at")` after `completedAt` (line 632)
- The `status` field already accepts any string — add `ownership_transferred` to the comment documenting valid values
- Status lifecycle becomes: `pending` → `invitation_sent` → `accepted` → `completed` → `transfer_initiated` → `ownership_transferred`
- `completed` = collaborator access confirmed. `transfer_initiated` = GitHub Transfer API returned 202 (transfer is async — buyer must accept via GitHub email). `ownership_transferred` = buyer accepted the transfer (confirmed via webhook or polling).
- **Important:** The GitHub Transfer API (`POST /repos/{owner}/{repo}/transfer`) is asynchronous — a 202 response means the transfer is queued, NOT that ownership has changed. The buyer must accept via a GitHub email/notification. Escrow is released at `transfer_initiated` (we've done our part), not at `ownership_transferred`.
- Add `transferInitiatedAt DateTime? @map("transfer_initiated_at")` alongside `ownershipTransferredAt`

**Definition of Done:**

- [ ] `transferInitiatedAt` and `ownershipTransferredAt` fields added to `RepositoryTransfer` model in schema
- [ ] Status comment updated to include `transfer_initiated` and `ownership_transferred`
- [ ] Migration file generated (`npx prisma migrate dev --name add-transfer-ownership-fields`)
- [ ] `npx prisma generate` succeeds
- [ ] Type check passes: `npm run type-check`

**Verify:**

- `npx prisma validate` — schema is valid
- `npm run type-check` — no type errors

### Task 2: Auto-collaborator on buyer GitHub username submission

**Objective:** When the buyer submits their GitHub username (via the success page form), the system should **immediately** add them as a collaborator on the repo — no seller action needed. Currently `setBuyerGithubUsername()` only saves the username; `initiateTransfer()` (which calls `addCollaborator()`) requires a separate seller action. Merge these so username submission auto-triggers collaborator access.

**Dependencies:** None

**Files:**

- Modify: `lib/services/RepositoryTransferService.ts` — update `setBuyerGithubUsername()` to also call `addCollaborator()`
- Modify: `app/api/transactions/[id]/buyer-github/route.ts` — may need adjustment if flow changes
- Modify: `lib/services/__tests__/RepositoryTransferService.test.ts` — update tests

**Key Decisions / Notes:**

- The existing `setBuyerGithubUsername()` saves the username and returns. Enhance it (or create a new method `grantCollaboratorAccess()`) to:
  1. Check if a `RepositoryTransfer` record exists for this transaction. **If not, auto-create one** (status: `pending`, with seller's GitHub username and repo info from the transaction/project). This is critical because in the new flow, the seller never calls `initiateTransfer()` — the record must be created automatically.
  2. Validate seller's `githubAccessToken` is not null. If null, throw `RepositoryTransferValidationError('Seller GitHub account not connected — cannot grant collaborator access')`.
  3. Save the buyer's GitHub username on the transfer record
  4. Look up the project's GitHub repo URL from the transaction
  5. Call `gitHubService.addCollaborator()` with the buyer's username using the seller's decrypted token
  6. Update transfer status to `invitation_sent`
  7. Return success/failure
- The buyer-github API route already authenticates the buyer — keep that. Just ensure the response flow handles the collaborator addition.
- If `addCollaborator()` fails (e.g., invalid username), save the username anyway but return a clear error message so the buyer can correct it.
- This replaces the seller's manual `initiateTransfer()` step for collaborator access. The seller no longer needs to do anything for step 3.

**Definition of Done:**

- [ ] RepositoryTransfer record auto-created if none exists (no seller action needed)
- [ ] Seller's `githubAccessToken` null check added — returns clear error if not connected
- [ ] Buyer GitHub username submission auto-triggers `addCollaborator()`
- [ ] Transfer status moves to `invitation_sent` on success
- [ ] Username is saved even if `addCollaborator()` fails (buyer can retry)
- [ ] Clear error messages for: invalid GitHub username, repo not found, permission denied, seller not connected
- [ ] Unit tests cover: success (record auto-created + username saved + collaborator added), existing record (username updated + collaborator added), GitHub API failure (username saved, collaborator not added), seller token null, invalid username
- [ ] Type check passes

**Verify:**

- `npx vitest run lib/services/__tests__/RepositoryTransferService.test.ts -q` — all tests pass
- `npm run type-check` — no type errors

### Task 3: `GitHubService.transferOwnership()` — GitHub Transfer API method

**Objective:** Add a method to call GitHub's repository transfer API (`POST /repos/{owner}/{repo}/transfer`) to initiate ownership transfer to the buyer.

**Dependencies:** None

**Files:**

- Modify: `lib/services/GitHubService.ts`
- Create: `lib/services/__tests__/GitHubService.test.ts` (add test cases for new method)

**Key Decisions / Notes:**

- Use the existing `githubRequest()` private helper (line 456) for the API call
- GitHub Transfer API: `POST /repos/{owner}/{repo}/transfer` with body `{ "new_owner": "<username>" }`
- Returns 202 Accepted on success (transfer is async — new owner gets email invitation)
- Handle 401 (token expired/revoked — seller needs to reconnect GitHub), 403 (insufficient permissions), 404 (repo not found), 422 (validation failed)
- 401 errors should be distinguished from 403: 401 means the seller's OAuth token is invalid (not retryable without seller re-auth), 403 means the token works but lacks admin permission
- Follow the same error handling pattern as `addCollaborator()` (line 288)

**Definition of Done:**

- [ ] `transferOwnership(owner, repo, newOwner, token)` method added to GitHubService
- [ ] Method returns `{ success: boolean; error?: string }` with appropriate data
- [ ] Proper error handling for 401, 403, 404, 422 status codes (401 = token expired, not retryable)
- [ ] Unit tests cover: success case (202), 401, 403, 404, 422, and network error
- [ ] Type check passes

**Verify:**

- `npx vitest run lib/services/__tests__/GitHubService.test.ts -q` — all tests pass
- `npm run type-check` — no type errors

### Task 4: `RepositoryTransferService` — auto-transfer + escrow release logic

**Objective:** Add the core business logic for automatic ownership transfer after the 7-day review period ends, and wire it to trigger escrow release on success.

**Dependencies:** Task 1, Task 3

**Files:**

- Modify: `lib/services/RepositoryTransferService.ts`
- Modify: `lib/services/__tests__/RepositoryTransferService.test.ts`

**Key Decisions / Notes:**

- Add `transferOwnership(transactionId: string)` method:
  1. Load transaction + transfer record
  2. Validate: payment succeeded, transfer status is `completed` OR `invitation_sent` (both mean collaborator access was initiated — we don't need to wait for buyer to accept the collaborator invite before proceeding with ownership transfer)
  3. Validate: buyer GitHub username is set on transfer record (if not set, skip — buyer never provided username)
  4. Parse seller's repo URL to get owner/repo
  5. **Concurrency guard:** Atomically set `escrowStatus` to `transfer_processing` (conditional on current status being `held`). If the update fails (another worker claimed it), skip this transaction.
  6. Call `gitHubService.transferOwnership(owner, repo, buyerUsername, sellerToken)`
  7. On success (202): update transfer status to `transfer_initiated`, set `transferInitiatedAt = now`. Release escrow via `transactionRepository.releaseEscrow(transactionId)`. Note: 202 means transfer is queued — buyer must accept via GitHub email. Escrow is released at initiation since the system has done its part.
  8. On 401 (token expired): log error, do NOT increment retry count (not retryable without seller re-auth), flag for admin notification
  9. On other failure: log error, increment retry count (using existing `RepositoryTransfer.retryCount` field + `RepositoryTransferRepository.incrementRetryCount()`), set status to `failed` with error message, reset `escrowStatus` back to `held`
- Add `processAutoTransfers()` method for cron:
  1. Find all transactions where `escrowReleaseDate <= now` AND `escrowStatus === 'held'` AND transfer status is NOT `ownership_transferred`
  2. For each transaction:
     - If transfer status is `pending` (buyer never submitted GitHub username): log warning, skip (do NOT count as retry failure). Buyer chose not to provide username.
     - If transfer status is `invitation_sent` or `completed` (collaborator access was initiated): call `transferOwnership(transactionId)`
     - If retry count > 3: skip, flag for manual admin intervention
  3. Return count of processed transactions
- **Retry count storage:** Uses the existing `retryCount Int @default(0)` field on `RepositoryTransfer` model + `RepositoryTransferRepository.incrementRetryCount()` method (both already exist in the codebase)
- The `RepositoryTransferService` constructor already receives `transactionRepository` — use its existing `releaseEscrow()` method
- **Existing escrow cron:** The existing escrow auto-release mechanism (checks `escrowReleaseDate`) must be modified to call `processAutoTransfers()` instead of directly releasing escrow — otherwise it would bypass the ownership transfer flow. Document this change in implementation.
- If `transferOwnership()` fails after 3 retries AND 14 days have passed since payment, auto-release escrow anyway (seller shouldn't be punished for technical failures)

**Definition of Done:**

- [ ] `transferOwnership(transactionId)` method added
- [ ] Validates payment succeeded, transfer in `completed` OR `invitation_sent` status
- [ ] Validates buyer GitHub username is set (skips if not)
- [ ] Concurrency guard: atomic `escrowStatus` update to `transfer_processing` before GitHub API call
- [ ] Calls `gitHubService.transferOwnership()` with correct params
- [ ] On 202 success: updates transfer status to `transfer_initiated` with `transferInitiatedAt`
- [ ] Escrow release timing: only releases if review period has passed (prevents early escrow release from manual seller transfer)
- [ ] On failure: increments retry count via `incrementRetryCount()`, logs error
- [ ] `processAutoTransfers()` method queries eligible transactions and processes them
- [ ] `processAutoTransfers()` skips `pending` status transactions (buyer never submitted username) without incrementing retry count
- [ ] `processAutoTransfers()` returns `{ processed: number }` count
- [ ] 14-day absolute fallback: releases escrow even if transfer failed
- [ ] Existing escrow auto-release cron modified to call `processAutoTransfers()` instead of direct escrow release
- [ ] 401 (token expired) errors flagged for admin, NOT counted as retry
- [ ] Unit tests cover: success flow, `invitation_sent` status accepted, `pending` status skipped, buyer username missing, GitHub API failure (retryable), 401 (non-retryable), retry count exceeded, 14-day fallback, concurrency guard (second worker skips), early transfer (no escrow release before review period)
- [ ] Type check passes

**Verify:**

- `npx vitest run lib/services/__tests__/RepositoryTransferService.test.ts -q` — all tests pass
- `npm run type-check` — no type errors

### Task 5: API endpoint for ownership transfer (cron trigger + optional early transfer)

**Objective:** Create API endpoints: (a) a cron-callable endpoint that processes auto-transfers for transactions past their review period, and (b) an optional endpoint for seller to trigger early transfer.

**Dependencies:** Task 4

**Files:**

- Create: `app/api/cron/process-transfers/route.ts` — cron endpoint
- Create: `app/api/transactions/[id]/transfer-ownership/route.ts` — manual/early transfer
- Create: `app/api/cron/__tests__/process-transfers.test.ts` — cron endpoint tests
- Create: `app/api/transactions/[id]/transfer-ownership/__tests__/route.test.ts` — manual transfer tests

**Key Decisions / Notes:**

- **Cron endpoint (`/api/cron/process-transfers`):**
  - Secured with a `CRON_SECRET` header (or similar auth mechanism used by Railway cron)
  - Calls `repositoryTransferService.processAutoTransfers()`
  - Returns count of processed transactions
  - Runs every hour (configured in Railway, not in code)
- **Manual transfer endpoint (`/api/transactions/[id]/transfer-ownership`):**
  - POST endpoint, seller-only auth
  - Calls `repositoryTransferService.transferOwnership(transactionId)`
  - **Early transfer (before 7 days):** Initiates ownership transfer BUT does NOT release escrow. Escrow is only released after the 7-day review period passes. This protects the buyer's dispute window.
  - **Post-review transfer (after 7 days):** Initiates ownership transfer AND releases escrow immediately.
  - Also powers the "Transfer Ownership" button in the UI
- Follow existing API patterns from `app/api/transactions/[id]/repository-transfer/route.ts`

**Definition of Done:**

- [ ] Cron endpoint created at `/api/cron/process-transfers`
- [ ] Cron endpoint secured with `CRON_SECRET` header — returns 401 when missing/wrong
- [ ] Cron endpoint returns `{ processed: N }` JSON body on success
- [ ] Manual transfer endpoint created at `/api/transactions/[id]/transfer-ownership`
- [ ] Manual endpoint validates seller identity — returns 403 when caller is not the seller
- [ ] Manual transfer returns `{ success: true, transactionId }` on success or `{ error: string }` on failure
- [ ] Correct HTTP status codes for all error types
- [ ] Unit tests cover: cron auth (missing/wrong header → 401), cron success (returns processed count), manual auth (non-seller → 403), manual success (calls transferOwnership)
- [ ] Type check passes

**Verify:**

- `npx vitest run app/api/cron/__tests__/process-transfers.test.ts -q` — tests pass
- `npm run type-check` — no type errors

### Task 6: Timeline UI + review countdown updates

**Objective:** Update the transaction detail page timeline and cards to reflect the corrected purchase flow: auto-collaborator, 7-day countdown, and auto-transfer after review period.

**Dependencies:** Task 2, Task 4

**Files:**

- Modify: `lib/services/RepositoryTransferService.ts` (timeline stage builders)
- Modify: `components/transactions/TransactionTimeline.tsx`
- Modify: `components/transactions/RepositoryTransferCard.tsx`
- Modify: `components/transactions/ReviewPeriodCard.tsx`
- Modify: `app/transactions/[id]/page.tsx` (if needed)

**Key Decisions / Notes:**

- **Timeline stages (corrected):**
  1. **Offer Accepted** — same as now
  2. **Payment Received** — same, but description mentions "buyer will receive collaborator access"
  3. **Collaborator Access** (renamed from "Repository Transfer") — shows "Awaiting buyer GitHub username" or "Collaborator access granted" (no seller action needed)
  4. **Review Period** — 7-day countdown from payment date. Shows "X days remaining" during review. After expiry: "Review period complete"
  5. **Ownership Transferred / Escrow Released** — combined final stage. Shows "Ownership transferred, funds released" or "Awaiting ownership transfer"
- **Review countdown:** The `ReviewPeriodCard` should show a clear countdown: "You have X days, Y hours left to review the code and raise any disputes."
- **After review period ends:** Show "Review period complete. Ownership transfer in progress..." instead of the countdown
- **Seller view:** Show "Transfer Ownership" button (always visible but labeled appropriately — "Transfer Early" before 7 days, "Transfer Now" after 7 days)
- **Buyer view:** Show countdown during review, then "Ownership transfer in progress" or "Ownership transferred"

**Definition of Done:**

- [ ] Timeline stages reflect corrected flow (auto-collaborator, countdown, auto-transfer)
- [ ] `ReviewPeriodCard` shows 7-day countdown computed from `transaction.createdAt` (payment date) — NOT from collaborator access date
- [ ] Countdown calculation verified by unit test: `reviewPeriodEnd = paymentDate + 7 days`
- [ ] Seller sees "Transfer Ownership" button
- [ ] After review period, countdown changes to "Review complete" message
- [ ] After ownership transfer, final stage shows success
- [ ] Stage descriptions updated in `getTimelineData()` builders
- [ ] Type check passes

**Verify:**

- `npm run type-check` — no type errors
- `npm run build` — build succeeds
- Manual: open transaction detail page and confirm countdown is visible, seller sees Transfer button, buyer sees review messaging

### Task 7: How-it-works page — 5-step corrected flow

**Objective:** Rewrite the buyer steps on the how-it-works page to reflect the corrected 5-step purchase flow.

**Dependencies:** None

**Files:**

- Modify: `app/how-it-works/page.tsx`

**Key Decisions / Notes:**

- Buyer steps change from 4 to 5:
  1. **Browse Projects** — same as now
  2. **Purchase Securely** — "Your payment is held in escrow. You're immediately granted collaborator access to review the code."
  3. **7-Day Review** — "Review the code as a collaborator. Make sure everything matches the description. Raise any concerns within 7 days."
  4. **Ownership Transfer** — "After the review period, full repository ownership is automatically transferred to your GitHub account."
  5. **Funds Released** — "Escrow funds are released to the seller after ownership transfer."
- Seller steps update: "Grant Access" becomes automatic → seller just needs to have the repo set up correctly
- Trust section: "7-Day Escrow Protection" → update to reflect the review + auto-transfer model
- Mention that disputes can only be raised during the 7-day review window

**Definition of Done:**

- [ ] Buyer steps updated to 5-step flow
- [ ] Seller steps updated to reflect automated access grant
- [ ] Trust section updated with review + auto-transfer messaging
- [ ] Page renders without errors
- [ ] Type check passes

**Verify:**

- `npm run type-check` — no type errors
- `npm run build` — build succeeds (SSR page)

### Task 8: Success page + home page marketing updates

**Objective:** Update the checkout success page "What Happens Next?" section and add a purchase flow summary to the home page.

**Dependencies:** None

**Files:**

- Modify: `app/checkout/success/page.tsx` — "What Happens Next?" section
- Modify: `app/page.tsx` — add "How It Works" marketing section

**Key Decisions / Notes:**

- **Success page — "What Happens Next?" steps:**
  1. **Collaborator Access** — "Enter your GitHub username above. You'll be added as a collaborator immediately so you can review the code."
  2. **7-Day Review Period** — "You have 7 days from today to review the codebase. Not satisfied? Raise a dispute within this window."
  3. **Automatic Ownership Transfer** — "After the review period, repository ownership is automatically transferred to your GitHub account."
  4. **Funds Released** — "Escrow funds are released to the seller after ownership transfer completes."
- **Home page — "How It Works" section:**
  - 3 key highlights: "Secure Escrow", "Test Drive the Code" (7-day collaborator access), "Automatic Ownership Transfer"
  - Keep concise — 3 cards or icon+text blocks with "Learn More" link to `/how-it-works`
  - Position after the hero or featured projects section
  - Use existing Shadcn Card components

**Definition of Done:**

- [ ] Success page "What Happens Next?" updated to 4 steps reflecting corrected flow
- [ ] Steps mention: collaborator access (automatic), review period (7 days), auto-transfer, escrow release
- [ ] Home page has "How It Works" section with 3 highlights
- [ ] "Learn More" link to `/how-it-works`
- [ ] Existing GitHub username form on success page untouched
- [ ] Type check passes

**Verify:**

- `npm run type-check` — no type errors
- `npm run build` — build succeeds

## Testing Strategy

- **Unit tests:** GitHubService.transferOwnership(), RepositoryTransferService auto-collaborator flow, RepositoryTransferService.transferOwnership(), RepositoryTransferService.processAutoTransfers(), 14-day fallback logic
- **Integration tests:** Not required for this spec (service tests with mocks cover the business logic)
- **Manual verification:** After implementation, verify: (1) buyer submits GitHub username → immediately added as collaborator, (2) transaction detail shows 7-day countdown, (3) seller sees "Transfer Ownership" button, (4) how-it-works shows 5 steps, (5) success page shows corrected steps, (6) home page shows "How It Works" section

## Risks and Mitigations

| Risk                                                                     | Likelihood | Impact | Mitigation                                                                                                                                                                                                     |
| ------------------------------------------------------------------------ | ---------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Transfer API requires repo admin permission                       | Med        | High   | Validate seller has admin access before calling — check via `GET /repos/{owner}/{repo}` and verify `permissions.admin === true`. If not admin, show clear error.                                               |
| GitHub Transfer API is async (202 = queued, not completed)               | High       | Med    | Treat `transfer_initiated` as the trigger for escrow release. Buyer must accept via GitHub email — this is their responsibility. Document clearly in UI that buyer must accept the GitHub transfer invitation. |
| Buyer never accepts GitHub transfer invitation                           | Med        | Low    | Escrow released at `transfer_initiated`. Buyer's failure to accept is their responsibility — they had 7 days to review and didn't dispute.                                                                     |
| Seller's OAuth token expired/revoked by day 7                            | Med        | High   | Handle 401 separately from 403 — 401 is non-retryable. Flag for admin notification. Seller must reconnect GitHub account. Do NOT count as retry failure.                                                       |
| Auto-transfer fails (GitHub API error, non-401)                          | Med        | Med    | Retry up to 3 times with exponential backoff. After 3 failures, flag for manual admin intervention. At 14 days, auto-release escrow as absolute fallback.                                                      |
| Concurrent cron executions double-process transactions                   | Med        | Med    | Atomic compare-and-swap: set `escrowStatus` to `transfer_processing` (conditional on `held`). Second worker's update fails → skips that transaction.                                                           |
| RepositoryTransfer record missing (seller never called initiateTransfer) | High       | High   | Auto-create RepositoryTransfer record when buyer submits GitHub username (Task 2). This is critical since the seller no longer takes any manual action.                                                        |
| Seller's githubAccessToken is null                                       | Med        | High   | Null check in Task 2's enhanced flow. Return clear error: "Seller GitHub account not connected."                                                                                                               |
| Existing escrow cron bypasses new ownership flow                         | High       | High   | Modify existing `/api/cron/release-escrow` to skip transactions with GitHub repos that haven't completed ownership transfer. Only release directly for non-GitHub transactions.                                |
| Early seller transfer releases escrow before review period               | Med        | Med    | Early transfer initiates ownership but does NOT release escrow until review period passes. Escrow release is time-gated to `escrowReleaseDate`.                                                                |
| Existing transactions have 7-day escrow dates                            | Low        | Low    | Only new transactions get the updated flow. Existing transactions keep their original behavior.                                                                                                                |
| Cron endpoint called by unauthorized parties                             | Low        | High   | Secure with `CRON_SECRET` header. Verify header matches env variable before processing.                                                                                                                        |

## Open Questions

- None — all requirements clarified via user discussion.

### Deferred Ideas

- Email notifications for ownership transfer events (buyer invited, transfer complete)
- Dispute flow with arbitration during the 7-day window
- Automatic removal of seller's collaborator access after ownership transfer
- Dashboard view showing all pending ownership transfers for a seller
- Configurable review period (currently hardcoded to 7 days)
