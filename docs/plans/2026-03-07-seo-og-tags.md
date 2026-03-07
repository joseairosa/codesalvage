# SEO & Open Graph Tags Implementation Plan

Created: 2026-03-07
Status: VERIFIED
Approved: Yes
Iterations: 0
Worktree: No
Type: Feature

## Summary

**Goal:** Add dynamic SEO metadata and Open Graph tags to all public pages (project detail, browse, seller profiles, homepage, static pages) with auto-generated OG images for project pages showing title, price, completion %, and tech stack.

**Architecture:** Use Next.js `generateMetadata()` in server components/layouts to set per-page `<title>`, `<meta>`, and OG tags. For project detail pages (currently `'use client'`), add a server `layout.tsx` at `app/projects/[id]/` that fetches project data and exports `generateMetadata`. Dynamic OG images use Next.js `ImageResponse` API at `/api/og` to render project card images on-the-fly.

**Tech Stack:** Next.js 15 Metadata API, `next/og` (ImageResponse), Prisma direct queries, Tailwind-style inline CSS in OG image JSX.

## Scope

### In Scope
- Dynamic `generateMetadata` for project detail pages (`/projects/[id]`)
- Static metadata for browse page (`/projects`), how-it-works, pricing
- Homepage metadata: confirmed covered by root layout (`app/layout.tsx:16-56`) — no separate update needed
- Seller profile metadata improvements: add twitter card + canonical URL to `app/u/[username]/page.tsx`
- Dynamic OG image endpoint (`/api/og`) generating project card images
- OG image shows: title, price, completion %, top 3 tech stack badges, CodeSalvage branding
- Twitter card tags (`summary_large_image`)
- Canonical URLs
- JSON-LD structured data for project pages (Product schema)
- Unit tests for metadata generation and OG image endpoint

### Out of Scope
- OG images for seller profiles (already has avatar-based OG — keeping seller avatar as the image)
- OG images for browse page (uses default site image)
- Sitemap.xml generation (separate task)
- robots.txt customization beyond existing
- Search engine submission / Google Search Console setup

## Context for Implementer

> Write for an implementer who has never seen the codebase.

- **Patterns to follow:**
  - Seller profile metadata: `app/u/[username]/page.tsx:63-96` — `generateMetadata` fetches user, returns title/description/openGraph
  - Root layout metadata: `app/layout.tsx:16-56` — static Metadata export with openGraph + twitter + robots
  - How-it-works static metadata: `app/how-it-works/page.tsx` — `export const metadata: Metadata`

- **Conventions:**
  - Path alias: `@/` = project root
  - Prisma direct import: `import { prisma } from '@/lib/prisma'`
  - Price stored as cents (`priceCents`), display as dollars: `(priceCents / 100).toLocaleString()`
  - App URL from env: `import { env } from '@/config/env'` → `env.NEXT_PUBLIC_APP_URL`
  - Default OG image: `/images/opengraph-image.png` (1200x630)

- **Key files:**
  - `app/projects/[id]/page.tsx` — Client component (646 lines), fetches project via API in useEffect. Cannot export generateMetadata.
  - `app/projects/page.tsx` — Client component, browse/search page
  - `app/layout.tsx` — Root layout with default metadata (lines 16-56)
  - `app/u/[username]/page.tsx` — Server component with generateMetadata (lines 63-96), good reference pattern
  - `prisma/schema.prisma` — Project model: title, description, category, priceCents, completionPercentage, techStack[], primaryLanguage, status, isApproved
  - `public/images/opengraph-image.png` — Default OG image (1200x630)
  - `public/images/branding/codesalvage_logo_square.png` — Logo for OG image branding

- **Gotchas:**
  - **Project detail is `'use client'`** — cannot add `generateMetadata` to `page.tsx`. Solution: add `app/projects/[id]/layout.tsx` (server component) with `generateMetadata`. Layout fetches project from DB directly via Prisma, page.tsx stays unchanged.
  - **Layout metadata vs page metadata** — Next.js merges metadata from layouts and pages. Since `page.tsx` has no metadata export (it's a client component), the layout's metadata wins completely.
  - **Draft/sold/unapproved projects** — `generateMetadata` should still return metadata for these (the page handles access control), but should add `robots: { index: false }` for non-active projects to prevent indexing.
  - **OG image caching** — The `/api/og` endpoint should set `Cache-Control` headers. Next.js `ImageResponse` returns PNG by default at 1200x630.
  - **Font in OG images** — `ImageResponse` requires fonts as TTF binary data passed to the `fonts` option. The Inter font loaded via `next/font/google` in `app/layout.tsx` is NOT automatically available inside ImageResponse. For simplicity, use system sans-serif and accept the visual trade-off, or copy a TTF file to `public/fonts/` and load it via `fs.readFileSync(path.join(process.cwd(), 'public/fonts/Inter-Regular.ttf'))`.
  - **Browse page is also `'use client'`** — `app/projects/page.tsx` is a client component, so it cannot export metadata. Same workaround as project detail: use `app/projects/layout.tsx` (server component) for browse page metadata.

- **Domain context:**
  - Projects have status: `draft | active | sold | delisted`. Only `active` should be indexed.
  - `isApproved` boolean — unapproved projects should not be indexed.
  - `completionPercentage` is 50-95 (marketplace rule).
  - `priceCents` minimum is 10000 ($100).
  - `category` values: `web_app`, `mobile`, `backend`, `tool`, `dashboard`, etc.

## Runtime Environment

- **Start:** `npm run docker:dev` (app on port 3011)
- **Health:** `http://localhost:3011/api/ping`

## Progress Tracking

- [x] Task 1: Project detail page metadata (layout.tsx + generateMetadata)
- [x] Task 2: Dynamic OG image endpoint
- [x] Task 3: Browse page, static pages, seller profile, and JSON-LD metadata
- [x] Task 4: Tests

**Total Tasks:** 4 | **Completed:** 4 | **Remaining:** 0

## Implementation Tasks

### Task 1: Project Detail Page Metadata

**Objective:** Add `generateMetadata` to project detail pages via a server layout component that fetches project data from Prisma and returns dynamic title, description, OG tags, and canonical URL.

**Dependencies:** None

**Files:**
- Create: `app/projects/[id]/layout.tsx`
- Test: `app/projects/[id]/__tests__/layout.test.tsx`

**Key Decisions / Notes:**
- Follow the pattern from `app/u/[username]/page.tsx:63-96`
- Fetch project with Prisma directly (not via API): `prisma.project.findUnique({ where: { id }, select: { title, description, category, priceCents, completionPercentage, techStack, status, isApproved, seller: { select: { username } } } })`
- Return `robots: { index: false }` for non-active or unapproved projects
- OG image URL: `${env.NEXT_PUBLIC_APP_URL}/api/og?id=${project.id}` (Task 2 endpoint)
- Canonical URL: `${env.NEXT_PUBLIC_APP_URL}/projects/${id}`
- Title format: `${project.title} — CodeSalvage`
- Description: truncate project.description to 160 chars
- Include `twitter.card: 'summary_large_image'`
- Layout renders `{children}` only — no visual wrapper

**Definition of Done:**
- [ ] `app/projects/[id]/layout.tsx` exports `generateMetadata` that fetches project data
- [ ] Title, description, OG title/description/image/url, twitter card, canonical URL all set
- [ ] Non-active/unapproved projects get `robots: { index: false }`
- [ ] Missing projects return a fallback title ("Project Not Found")
- [ ] All tests pass
- [ ] No diagnostics errors

**Verify:**
```
npx vitest run app/projects/[id]/__tests__/layout.test.tsx --reporter=verbose
```

---

### Task 2: Dynamic OG Image Endpoint

**Objective:** Create an API route that generates dynamic Open Graph images for project pages, showing title, price, completion percentage, and tech stack badges with CodeSalvage branding.

**Dependencies:** None (can be built in parallel with Task 1)

**Files:**
- Create: `app/api/og/route.tsx`
- Test: `app/api/og/__tests__/route.test.ts`

**Key Decisions / Notes:**
- Use `next/og` `ImageResponse` API (built into Next.js 15)
- Route: `GET /api/og?id=<projectId>`
- Image size: 1200x630 (standard OG)
- Layout: CodeSalvage logo top-left, project title (large), price badge, completion bar, up to 3 tech stack pills, gradient background
- Fetch project from Prisma: `prisma.project.findUnique({ where: { id }, select: { title, priceCents, completionPercentage, techStack, category } })`
- Return 404 with a default fallback image if project not found
- Set `Cache-Control: public, max-age=86400, s-maxage=86400` (24h cache)
- Use inline CSS (ImageResponse uses Satori which supports a subset of CSS via style objects)
- Validate `id` query parameter: if missing or length > 50, return fallback image immediately without querying DB
- Load logo using `fs.readFileSync` from `public/images/branding/` (Node runtime) — do NOT use `fetch` with localhost URL as it may not resolve inside containers. Alternatively, use text branding ("CodeSalvage") as fallback if logo loading fails.
- No rate limiting needed (static-ish content, cached)

**Definition of Done:**
- [ ] `GET /api/og?id=<projectId>` returns a PNG image
- [ ] Image shows project title, formatted price, completion %, top 3 tech stack badges
- [ ] Image has CodeSalvage branding (logo or text)
- [ ] Missing project ID or invalid ID (length > 50) returns fallback image without DB query
- [ ] Response includes cache headers
- [ ] Image dimensions are 1200x630 (verified via test or curl)
- [ ] All tests pass
- [ ] No diagnostics errors

**Verify:**
```
npx vitest run app/api/og/__tests__/route.test.ts --reporter=verbose
curl -I http://localhost:3011/api/og?id=test-id
```

---

### Task 3: Browse Page, Static Pages, Seller Profile, and JSON-LD Metadata

**Objective:** Add metadata to the browse page, how-it-works page, and pricing page. Add JSON-LD structured data (Product schema) to the project detail layout. Complete seller profile metadata with twitter card and canonical URL. Confirm homepage metadata is sufficient via root layout.

**Dependencies:** Task 1

**Files:**
- Create: `app/projects/layout.tsx` (browse page metadata — wraps both `/projects` and `/projects/[id]`)
- Modify: `app/projects/[id]/layout.tsx` (add JSON-LD script tag)
- Modify: `app/how-it-works/page.tsx` (add/update metadata export if missing OG tags)
- Modify: `app/pricing/page.tsx` (add/update metadata export if missing OG tags)
- Modify: `app/u/[username]/page.tsx` (add twitter card + canonical URL to existing generateMetadata)

**Key Decisions / Notes:**
- **Browse page:** `app/projects/page.tsx` is a client component (`'use client'`), so it cannot export metadata. The `app/projects/layout.tsx` server component is the required workaround — same pattern as the project detail layout.
- Browse page metadata is static: title "Browse Projects — CodeSalvage", description about marketplace
- `app/projects/layout.tsx` sets metadata for the browse page; nested `app/projects/[id]/layout.tsx` overrides for detail pages (Next.js metadata merging)
- JSON-LD for project detail: use `Product` schema with `name`, `description`, `offers.price`, `offers.priceCurrency: "USD"`, `offers.availability` mapped as: active → `https://schema.org/InStock`, sold → `https://schema.org/SoldOut`, draft/delisted/unapproved → `https://schema.org/Discontinued`
- Render JSON-LD as `<script type="application/ld+json">` inside the layout
- Static pages (how-it-works, pricing) just need OG tags added to their existing metadata exports
- **Seller profile:** Add `twitter: { card: 'summary', images: [user.avatarUrl] }` and `alternates: { canonical: '${env.NEXT_PUBLIC_APP_URL}/u/${username}' }` to existing `generateMetadata` in `app/u/[username]/page.tsx` (~5 lines)
- **Homepage:** Root layout metadata (`app/layout.tsx:16-56`) already covers the homepage with title, description, OG image, twitter card, and robots. No separate update needed — confirmed sufficient.

**Definition of Done:**
- [ ] `/projects` has title "Browse Projects — CodeSalvage" with OG tags
- [ ] `/projects/[id]` has JSON-LD Product schema in page source
- [ ] How-it-works page has complete OG tags (title, description, image, type)
- [ ] Pricing page has complete OG tags
- [ ] Seller profile page (`/u/[username]`) has twitter card tags and canonical URL
- [ ] Homepage (`/`) metadata confirmed sufficient via root layout (no separate update needed)
- [ ] All tests pass
- [ ] No diagnostics errors

**Verify:**
```
npm run test:ci
curl -s http://localhost:3011/projects | grep -o '<title>.*</title>'
```

---

### Task 4: Tests

**Objective:** Add unit tests for metadata generation, OG image endpoint, and JSON-LD output.

**Dependencies:** Tasks 1, 2, 3

**Files:**
- Create: `app/projects/[id]/__tests__/layout.test.tsx` (if not created in Task 1)
- Create: `app/api/og/__tests__/route.test.ts` (if not created in Task 2)
- Modify: existing test files as needed

**Key Decisions / Notes:**
- Mock Prisma for metadata tests (same pattern as `app/u/[username]/__tests__/page.test.tsx`)
- Test generateMetadata returns correct title/description/OG for a valid project
- Test generateMetadata returns fallback for missing project
- Test generateMetadata returns `robots: { index: false }` for sold/draft/unapproved projects
- Test OG image endpoint returns image content-type
- Test OG image endpoint returns 404 for invalid ID
- Test JSON-LD contains correct Product schema fields

**Definition of Done:**
- [ ] Metadata tests: valid project, missing project, non-indexable project
- [ ] OG image tests: valid response, missing project fallback, cache headers
- [ ] JSON-LD test: correct schema shape
- [ ] All tests pass (`npm run test:ci`)
- [ ] No diagnostics errors

**Verify:**
```
npm run test:ci
```

## Testing Strategy

- **Unit tests:** Mock Prisma for generateMetadata and OG endpoint, verify returned metadata shape and content
- **Manual verification:** Open project detail page, view page source for meta tags, share URL on Twitter/Slack preview tools
- **E2E:** Not needed — metadata is server-rendered and verifiable via curl/view-source

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Layout.tsx metadata fetch duplicates page.tsx data fetch | Medium | Low | The layout's Prisma query is independent of the page's client-side API fetch — there is no request deduplication between them. The overhead is acceptable because: (1) layout's select is narrow (7 fields), (2) query is fast (indexed by ID), (3) metadata generation is server-side and does not block client rendering. |
| OG image generation slow in production | Low | Medium | Set 24h cache headers. ImageResponse is lightweight (no headless browser). |
| Project description too long for OG | Medium | Low | Truncate to 160 chars in generateMetadata. |
| `app/projects/layout.tsx` interferes with nested `[id]/layout.tsx` | Low | Medium | Next.js merges metadata — nested layout overrides parent. Test that `/projects` gets browse metadata and `/projects/[id]` gets project metadata. |

## Goal Verification

### Truths
1. Sharing a project URL on Twitter/Slack shows a rich preview with title, price, and project card image
2. `view-source` on `/projects/abc123` shows `<meta property="og:title">` with the project name
3. `view-source` on `/projects/abc123` shows `<script type="application/ld+json">` with Product schema
4. Sold/draft/unapproved project pages have `<meta name="robots" content="noindex">`
5. `/api/og?id=<validId>` returns a PNG image with correct dimensions
6. Browse page (`/projects`) has its own distinct title and OG tags

### Artifacts
1. `app/projects/[id]/layout.tsx` — server layout with generateMetadata for project detail
2. `app/api/og/route.tsx` — dynamic OG image generation endpoint
3. `app/projects/layout.tsx` — browse page metadata
4. Updated static page metadata (how-it-works, pricing)

### Key Links
1. `generateMetadata` in layout → Prisma project fetch → OG tags in HTML head
2. OG image URL in metadata → `/api/og?id=X` → ImageResponse with project data
3. JSON-LD script in layout → Product schema with price/availability from project data
4. `robots.index` in metadata → project status/isApproved check → noindex for non-active
