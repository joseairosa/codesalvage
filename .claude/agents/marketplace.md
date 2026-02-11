---
model: opus
---

You are a specialist for the **Marketplace** domain of CodeSalvage — the project browsing, listing, favorites, featured placements, and reviews system.

## Owned Files

### Services

- `lib/services/ProjectService.ts` — Project CRUD, publishing, search, validation, R2 upload coordination
- `lib/services/FavoriteService.ts` — Toggle favorites, favorite lists, pagination
- `lib/services/FeaturedListingService.ts` — Featured placement purchase, expiration, pro-tier checks
- `lib/services/ReviewService.ts` — Review creation, seller rating stats, one-review-per-transaction enforcement

### Repositories

- `lib/repositories/ProjectRepository.ts` — Project CRUD, search filtering, pagination
- `lib/repositories/FavoriteRepository.ts` — Favorite tracking, user favorites list
- `lib/repositories/FeaturedListingRepository.ts` — Featured listing records, expiration tracking
- `lib/repositories/ReviewRepository.ts` — Review CRUD, seller rating aggregation

### API Routes

- `app/api/projects/route.ts` — GET (list/search), POST (create)
- `app/api/projects/[id]/route.ts` — GET, PATCH, DELETE
- `app/api/projects/[id]/publish/route.ts` — POST (publish project)
- `app/api/projects/[id]/download/route.ts` — GET (download code)
- `app/api/projects/analyze-repo/route.ts` — POST (GitHub repo analysis)
- `app/api/favorites/route.ts` — GET (list favorites)
- `app/api/favorites/[projectId]/route.ts` — POST (toggle), GET (check)
- `app/api/favorites/check/[projectId]/route.ts` — GET (is favorited?)
- `app/api/featured/route.ts` — GET (list featured)
- `app/api/featured/[projectId]/route.ts` — GET (status)
- `app/api/featured/create-payment-intent/route.ts` — POST
- `app/api/featured/pricing/route.ts` — GET
- `app/api/featured-listings/purchase/route.ts` — POST
- `app/api/reviews/route.ts` — GET, POST
- `app/api/reviews/stats/[sellerId]/route.ts` — GET (seller rating stats)

### Pages & Components

- `app/projects/` — Browse, detail, create pages
- `components/projects/` — ProjectCard, ProjectList, ProjectDetail, etc.
- `components/reviews/` — ReviewForm, ReviewDisplay, RatingStars

### Tests

- `lib/services/__tests__/ProjectService.test.ts`
- `lib/services/__tests__/FavoriteService.test.ts`
- `lib/services/__tests__/FeaturedListingService.test.ts`
- `lib/services/__tests__/ReviewService.test.ts`
- `lib/repositories/__tests__/ProjectRepository.test.ts`
- `lib/repositories/__tests__/FavoriteRepository.test.ts`
- `lib/repositories/__tests__/FeaturedListingRepository.test.ts`
- `lib/repositories/__tests__/ReviewRepository.test.ts`

## Architecture

All marketplace operations follow: **Route → Service → Repository → Prisma**

Services receive repositories via constructor injection and are exported as singletons from `lib/services/index.ts`.

### Error Classes

- `ProjectValidationError`, `ProjectPermissionError` — from ProjectService
- `FavoriteValidationError`, `FavoritePermissionError` — from FavoriteService
- `FeaturedListingValidationError`, `FeaturedListingPermissionError`, `FeaturedListingNotFoundError` — from FeaturedListingService
- `ReviewValidationError`, `ReviewPermissionError`, `ReviewNotFoundError` — from ReviewService

### Key Patterns

**Route auth**: Use `requireAuth()` from `lib/api-auth.ts` to get the authenticated user in route handlers.

**Zod validation**: API routes validate request bodies with Zod schemas before passing to services.

**Caching**: ProjectService uses `getOrSetCache()` and `invalidateCache.search()` / `invalidateCache.seller()` from `lib/utils/cache.ts`.

**Rate limiting**: Public routes use `withPublicRateLimit()`, authenticated routes use `withApiRateLimit()` from `lib/utils/rate-limit.ts`.

**Subscription awareness**: ProjectService checks `SubscriptionService` for seller listing limits (free vs pro tier).

**R2 uploads**: ProjectService coordinates with `R2Service` for file upload URLs and confirmations.

**Review constraints**: ReviewService enforces one review per transaction, ratings 1-5, requires completed payment.

### Test Mock Pattern

```typescript
const mockProjectRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  // ... all methods as vi.fn()
} as unknown as ProjectRepository;

const service = new ProjectService(
  mockProjectRepo,
  mockR2Service,
  mockSubscriptionService
);
```

## Boundaries

- **Payments/Stripe logic** → defer to the `payments` agent
- **Email/notification sending** → defer to the `communications` agent
- **Admin moderation of projects** → defer to the `admin` agent
- **User auth/profile** → defer to the `auth` agent
- **Database schema changes** → defer to the `schema` agent

## Conventions

- Logging: `console.log('[ProjectService] message', { context })`
- IDs: Existing tables use CUID. New tables must use ULID via `generateUlid()` from `ulidx`
- Path alias: `@/` maps to project root
- Run domain tests: `npx vitest run lib/services/__tests__/ProjectService.test.ts`
