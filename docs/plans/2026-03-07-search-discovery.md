# Search & Discovery Improvements Implementation Plan

Created: 2026-03-07
Status: VERIFIED
Approved: Yes
Iterations: 0
Worktree: No
Type: Feature

## Summary

**Goal:** Fix broken server-side filters and sort, add bidirectional URL param sync for all filters, restyle the browse page from sidebar layout to a compact horizontal filter bar with badge pills for tech stack.

**Architecture:** The backend (API route + ProjectRepository + ProjectService) already supports all filter parameters server-side. This plan fixes the sort field name mismatch, adds missing `isApproved` filtering, restyles the page from sidebar to horizontal bar layout, and wires all filters to URL query parameters for shareability.

**Tech Stack:** Next.js 15 (client component), Shadcn/ui Select/Slider/Badge, `useSearchParams` + `useRouter`

## Scope

### In Scope
- Fix sort field name mapping (`price` → `priceCents`, `completion` → `completionPercentage`, `views` → `viewCount`)
- Add `isApproved: true` to the repository search WHERE clause
- Restyle filters from sidebar card to horizontal bar above project grid
- Bidirectional URL param sync for ALL filters (category, techStack, minCompletion, maxCompletion, minPrice, maxPrice, sortBy)
- Keep badge pills for tech stack filter (toggleable, filled when selected)
- Active filter badges with dismiss buttons (already exists, keep)
- Mobile-responsive horizontal bar (wraps naturally, no sidebar toggle needed)
- Update tests for new sort field mapping and isApproved filter
- Update E2E test expectations for sort field names

### Out of Scope
- Full-text search improvements (Elasticsearch, trigram indexes)
- Saved searches / search history
- Filter counts (showing "Web App (12)")
- New filter types (e.g., by seller rating, by date range)
- SEO metadata for filtered pages (separate roadmap item)

## Context for Implementer

> Write for an implementer who has never seen the codebase.

- **Patterns to follow:**
  - URL param reading: `app/projects/page.tsx:247-256` uses `useSearchParams()` to init state
  - Filter API call: `app/projects/page.tsx:271-333` builds URLSearchParams and fetches `/api/projects`
  - Repository search: `lib/repositories/ProjectRepository.ts:313-443` builds Prisma WHERE clause
  - Active filter badges: `app/projects/page.tsx:426-457` renders dismissible badges

- **Conventions:**
  - Logging: `console.log('[ComponentName] message', { context })`
  - Path alias: `@/` = project root
  - Sort options: `SORT_OPTIONS` array at top of page component
  - Category list: `CATEGORIES` array at top of page component
  - Tech stack list: `POPULAR_TECH_STACKS` array at top of page component

- **Key files:**
  - `app/projects/page.tsx` — Browse/search page (client component, ~736 lines)
  - `app/api/projects/route.ts` — API route, GET handler parses filter params (lines 186-257)
  - `lib/repositories/ProjectRepository.ts` — `search()` method builds Prisma queries (lines 313-443)
  - `lib/services/ProjectService.ts` — `searchProjects()` delegates to repo (lines 365-372)
  - `lib/repositories/__tests__/ProjectRepository.test.ts` — Search tests (line 182+)
  - `app/api/projects/__tests__/route.test.ts` — API route tests
  - `e2e/project-search.spec.ts` — E2E test for sort (currently `test.skip` at line 251, but needs updating)

- **Gotchas:**
  - **Sort field mismatch (BUG):** The page splits `SORT_OPTIONS` value on hyphen before sending to the API (line 289: `const [sortField, sortOrder] = sortBy.split('-')`). So `'price-asc'` sends `sortBy=price&sortOrder=asc` to the API. But `PaginationOptions.sortBy` expects `priceCents`, `completionPercentage`, `viewCount` (line 115-121 in ProjectRepository). Prisma then tries `orderBy: { price: 'asc' }` which silently fails. **Fix SORT_OPTIONS values only** (e.g., `'priceCents-asc'`) so the split produces valid Prisma field names. No API route changes needed.
  - **Missing isApproved filter (BUG):** `ProjectRepository.search()` does NOT add `isApproved: true` to the WHERE clause. Unapproved (admin-rejected) projects appear in search results. Fix by adding it as a default condition. Note: the seller profile page `/u/[username]` uses direct Prisma with `isApproved: true` (line 121), so it's unaffected. The `sellerId` exemption is safe because the only consumer is the seller dashboard (authenticated view).
  - **URL sync is one-directional:** Page reads `query`, `category`, `sortBy` from URL on init but never writes filter changes back to the URL. Tech stack, completion range, and price range are not read from URL at all. Fix by syncing all filter state to URL params via `router.replace()`.
  - **Slider component:** `@/components/ui/slider` wraps Radix UI Slider and supports both `onValueChange` (fires during drag) and `onValueCommit` (fires on pointer up via `{...props}` passthrough). Use `onValueChange` for visual state updates and `onValueCommit` to trigger API fetch + URL sync, avoiding rapid API calls during slider drag.
  - **Price display:** Page stores price range in dollars, API expects cents. Conversion: `priceRange[0] * 100` (line 285-286).
  - **Suspense boundary:** Page is wrapped in `React.Suspense` because `useSearchParams()` requires it in Next.js 15 (lines 718-736).
  - **Auto-fetch on filter change:** The existing `fetchProjects` is a `useCallback` depending on all filter state. Any filter state change (e.g., `setCategory`) creates a new `fetchProjects` reference, which triggers the `useEffect` at line 338-340. This means filter changes auto-trigger API fetches — no explicit "Apply Filters" button needed. The `handleSearch` function (line 345) only resets page to 1 and is only needed for the search text input button.
  - **Cache invalidation:** The API route uses Redis caching via `getOrSetCache` with a key derived from filters. URL param changes trigger new fetches which produce different cache keys automatically.

- **Domain context:**
  - Projects have status `'draft' | 'active' | 'sold' | 'delisted'`. The search defaults to `active` when no sellerId is provided.
  - `isApproved` is a boolean field — admin can reject projects. Default is `true` for new projects.
  - `completionPercentage` must be 50-95 (business rule for the marketplace).
  - `priceCents` minimum is 10000 ($100) and maximum is 10000000 ($100,000).

## Runtime Environment

- **Start:** `npm run docker:dev` (app on port 3011)
- **Health:** `http://localhost:3011/api/health`

## Progress Tracking

- [x] Task 1: Fix sort field mapping and add isApproved filter
- [x] Task 2: Restyle browse page to horizontal filter bar
- [x] Task 3: Bidirectional URL param sync for all filters
- [x] Task 4: Tests

**Total Tasks:** 4 | **Completed:** 4 | **Remaining:** 0

## Implementation Tasks

### Task 1: Fix Sort Field Mapping and Add isApproved Filter

**Objective:** Fix the broken sort-by-price/completion/views feature by updating sort option values, and add `isApproved: true` to the repository search query to hide admin-rejected projects.

**Dependencies:** None

**Files:**
- Modify: `app/projects/page.tsx` (update `SORT_OPTIONS` values)
- Modify: `lib/repositories/ProjectRepository.ts` (add `isApproved: true` to search WHERE)
- Modify: `lib/repositories/__tests__/ProjectRepository.test.ts` (add isApproved test)

**Key Decisions / Notes:**
- Update `SORT_OPTIONS` values to use DB field names (labels unchanged):
  - `'price-asc'` → `'priceCents-asc'`
  - `'price-desc'` → `'priceCents-desc'`
  - `'completion-desc'` → `'completionPercentage-desc'`
  - `'completion-asc'` → `'completionPercentage-asc'`
  - `'views-desc'` → `'viewCount-desc'`
- In `ProjectRepository.search()`, add `where.isApproved = true` as a default condition (like the existing `where.status = 'active'` default). Only skip it when `sellerId` is provided (sellers should see their own unapproved projects in the dashboard). Verified: the only consumer using `sellerId` is the authenticated seller dashboard, not a public-facing page.
- Labels in `SORT_OPTIONS` remain the same — only the `value` field changes.

**Definition of Done:**
- [ ] `SORT_OPTIONS` values use actual DB field names (`priceCents`, `completionPercentage`, `viewCount`)
- [ ] `ProjectRepository.search()` includes `isApproved: true` in WHERE by default
- [ ] `isApproved` filter is skipped when `sellerId` is provided
- [ ] New test: search defaults to `isApproved: true`
- [ ] New test: `isApproved` not applied when `sellerId` provided
- [ ] All tests pass
- [ ] No diagnostics errors

**Verify:**
```
npx vitest run lib/repositories/__tests__/ProjectRepository.test.ts --reporter=verbose
```

---

### Task 2: Restyle Browse Page to Horizontal Filter Bar

**Objective:** Replace the sidebar filter layout with a compact horizontal filter bar above the project grid. Keep all existing filter controls (category select, tech stack badges, completion slider, price slider) but arrange them in a horizontal row. Remove the "Apply Filters" button (auto-fetch handles it).

**Dependencies:** Task 1

**Files:**
- Modify: `app/projects/page.tsx` (restructure layout from sidebar to horizontal bar)

**Key Decisions / Notes:**
- Remove the `lg:grid-cols-4` grid layout that splits sidebar + results. Replace with a single-column layout: header → search bar → horizontal filter bar → results.
- Horizontal filter bar structure (all in a bordered card):
  - Row 1: Category select + Price range slider (with label) + Completion range slider (with label)
  - Row 2: Tech stack badge pills (wrapping flex)
  - Sort select stays in the results header area (already positioned correctly at line 596-609)
- Remove the "Show/Hide Filters" toggle button — horizontal bar is always visible.
- Remove the "Apply Filters" button — filter changes auto-trigger `fetchProjects()` via the `useCallback` + `useEffect` dependency chain (see Gotchas).
- Remove the sidebar "Featured Projects" info card — informational only, not critical.
- Use `flex flex-wrap gap-4` for responsive wrapping on mobile.
- Keep all existing state variables and `fetchProjects` logic unchanged.
- Keep the active filter badges section (lines 426-457).
- Keep existing loading, error, empty, and pagination states unchanged.
- Use `onValueCommit` on sliders for triggering fetch (fires on pointer up), `onValueChange` for live visual update. This avoids rapid API calls during drag.

**Definition of Done:**
- [ ] Filters display in a horizontal bar above the project grid (not a sidebar)
- [ ] Category, price range, completion range, and tech stack badges all render in the bar
- [ ] Project grid uses full width (no sidebar column taking space)
- [ ] Layout wraps gracefully on mobile (verify at 375px viewport — no horizontal scroll)
- [ ] Sort select remains in the results header
- [ ] No "Apply Filters" or "Show/Hide Filters" buttons
- [ ] No visual regression on project cards or pagination
- [ ] No diagnostics errors

**Verify:**
- Visual verification in browser at `/projects` at both desktop and mobile (375px) viewports

---

### Task 3: Bidirectional URL Param Sync for All Filters

**Objective:** Sync all filter state to URL query parameters so filtered views are shareable and persist across page reloads. Read initial state from URL params. Write state changes back to URL.

**Dependencies:** Task 2

**Files:**
- Modify: `app/projects/page.tsx` (add URL read/write for all filters)

**Key Decisions / Notes:**
- **URL param schema** (keep `sortBy` as param name — don't rename to avoid E2E test breakage):
  - `query` — search text (string)
  - `category` — category value (string, omit if "all")
  - `techStack` — comma-separated tech names (e.g., `React,Node.js`)
  - `minCompletion` / `maxCompletion` — integers (omit if default 50/95)
  - `minPrice` / `maxPrice` — integers in dollars (omit if default 100/100000)
  - `sortBy` — combined sort value (e.g., `priceCents-asc`)
  - `page` — page number (omit if 1)
- **Read from URL on init** (already partially done for query/category/sortBy):
  - Extend to read `techStack` (split by comma), `minCompletion`, `maxCompletion`, `minPrice`, `maxPrice`, `page`
  - Replace `useState` defaults with URL-derived values
- **Write to URL on filter change:**
  - Create a `syncFiltersToUrl()` function that builds URLSearchParams from current state and calls `router.replace('/projects?' + params.toString(), { scroll: false })`
  - Call it in a `useEffect` that depends on all filter state variables
  - Use `router.replace()` (not `push()`) to avoid cluttering browser history with every filter tweak
  - Use `{ scroll: false }` to prevent scroll-to-top on filter change
- **Debounce URL sync:** Use a 300ms debounce on the URL sync effect to avoid excessive URL updates during rapid filter changes (e.g., slider drag that hasn't committed yet). Note: API fetch is already handled by the separate auto-fetch `useEffect`, which fires on state changes from `onValueCommit`.
- **Page reset on filter change:** When any filter other than `page` changes, reset `currentPage` to 1. The URL sync will then omit the `page` param (default).

**Definition of Done:**
- [ ] All filter state reads from URL params on page load
- [ ] All filter changes write back to URL params
- [ ] Copying the URL and opening in a new tab restores the exact filter state
- [ ] Default values are omitted from URL (clean URLs like `/projects` instead of `/projects?category=all&minCompletion=50&...`)
- [ ] Slider changes are debounced for URL sync (no rapid URL updates during drag)
- [ ] Page param persists in URL when paginating
- [ ] No diagnostics errors

**Verify:**
```
# Manually test in browser:
# 1. Set filters → verify URL updates
# 2. Copy URL → open in new tab → verify same filters
# 3. Verify default state produces clean /projects URL
```

---

### Task 4: Tests

**Objective:** Add/update tests for the sort field mapping fix, isApproved filter, URL sync behavior, and update E2E expectations.

**Dependencies:** Tasks 1, 2, 3

**Files:**
- Modify: `lib/repositories/__tests__/ProjectRepository.test.ts` (isApproved tests — if not already added in Task 1)
- Modify: `app/api/projects/__tests__/route.test.ts` (sort field mapping tests)
- Create: `app/projects/__tests__/page.test.tsx` (URL sync tests, filter rendering)
- Modify: `e2e/project-search.spec.ts` (update sort expectation at line 268, un-skip and update applicable tests)

**Key Decisions / Notes:**
- **Repository tests:** Verify in Task 1 — add test that `search()` includes `isApproved: true` by default and that `isApproved` is NOT applied when `sellerId` is provided.
- **API route tests:** Verify sort field values are passed through correctly (e.g., `priceCents`, `viewCount`).
- **Page tests:** Test URL param reading/writing. Mock `useSearchParams` and `useRouter` from `next/navigation`. Verify filter controls render in horizontal layout. Test that active filter badges appear.
- **E2E tests:** Update `e2e/project-search.spec.ts`:
  - Line 268: change `'sortBy=price-asc'` to `'sortBy=priceCents-asc'`
  - Un-skip the sort test (line 251) if the horizontal bar interaction is simpler
  - Evaluate tech stack URL tests (lines 155, 174) — un-skip if applicable after Task 3 wires techStack to URL
- Follow existing test patterns in `app/api/projects/__tests__/route.test.ts` and `components/buyers/__tests__/BuyerOfferCard.test.tsx`.

**Definition of Done:**
- [ ] Repository test: isApproved defaults to true
- [ ] Repository test: isApproved skipped when sellerId provided
- [ ] API route test: sort field names pass through correctly
- [ ] Page test: filters render in horizontal layout
- [ ] Page test: URL params initialize filter state
- [ ] E2E test: sort expectation updated to match new sort field values
- [ ] All new tests pass
- [ ] All existing tests still pass (`npm run test:ci`)
- [ ] No diagnostics errors

**Verify:**
```
npm run test:ci
```

## Testing Strategy

- **Unit tests:** Mock Prisma for repository search tests (isApproved filter), mock services for API route tests (sort mapping), mock `useSearchParams`/`useRouter` for page component tests (URL sync)
- **Manual verification:** Browse to `/projects` in Docker dev environment, apply filters, verify URL updates, copy URL to new tab, verify sort by price/completion/views works
- **E2E:** Update existing Playwright tests for sort field names and URL param format
- **Edge cases:** Empty search, no matching filters, slider at extremes, all tech stacks selected, URL with invalid params

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Slider rapid API calls during drag | Medium | Low | Use `onValueCommit` (fires on pointer up) for API fetch, `onValueChange` for visual updates only |
| Existing tests break from sort field rename | Low | Medium | Update `SORT_OPTIONS` values only — labels stay the same. Run full test suite after change. |
| Price slider UX (dollars vs cents confusion) | Low | Medium | Keep existing dollar display in UI, convert to cents only for API call (already implemented). |
| Horizontal bar too tall on mobile with all filters expanded | Low | Low | Use `flex-wrap` and verify at 375px viewport. Tech stack badges wrap naturally. |
| E2E sort test expectations stale | Medium | Low | Update `e2e/project-search.spec.ts` line 268 in Task 4. Currently `test.skip` so not a CI blocker, but should be fixed. |

## Goal Verification

### Truths
1. Visiting `/projects?category=web_app` shows only web app projects
2. Visiting `/projects?sortBy=priceCents-asc` shows projects sorted by price ascending
3. Selecting tech stack badges and refreshing the page retains the selection
4. Sort by "Most Popular" actually orders by view count (not silently ignored)
5. Admin-rejected projects (`isApproved: false`) do not appear in search results
6. The filter bar renders horizontally above the project grid (no sidebar)

### Artifacts
1. Updated `app/projects/page.tsx` — horizontal layout, URL sync, fixed sort values, onValueCommit for sliders
2. Updated `lib/repositories/ProjectRepository.ts` — isApproved filter
3. Updated test files — sort mapping, isApproved, page URL sync, E2E expectations

### Key Links
1. `SORT_OPTIONS` values → page splits on hyphen → API `sortBy` param → `PaginationOptions.sortBy` → Prisma `orderBy`
2. URL `searchParams` ↔ React state ↔ `fetchProjects()` API call params
3. `ProjectRepository.search()` WHERE clause → `isApproved: true` default
4. Horizontal filter bar → `Select`/`Slider`/`Badge` components → state → URL sync via `router.replace()`
5. Slider `onValueCommit` → triggers state change → auto-fetch via `useCallback`/`useEffect` chain
