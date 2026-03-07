# Public Seller Profiles Implementation Plan

Created: 2026-03-07
Status: VERIFIED
Approved: Yes
Iterations: 1
Worktree: No
Type: Feature

## Summary

**Goal:** Build a public seller profile page at `/u/[username]` showing seller bio, avatar, listed + sold projects, aggregate star rating with individual reviews, and member since date. Public (no auth). Link seller names throughout the app to this profile.

**Architecture:** Next.js Server Component page with direct Prisma data fetching. Reuses existing `ProjectCard`, `ReviewRepository`, and `UserRepository`. No new API endpoint needed for the page — data is fetched server-side for optimal SEO. One new API endpoint for paginated reviews (client-side pagination).

**Tech Stack:** Next.js 15 App Router (RSC), Prisma, Tailwind + Shadcn/ui

## Scope

### In Scope

- `/u/[username]` page with profile header, projects grid, reviews section
- `generateMetadata()` for SEO (title, description, OG tags)
- Aggregate rating display (stars + count) in profile header
- Paginated reviews list with buyer name, star rating, comment, project name
- Projects grid showing active + sold projects (reusing `ProjectCard`)
- Seller name → profile link in `ProjectCard` and `BuyerOfferCard`
- 404 handling for non-existent, non-seller, or banned usernames
- Lowercase URL canonicalization (redirect mixed-case → lowercase)
- Unit tests for data-fetching logic

### Out of Scope

- Avatar upload (separate roadmap item #5)
- Seller analytics (separate roadmap item #4)
- Follow/subscribe to seller
- Seller profile editing beyond existing `/settings` page

## Context for Implementer

> Write for an implementer who has never seen the codebase.

- **Patterns to follow:**
  - Server component page: use the `app/dashboard/page.tsx` pattern (server component + direct Prisma)
  - Avatar + fallback: `components/projects/ProjectCard.tsx:243-252` uses `Avatar`/`AvatarImage`/`AvatarFallback` from Shadcn
  - ProBadge for verified sellers: `components/seller/ProBadge.tsx`
  - Rate limiting on public API routes: `app/api/reviews/stats/[sellerId]/route.ts` uses `withPublicRateLimit`

- **Conventions:**
  - Logging: `console.log('[ComponentName] message', { context })`
  - Path alias: `@/` = project root
  - IDs: existing tables use CUID, no new tables needed here
  - Project statuses: `'draft' | 'active' | 'sold' | 'delisted'` — show only `active` and `sold`

- **Key files:**
  - `lib/repositories/UserRepository.ts` — `findByUsername(username)` lowercases input internally (line 220)
  - `lib/repositories/ReviewRepository.ts` — `getSellerReviews(sellerId, options)` (paginated), `getSellerRatingStats(sellerId)` (aggregate)
  - `lib/repositories/ProjectRepository.ts` — `findBySellerId(sellerId)` returns all projects but does NOT include seller relation
  - `components/projects/ProjectCard.tsx` — `ProjectCard` + `ProjectCardData` interface (lines 44-72)
  - `components/buyers/BuyerOfferCard.tsx` — seller display in offer cards (lines 135-148)

- **Gotchas:**
  - **ProjectCard link nesting:** `ProjectCard` is wrapped in a `<Link href={/projects/${id}}>`. The seller name link must use `onClick={e => e.stopPropagation()}` to prevent the parent link from firing.
  - **findBySellerId does NOT include seller relation.** Use raw Prisma instead:
    ```typescript
    prisma.project.findMany({
      where: { sellerId: user.id, status: { in: ['active', 'sold'] }, isApproved: true },
      include: { seller: { include: { subscription: true } } },
      orderBy: { createdAt: 'desc' },
    });
    ```
  - **ProjectCardData.seller.subscription expects a `benefits` sub-object** that the raw Prisma `Subscription` model does NOT have. The `benefits` object is computed at runtime. Compute it inline from the raw subscription: if `plan === "pro" && status === "active"`, return pro benefits object `{ verificationBadge: true, unlimitedProjects: true, advancedAnalytics: true, featuredListingDiscount: true }`; otherwise return free benefits (all false). See `SubscriptionService` for the canonical mapping.
  - **Banned sellers:** Check `isBanned` — return 404 for banned users.
  - **isApproved filter:** Add `isApproved: true` to project queries to exclude admin-rejected projects.
  - **Anonymous reviews:** Reviews with `isAnonymous: true` must show "Anonymous Buyer" instead of buyer name/avatar.
  - **Username case:** `findByUsername()` lowercases internally. Normalize `params.username` to lowercase; if the original differs, redirect to the lowercase canonical URL.

- **Domain context:**
  - Sellers are users with `isSeller: true`. A user could be both buyer and seller.
  - Verified sellers (`isVerifiedSeller: true`) have completed Stripe onboarding.
  - `SellerAnalytics` model tracks `averageRating`, `totalReviews` — but `ReviewRepository.getSellerRatingStats()` computes fresh.

## Runtime Environment

- **Start:** `npm run docker:dev` (app on port 3011)
- **Health:** `http://localhost:3011/api/health`

## Progress Tracking

- [x] Task 1: Profile page with data fetching and SEO
- [x] Task 2: Reviews section with pagination
- [x] Task 3: Link seller names to profiles
- [x] Task 4: Tests

**Total Tasks:** 4 | **Completed:** 4 | **Remaining:** 0

## Implementation Tasks

### Task 1: Profile Page with Data Fetching and SEO

**Objective:** Create the `/u/[username]` server component page showing profile header (avatar, name, bio, member since, rating summary) and projects grid. Includes `generateMetadata()` for SEO.

**Dependencies:** None

**Files:**

- Create: `app/u/[username]/page.tsx`

**Key Decisions / Notes:**

- Server Component — fetch directly from Prisma (no API call)
- Normalize `params.username` to lowercase. If original !== lowercase, use `redirect()` from `next/navigation` to `/u/${lowercase}` for canonical URLs.
- Query user: `prisma.user.findUnique({ where: { username: normalized } })`. Return `notFound()` if user is null, `isSeller === false`, or `isBanned === true`.
- Query projects with seller relation + subscription for `ProjectCardData` compatibility:
  ```typescript
  prisma.project.findMany({
    where: { sellerId: user.id, status: { in: ['active', 'sold'] }, isApproved: true },
    include: { seller: { include: { subscription: true } } },
    orderBy: { createdAt: 'desc' },
  });
  ```
- Compute `benefits` from raw subscription for `ProjectCardData.seller.subscription` (see Gotchas).
- Query rating stats: instantiate `ReviewRepository` and call `getSellerRatingStats(user.id)`.
- Layout: profile header (large avatar, fullName, @username, bio, member since, star rating + count) + projects grid using `ProjectCard`.
- Show "Sold" badge overlay on sold projects in the grid.
- Empty states: "No projects listed yet" if no active/sold projects.
- `generateMetadata()` returns: `{ title: "username — CodeSalvage", description: bio || "Seller on CodeSalvage", openGraph: { title, description, type: "profile", images: [avatarUrl] } }`. If no avatarUrl, omit `images`.

**Definition of Done:**

- [ ] `/u/validusername` renders profile with header, projects grid, and star rating
- [ ] `/u/nonexistent` returns 404
- [ ] `/u/buyeronly` (isSeller: false) returns 404
- [ ] `/u/banneduser` (isBanned: true) returns 404
- [ ] `/u/MixedCase` redirects to `/u/mixedcase`
- [ ] `generateMetadata()` returns title, description, and `og:title`/`og:description`/`og:type` tags
- [ ] Projects grid shows only active + sold + approved projects
- [ ] ProBadge renders correctly for pro sellers
- [ ] No diagnostics errors

**Verify:**

```
curl -sI http://localhost:3011/u/TestUser | grep -i location
curl -s http://localhost:3011/u/testuser | grep -o 'og:[a-z]*'
```

---

### Task 2: Reviews Section with Client-Side Pagination

**Objective:** Add a reviews section below the projects grid showing aggregate rating breakdown and paginated individual reviews.

**Dependencies:** Task 1

**Files:**

- Create: `components/profile/SellerReviewsSection.tsx` (client component for pagination)
- Create: `components/profile/RatingBreakdown.tsx` (server-renderable rating bars)
- Create: `app/api/u/[username]/reviews/route.ts` (public, rate-limited)
- Modify: `app/u/[username]/page.tsx` (add reviews section, pass initial data + stats)

**Key Decisions / Notes:**

- Aggregate rating (stars, count, breakdown bars by rating) rendered server-side in page.tsx using data from `getSellerRatingStats()`.
- `RatingBreakdown` component: horizontal bar chart showing 5★ through 1★ distribution with counts and percentage widths.
- Individual reviews list uses a client component (`SellerReviewsSection`) for pagination.
- **Reviews API endpoint (`GET /api/u/[username]/reviews?page=1&limit=10`):**
  1. Look up user by username via `userRepository.findByUsername(username)`
  2. If null or `isSeller: false` or `isBanned: true`, return 404
  3. Call `reviewRepo.getSellerReviews(user.id, { page, limit })`
  4. Apply `withPublicRateLimit`
- Each review card shows: buyer avatar + name (or "Anonymous Buyer" if `isAnonymous`), star rating, comment text, project name (from `transaction.project.title`), relative date.
- Pass initial first page of reviews from server to avoid a loading flash.

**Definition of Done:**

- [ ] Rating breakdown displays 5★–1★ bars with counts
- [ ] Reviews list shows buyer info, rating, comment, project name, date
- [ ] Anonymous reviews show "Anonymous Buyer" with generic avatar
- [ ] Pagination works (Next/Previous buttons, page indicator)
- [ ] Empty state shows "No reviews yet" with appropriate illustration
- [ ] `GET /api/u/[username]/reviews` returns paginated reviews with correct shape
- [ ] `GET /api/u/nonexistent/reviews` returns 404
- [ ] No diagnostics errors

**Verify:**

```
curl -s 'http://localhost:3011/api/u/testuser/reviews?page=1&limit=5' | jq .
```

---

### Task 3: Link Seller Names to Profile Pages

**Objective:** Make seller names throughout the app clickable links to `/u/[username]`.

**Dependencies:** Task 1

**Files:**

- Modify: `components/projects/ProjectCard.tsx` (seller name section, lines ~254-265)
- Modify: `components/buyers/BuyerOfferCard.tsx` (seller name display, lines ~145-148)

**Key Decisions / Notes:**

- In `ProjectCard.tsx`: The entire card is wrapped in `<Link href={/projects/${id}}>`. The seller fullName (line 256) and @username (line 264) need to link to `/u/${seller.username}`. Use `<Link href={/u/${seller.username}} onClick={e => e.stopPropagation()} className="hover:underline">` to prevent the parent card link from firing.
- In `BuyerOfferCard.tsx`: The seller name at line 146 is inside a `<span>`. Replace with `<Link href={/u/${offer.seller.username}} className="hover:underline">`. Check if it's inside an outer `<Link>` — it's not (the card is a `<Card>`, not a link), so a simple `<Link>` works.
- Keep avatar non-clickable.
- Link styling: `hover:underline` to keep it subtle.

**Definition of Done:**

- [ ] Clicking seller name on ProjectCard navigates to `/u/[username]` (does NOT open project detail)
- [ ] Clicking seller name on BuyerOfferCard navigates to `/u/[username]`
- [ ] Links have hover:underline styling
- [ ] No visual regression on card layout
- [ ] No diagnostics errors

**Verify:**

- Visual verification in browser — click seller name on a project card, confirm navigation to profile page

---

### Task 4: Unit Tests

**Objective:** Add tests for the reviews API endpoint, the reviews section component, and verify existing tests still pass.

**Dependencies:** Tasks 1, 2, 3

**Files:**

- Create: `app/api/u/[username]/reviews/__tests__/route.test.ts`
- Create: `components/profile/__tests__/SellerReviewsSection.test.tsx`
- Create: `components/profile/__tests__/RatingBreakdown.test.tsx`

**Key Decisions / Notes:**

- Mock Prisma and repositories for API route tests
- Test reviews API: returns paginated reviews for valid seller, 404 for non-existent user, 404 for non-seller, 404 for banned user, respects anonymous flag in response
- Test SellerReviewsSection: renders reviews list, handles empty state, pagination controls visible when >1 page
- Test RatingBreakdown: renders 5 bars, shows correct counts, handles zero-reviews state
- Follow existing test patterns in `app/api/` and `components/` test directories

**Definition of Done:**

- [ ] All new tests pass
- [ ] Tests cover: valid reviews response, 404 cases (nonexistent, non-seller, banned), anonymous reviews, pagination, empty states, rating breakdown rendering
- [ ] All existing tests still pass (`npm run test:ci`)
- [ ] No diagnostics errors

**Verify:**

```
npm run test:ci
```

## Testing Strategy

- **Unit tests:** Mock Prisma client, test API responses, component rendering states
- **Manual verification:** Browse to `/u/[username]` in Docker dev environment, verify layout, click seller names on project cards, test mixed-case URL redirect
- **Edge cases:** non-existent user, non-seller user, banned user, seller with no projects, seller with no reviews, anonymous reviews, mixed-case URLs

## Risks and Mitigations

| Risk                                                                | Likelihood | Impact | Mitigation                                                                                     |
| ------------------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------- |
| `stopPropagation` on seller link breaks card click on some browsers | Low        | Medium | Test in Chrome + Firefox; fallback to `<a>` with manual navigation if needed                   |
| Performance with many projects per seller                           | Low        | Medium | Server-side rendering; projects query uses Prisma `take` limit if needed in future             |
| Username route conflicts with other routes                          | Low        | High   | `/u/` prefix avoids all conflicts — no other routes start with `/u/`                           |
| ProBadge breaks due to missing computed benefits                    | Medium     | Medium | Compute benefits inline from raw subscription data; add explicit test for pro seller rendering |

## Goal Verification

### Truths

1. Visiting `/u/[valid-seller-username]` displays a profile page with bio, avatar, member since, and star rating
2. The profile page shows the seller's active and sold (approved) projects in a grid
3. The profile page shows a paginated list of buyer reviews with ratings and comments
4. Anonymous reviews display "Anonymous Buyer" instead of the reviewer's name
5. Clicking a seller name on a project card navigates to `/u/[username]` instead of the project detail
6. Non-existent, non-seller, or banned usernames return a 404 page
7. The page has proper SEO metadata: `<title>`, `<meta name="description">`, `og:title`, `og:description`, `og:type="profile"`
8. Mixed-case URLs redirect to lowercase canonical URL

### Artifacts

1. `app/u/[username]/page.tsx` — profile page with `generateMetadata()`
2. `components/profile/SellerReviewsSection.tsx` — client-side paginated reviews
3. `components/profile/RatingBreakdown.tsx` — star rating distribution bars
4. `app/api/u/[username]/reviews/route.ts` — paginated reviews endpoint
5. Updated `ProjectCard.tsx` and `BuyerOfferCard.tsx` with seller profile links

### Key Links

1. `UserRepository.findByUsername()` → page data fetch → profile header
2. Raw Prisma query (with seller+subscription include) → computed benefits → `ProjectCard` grid
3. `ReviewRepository.getSellerRatingStats()` → `RatingBreakdown` component
4. `ReviewRepository.getSellerReviews()` → reviews API → `SellerReviewsSection` pagination
5. `ProjectCard` seller name → `<Link href="/u/[username]" onClick={stopPropagation}>` with hover:underline
