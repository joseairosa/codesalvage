# Project: CodeSalvage

**Last Updated:** 2026-02-15

## Overview

Marketplace for incomplete software projects (50-95% complete). Sellers list unfinished side projects; buyers purchase and complete them. Built with Next.js 15 App Router, deployed on Railway.

## Technology Stack

- **Framework:** Next.js 15 (App Router, React Server Components)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS + Shadcn/ui
- **Database:** PostgreSQL 16 + Prisma ORM
- **Cache:** Redis
- **Auth:** Firebase (primary), Auth.js v5 (secondary, being phased out)
- **Payments:** Stripe Connect + Payment Intents
- **Storage:** Cloudflare R2 (AWS S3 SDK)
- **Email:** Postmark
- **AI:** Anthropic Claude API (repo analysis)
- **Testing:** Vitest (unit/integration) + Playwright (E2E)
- **Monitoring:** Honeybadger
- **State:** Zustand + React Query
- **Package Manager:** npm
- **Runtime:** Node.js 20+

## Architecture

### 3-Layer Pattern: Route → Service → Repository

```
app/api/**/route.ts      → HTTP handlers, auth, validation
lib/services/*.ts        → Business logic, orchestration
lib/repositories/*.ts    → Data access, Prisma queries
prisma/schema.prisma     → PostgreSQL models (CUID IDs)
```

**Key Principles:**
- Dependency injection (services receive repos via constructor)
- Single responsibility (each layer has one job)
- Services instantiated as singletons in `lib/services/index.ts`
- Custom error classes per service (ValidationError, PermissionError, NotFoundError)

## Directory Structure

```
app/                     # Next.js App Router
├── api/                 # API routes
│   ├── projects/        # Project CRUD, search
│   ├── transactions/    # Purchase flow, escrow
│   ├── messages/        # Buyer-seller messaging
│   ├── stripe/          # Stripe webhooks
│   └── ...
├── projects/            # Project pages
├── dashboard/           # Buyer dashboard
├── seller/              # Seller dashboard
└── ...
components/              # React components
lib/
├── services/            # Business logic (18 services)
├── repositories/        # Data access (13 repositories)
├── firebase.ts          # Firebase client SDK
├── firebase-admin.ts    # Firebase Admin SDK
└── ...
prisma/
├── schema.prisma        # Database schema (17 models)
└── migrations/          # Migration files
config/
└── env.ts               # Environment validation (Zod)
```

## Development Commands

**Docker (Primary):**
```bash
npm run docker:dev       # Start app:3011, postgres:5444, redis:6390
npm run docker:down      # Stop containers
npm run docker:logs      # Tail logs
```

**Database:**
```bash
npm run db:migrate       # Apply migrations (dev)
npm run db:seed          # Seed database
npm run db:studio        # Prisma Studio GUI
npm run db:generate      # Regenerate Prisma client
```

**Testing:**
```bash
npm run test:ci          # Unit tests (single run)
npm run test:with-db     # Full suite: setup test DB → test → teardown
npm run test:coverage    # Coverage report (70% threshold)
npm run test:e2e         # Playwright E2E
```

**Quality:**
```bash
npm run lint             # ESLint check
npm run lint:fix         # Auto-fix
npm run format           # Prettier format
npm run type-check       # TypeScript strict check
```

**Build:**
```bash
npm run build            # prisma generate && next build
npm run start            # Production server (port 3000)
```

## Key Patterns

### API Routes
```typescript
// app/api/*/route.ts
import { NextResponse } from 'next/server';

// Success
return NextResponse.json(data, { status: 200 });

// Error
return NextResponse.json({ error: 'Message' }, { status: 400 });
```

### Services
```typescript
// lib/services/ExampleService.ts
export class ExampleService {
  constructor(
    private exampleRepo: ExampleRepository,
    private otherService: OtherService
  ) {}

  async doSomething(id: string): Promise<Result> {
    // Validate inputs
    if (!id) throw new ValidationError('ID required');

    // Business logic
    const data = await this.exampleRepo.findById(id);
    if (!data) throw new NotFoundError('Not found');

    return data;
  }
}
```

### Repositories
```typescript
// lib/repositories/ExampleRepository.ts
export class ExampleRepository {
  constructor(private prisma: PrismaClient) {}

  async create(input: CreateInput): Promise<Example> {
    return this.prisma.example.create({ data: input });
  }
}
```

### Testing
```typescript
// Mock repositories with vi.fn()
const mockRepo: ExampleRepository = {
  create: vi.fn(),
  findById: vi.fn(),
} as any;

// Test service logic
describe('ExampleService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should validate input', async () => {
    await expect(service.doSomething('')).rejects.toThrow(ValidationError);
  });
});
```

## Authentication

**Firebase (Primary):**
- Client: `lib/firebase.ts` (browser auth)
- Server: `lib/firebase-admin.ts` (token verification)
- Middleware: `middleware.ts` checks `session` cookie
- Helpers: `requireAuth()` / `requireAdmin()` in `lib/auth-helpers.ts`

**Auth.js (Secondary):**
- GitHub OAuth provider
- Being phased out

## Database

- **Primary Keys:** CUID (`@default(cuid())`)
- **New Tables:** Use ULID via `text("id").primaryKey()` + `generateUlid()` from `ulidx`
- **Dev DB:** localhost:5444
- **Test DB:** localhost:5445 (separate container)
- **Redis Dev:** localhost:6390
- **Redis Test:** localhost:6391

## External Integrations

| Service   | Purpose                     | Config                                       |
| --------- | --------------------------- | -------------------------------------------- |
| Stripe    | Connect + Payments, 7d escrow | `lib/services/StripeService.ts`              |
| Postmark  | Transactional emails        | `lib/services/EmailService.ts`               |
| R2        | File uploads                | `lib/services/R2Service.ts`                  |
| Claude AI | Repo analysis               | `lib/services/RepoAnalysisService.ts`        |
| Firebase  | Auth                        | `lib/firebase.ts`, `lib/firebase-admin.ts`   |
| Honeybadger | Error monitoring          | `next.config.ts`                             |

## Environment Variables

Defined in `config/env.ts` with Zod validation.

**Critical:**
- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `AUTH_SECRET` - NextAuth (min 32 chars)
- `FIREBASE_SERVICE_ACCOUNT_BASE64` - Base64-encoded service account JSON
- `NEXT_PUBLIC_*` - Client-side vars (baked at build time)

## CI/CD

GitHub Actions pipeline:
1. Lint → Type-check → Unit tests → E2E tests → Build
2. All must pass before merge
3. Auto-deploy to Railway on merge to `main`

## Path Aliases

`@/` maps to project root (configured in `tsconfig.json` and `vitest.config.ts`)

## Logging Convention

```typescript
console.log('[ServiceName] descriptive message', { relevantContext });
```
