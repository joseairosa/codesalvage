# Seller Analytics Implementation Plan

Created: 2026-03-08
Status: VERIFIED
Approved: Yes
Iterations: 0
Worktree: No
Type: Feature

## Summary

Fix broken view tracking caused by Redis cache wrapping, and add per-listing conversion rate to the seller projects table.

**Decisions made:**

- View tracking: Track before cache (unconditional, fire-and-forget)
- Analytics location: Keep on existing `/seller/dashboard` — no new route needed

## Background

The analytics infrastructure is fully built (`AnalyticsRepository`, `AnalyticsService`, `AnalyticsDashboard` component, `/api/analytics/overview`). Two gaps remain:

1. **View tracking is silently broken**: `GET /api/projects/[id]` wraps `getProject({ incrementView: true })` inside `getOrSetCache`. The generator only runs on cache misses (every 5 min TTL), so ~95% of views go uncounted.

2. **Seller projects table is missing conversion rate**: The `/seller/projects` page shows `viewCount` and `favoriteCount` but no conversion rate column. The data is computable client-side from existing fields.

## Tasks

### Task 1: Add `ProjectService.trackView()` and decouple from cache

- [x] Add `trackView(projectId: string): Promise<void>` to `ProjectService`
  - Lightweight `findById` to check if project exists and is `active`
  - If active: fire-and-forget `projectRepository.incrementViewCount` + `analyticsRepository.logViewEvent`
- [x] Update `GET /api/projects/[id]` to call `projectService.trackView(id)` fire-and-forget **before** `getOrSetCache`
- [x] Change `getOrSetCache` lambda to use `{ incrementView: false }` (prevents double-counting on cache miss)

### Task 2: Add conversion rate column to seller projects table

- [x] Add `conversionRate` helper + `formatConversionRate` to `app/seller/projects/page.tsx`
- [x] Compute client-side: `status === 'sold' && viewCount > 0 ? 1 / viewCount : 0`
- [x] Add "Conv. Rate" column header to the table
- [x] Render as percentage (e.g. `0.41%`) with `—` for zero/unsold listings

### Task 3: Tests for `trackView`

- [x] Unit test: `trackView` on non-existent project → no tracking calls
- [x] Unit test: `trackView` on draft project → no tracking calls
- [x] Unit test: `trackView` on active project → `incrementViewCount` + `logViewEvent` called

---

Done: 3 | Left: 0
