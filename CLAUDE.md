# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CodeSalvage** is a marketplace for incomplete software projects (50-95% complete). Sellers list unfinished side projects; buyers purchase and complete them. Built with Next.js 15 App Router, deployed on Railway.

## Commands

```bash
# Development (runs inside Docker — never start local dev server)
npm run docker:dev              # Start all containers (app:3011, postgres:5444, redis:6390)
npm run docker:down             # Stop containers
npm run docker:logs             # Tail container logs

# Database
npm run db:migrate              # Apply Prisma migrations (dev)
npm run db:migrate:deploy       # Apply migrations (production)
npm run db:seed                 # Seed database
npm run db:studio               # Open Prisma Studio GUI
npm run db:generate             # Regenerate Prisma client

# Testing
npm run test:ci                 # Unit tests (single run)
npm run test:integration        # Integration tests (requires test DB)
npm run test:with-db            # Full suite: setup test DB → run all → teardown
npm run test:coverage           # Unit tests with coverage report
npm run test:e2e                # Playwright E2E tests
npm run test:e2e:headed         # Playwright with visible browser

# Single test file
npx vitest run lib/services/__tests__/ProjectService.test.ts

# Single test by name
npx vitest run -t "should create project" lib/services/__tests__/ProjectService.test.ts

# Lint & Format
npm run lint                    # ESLint check
npm run lint:fix                # ESLint auto-fix
npm run format                  # Prettier format all files
npm run type-check              # TypeScript strict check

# Build
npm run build                   # prisma generate && next build
```

## Architecture

### Layered Architecture: Route → Service → Repository → Prisma

```
app/api/**/route.ts      → HTTP handlers, auth checks (requireAuth/requireAdmin)
lib/services/*.ts        → Business logic, validation, orchestration (16 services)
lib/repositories/*.ts    → Data access, Prisma queries (11 repositories)
prisma/schema.prisma     → PostgreSQL schema (20+ models, CUID primary keys)
```

Services receive repositories via constructor injection. All services are instantiated as singletons in `lib/services/index.ts` and `lib/repositories/index.ts`.

### Key Services & Their Responsibilities

| Service               | Domain                                              |
| --------------------- | --------------------------------------------------- |
| `ProjectService`      | CRUD, publishing, search, GitHub repo analysis      |
| `TransactionService`  | Purchase flow, 7-day escrow, Stripe Payment Intents |
| `StripeService`       | Connect onboarding, payment processing, webhooks    |
| `MessageService`      | Buyer-seller direct messaging                       |
| `SubscriptionService` | Seller membership tiers via Stripe                  |
| `EmailService`        | Transactional emails via Postmark                   |
| `AdminService`        | User management, content moderation, audit logs     |
| `NotificationService` | In-app notification system                          |
| `R2Service`           | File uploads to Cloudflare R2 (AWS S3 SDK)          |
| `RepoAnalysisService` | GitHub repo analysis via Anthropic Claude API       |

### Authentication

Dual auth system (migration in progress):

- **Auth.js v5** (NextAuth beta) — GitHub OAuth, Prisma session adapter
- **Firebase Client SDK** — Client-side auth state
- Route protection: lightweight `middleware.ts` + full verification via `requireAuth()` / `requireAdmin()` helpers in route handlers

### State Management (Client)

- **Zustand** — Global client state
- **React Query** (`@tanstack/react-query`) — Server state, caching, mutations
- **React Hook Form + Zod** — Form state and validation

### External Integrations

| Integration                    | Config Location                            |
| ------------------------------ | ------------------------------------------ |
| Stripe (Connect + Payments)    | `lib/services/StripeService.ts`            |
| Postmark (Email)               | `lib/services/EmailService.ts`             |
| Cloudflare R2 (Storage)        | `lib/services/R2Service.ts`                |
| Anthropic Claude (AI Analysis) | `lib/services/RepoAnalysisService.ts`      |
| Firebase                       | `lib/firebase.ts`, `lib/firebase-admin.ts` |
| Honeybadger (Monitoring)       | `next.config.ts`                           |

### Environment Variables

All defined in `config/env.ts` with strict validation. Key variables:

- `DATABASE_URL` — PostgreSQL (default: `localhost:5444`)
- `REDIS_URL` — Redis (default: `localhost:6390`)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `AUTH_SECRET` — NextAuth (min 32 chars)
- `FIREBASE_SERVICE_ACCOUNT_BASE64` — Base64-encoded service account JSON
- `NEXT_PUBLIC_*` vars are baked into the client at build time

### Database

- **PostgreSQL 16** via Prisma ORM
- IDs use **CUID** (`@default(cuid())`) — for new tables, use ULID via `text("id").primaryKey()` + `generateUlid()` (from `ulidx`)
- Dev DB: port `5444` | Test DB: port `5445` (separate Docker container)
- Redis dev: port `6390` | Redis test: port `6391`

### CI/CD (GitHub Actions)

PR checks: lint → type-check → unit tests (with coverage) → E2E tests → build. All must pass before merge.

### Test Infrastructure

- **Vitest** for unit + integration tests (jsdom environment)
- **Playwright** for E2E (chromium)
- Coverage threshold: **70%** (lines, functions, branches, statements)
- Test DB: `docker-compose.test.yml` — ephemeral Postgres on port 5445, Redis on port 6391
- Test setup file: `tests/setup.ts`
- Integration tests excluded from default `vitest` runs (require `--config vitest.integration.config.ts`)

### Logging Convention

```typescript
console.log('[ServiceName] descriptive message', { relevantContext });
```

### Path Aliases

`@/` maps to project root (configured in `tsconfig.json` and `vitest.config.ts`).

---

## Efficiency Guidelines

Guidelines for getting maximum throughput from Claude Code sessions on this codebase.

### How to Prompt Effectively

**Feature requests** — state all deliverables upfront so Claude can parallelize:

```
Add a report-abuse button to project cards. Implement the React component,
the POST /api/reports endpoint using AdminService, and unit tests for the
service method — in parallel.
```

**Bug fixes** — use "alongside" to signal parallel fix + regression test:

```
Fix the escrow release cron skipping transactions with null buyerId.
Write a regression test alongside the fix.
```

**Exploration** — prefix read-only tasks with `/fast`:

```
/fast How does the StripeService handle Connect onboarding failures?
```

**Multi-step tasks** — numbered lists with explicit parallelization hints:

```
1. Add a `reportCount` field to the Project model
2. Create a migration (don't run it — ask me)
3. Add repository method + service method + unit tests — parallelize where possible
4. Wire it to GET /api/admin/projects
```

#### Anti-Patterns

| Instead of (sequential)                                                                                   | Do this (goal-oriented)                                                                                 |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| "First read ProjectService" then "now read ProjectRepository" then "now explain how projects are created" | "Explain the project creation flow from API route through service to database"                          |
| "Add the field" then "now add the test" then "now add the API route"                                      | "Add field X with repository method, service method, API route, and tests — in parallel where possible" |
| "What does this function do?" (without context)                                                           | "In `lib/services/TransactionService.ts`, what does `releaseEscrow` do and what are its failure modes?" |
| Running lint, then type-check, then tests separately                                                      | "Run lint, type-check, and unit tests" (Claude batches independent commands)                            |

### Parallel Tool Usage

When working in this codebase, always batch independent operations in a single response:

- **File reads**: Reading `ProjectService.ts`, `ProjectRepository.ts`, and `project/route.ts` to understand a flow — read all three simultaneously, not one-by-one.
- **Searches**: Looking for usage of a repository method — run Grep for the method name and Glob for test files at the same time.
- **Commands**: `npm run lint`, `npm run type-check`, and `npm run test:ci` are independent — run all three in parallel after code changes.
- **Subagents**: When exploring "how does X work" across services + repos + routes, dispatch an Explore agent rather than sequential reads.

### Parallel Agent Dispatch

This project has 8 specialized agents in `.claude/agents/`. Use them to delegate domain-specific work.

**Agent selection guide:**

| Task                                               | Primary Agent    | Also Dispatch            |
| -------------------------------------------------- | ---------------- | ------------------------ |
| Project CRUD, search, favorites, featured, reviews | `marketplace`    |                          |
| Payments, escrow, subscriptions, Stripe            | `payments`       |                          |
| Messages, emails, notifications                    | `communications` |                          |
| Moderation, bans, audit logs, reports              | `admin`          |                          |
| Auth, GitHub OAuth, sessions, user profile         | `auth`           |                          |
| Seller dashboard, analytics, onboarding            | `seller`         |                          |
| Run tests, check coverage, diagnose failures       | `test-runner`    |                          |
| Schema design, migration planning                  | `schema`         | affected domain agent(s) |

**When to dispatch multiple agents in parallel:**

- **Schema changes**: `schema` (design change) + domain agent (implement service/repo/route)
- **Cross-domain features**: e.g., dispute system → `payments` + `admin` + `communications`
- **Post-implementation**: domain agent (code) + `test-runner` (verify)
- **Integration changes**: e.g., swap email provider → `communications` + `test-runner`

**When to use a single agent:**

- Bug fix within one domain
- New API endpoint in an existing domain
- UI component update within a single page section

### Fast Mode

Use `/fast` (same Opus 4.6 model, ~2.5x faster output) for:

- Reading files and answering questions about existing code
- Simple edits: renaming, adding a field, updating imports
- Generating boilerplate: new test file scaffolding, new API route skeleton
- Lookup tasks: "which service handles X?", "where is Y defined?"

Use **normal mode** for:

- Architecture decisions (new service design, schema changes)
- Complex debugging (multi-file investigation, reproduction)
- Large refactors touching 5+ files
- Writing business logic with edge cases

### Session Efficiency

- **Context compaction** handles long sessions automatically — no need to start new sessions for length alone.
- **Front-load exploration**: read all relevant files (service + repo + route + tests) at the start of a task rather than discovering them incrementally.
- **Batch clarifying questions**: ask all unknowns in one AskUserQuestion call rather than asking one at a time.
- **Recall MCP checkpoints**: after completing a feature or significant fix, store the decision and context in Recall so future sessions don't re-investigate.
- **Test DB lifecycle**: if running integration tests multiple times in a session, start the test DB once (`npm run test:db:setup`) and leave it running — only tear down when done.
