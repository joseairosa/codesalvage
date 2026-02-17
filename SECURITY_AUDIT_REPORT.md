# Security Audit Report — CodeSalvage

**Date:** 2026-02-17
**Scan Type:** Quick Scan (10 categories)
**Categories:** SQL Injection, XSS, Hardcoded Secrets, Authentication, SSRF, Stripe, AI API, Email, Database, Redis/Cache

---

## Summary

- **Overall Risk:** Medium
- **Findings:** 0 Critical, 0 High, 3 Medium, 0 Low

---

## Medium Findings

### 1. Auth Session Endpoint Missing Rate Limiting

- **File:** `app/api/auth/session/route.ts:23`
- **Evidence:**
  ```typescript
  export async function POST(request: Request) {
    try {
      const { idToken } = await request.json();
      // ... no rate limit check before processing
      await verifyFirebaseToken(idToken);
  ```
- **Risk:** The `/api/auth/session` POST endpoint verifies Firebase tokens and creates session cookies without any rate limiting. While Firebase tokens are cryptographically strong and not brute-forceable, unlimited requests to this endpoint could be used for credential stuffing or denial-of-service against the Firebase Admin SDK verification. Other endpoints like `/api/projects`, `/api/messages`, and `/api/transactions` all use `withApiRateLimit` or `withAuthRateLimit`, but this auth endpoint does not.
- **Fix:** Wrap the handler with `withAuthRateLimit` from `lib/middleware/withRateLimit.ts`:
  ```typescript
  import { withAuthRateLimit } from '@/lib/middleware/withRateLimit';
  export const POST = withAuthRateLimit(async (request: NextRequest) => {
    // existing logic
  });
  ```

### 2. AI Analysis Endpoint Uses In-Memory Rate Limiter

- **File:** `app/api/projects/analyze-repo/route.ts:37`
- **Evidence:**

  ```typescript
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
  const RATE_LIMIT = 10;
  const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

  function checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(userId);
    // ...
  }
  ```

- **Risk:** The AI analysis endpoint (which calls the Anthropic Claude API and incurs per-request costs) uses an in-memory `Map` for rate limiting instead of the Redis-backed rate limiter used elsewhere. In a multi-instance deployment (Railway can run multiple replicas), each instance maintains its own rate limit map, effectively multiplying allowed requests by the number of instances. The map also resets on every server restart or deployment, bypassing limits entirely. This creates cost exposure risk — an attacker could trigger many expensive AI API calls.
- **Fix:** Replace the in-memory rate limiter with the existing Redis-based `withStrictRateLimit` or `withApiRateLimit` middleware:
  ```typescript
  import { withStrictRateLimit } from '@/lib/middleware/withRateLimit';
  export const POST = withStrictRateLimit(async (request: NextRequest) => {
    // existing logic (remove in-memory rateLimitMap)
  });
  ```

### 3. Rate Limiting Fails Open When Redis Is Unavailable

- **File:** `lib/utils/rateLimit.ts:154-163`
- **Evidence:**
  ```typescript
  // If Redis is not available, fail open (allow all requests)
  if (!redis) {
    return {
      allowed: true,
      remaining: maxRequests,
      limit: maxRequests,
      resetSeconds: windowSeconds,
      currentCount: 0,
    };
  }
  ```
  And in the error handler at line 202:
  ```typescript
  } catch (error) {
    console.error('[RateLimit] Error checking rate limit:', error);
    // Fail open - allow request if Redis is down
    return {
      allowed: true,
      remaining: maxRequests,
      limit: maxRequests,
      resetSeconds: windowSeconds,
      currentCount: 0,
    };
  }
  ```
- **Risk:** When Redis is unavailable (connection failure, network issue, or configuration problem), ALL rate limiting is silently disabled — every request is allowed through. This is a deliberate availability-over-security design choice, but means that a Redis outage removes all abuse protection simultaneously. An attacker who can cause Redis connectivity issues (or during legitimate infrastructure problems) could send unlimited requests to all rate-limited endpoints.
- **Fix:** Consider a hybrid approach — maintain a small in-memory fallback rate limiter (with a more generous limit) that activates when Redis is unavailable. This preserves availability while maintaining basic abuse protection:
  ```typescript
  if (!redis) {
    return checkInMemoryFallback(config); // Basic protection, not unlimited
  }
  ```

---

## Passed Checks

- [x] **No SQL injection found (Category 1)** — All production queries use Prisma ORM or parameterized `$queryRaw` tagged templates. Raw SQL (`$executeRawUnsafe`) only exists in test helpers with hardcoded table names.
- [x] **No XSS patterns found (Category 2)** — No unsafe DOM write methods, no raw HTML injection props, no `v-html` directives. React's default escaping provides protection across all components.
- [x] **No hardcoded secrets in source (Category 3)** — All secrets loaded from environment variables. `firebase-service-account.json` and `.env` are properly gitignored and not tracked. No secrets in `NEXT_PUBLIC_*` variables.
- [x] **Authentication well-implemented (Category 4)** — 58 API routes use `authenticateApiRequest`/`requireAuth`/`requireAdmin`. Firebase session cookies use `httpOnly`, `secure` (in production), and `sameSite: 'lax'`. Middleware protects all dashboard/seller/buyer/admin routes. Cron endpoints verify `CRON_SECRET`.
- [x] **No SSRF vulnerabilities found (Category 5)** — All server-side `fetch` calls use hardcoded base URLs (`GITHUB_API_BASE`). GitHub URL input is parsed to extract owner/repo, then API calls are constructed against `api.github.com`. No user-controlled URLs passed directly to fetch.
- [x] **Stripe security properly implemented (Category 13)** — `STRIPE_SECRET_KEY` in server-only code via env vars. Webhook handler uses `stripe.webhooks.constructEvent()` for signature verification. Body read as text (correct for signature). Publishable key correctly in `NEXT_PUBLIC_*`.
- [x] **AI API keys server-only (Category 15)** — `ANTHROPIC_API_KEY` loaded from `process.env` in server-only `RepoAnalysisService`. `max_tokens: 2000` limits cost per request. System prompt is static (no user input injection into system prompt). Endpoint requires authentication.
- [x] **Email service keys server-only (Category 16)** — `POSTMARK_SERVER_TOKEN` loaded from environment in server-only `EmailService`. No user-controlled arbitrary recipients — all emails go to transaction participants. Email sends triggered by authenticated actions only.
- [x] **Database connections secure (Category 17)** — `DATABASE_URL` only in server-side code. Prisma ORM handles all query parameterization. Connection managed via Prisma singleton (proper pooling). No raw SQL in production code paths.
- [x] **Redis credentials server-only (Category 18)** — `REDIS_URL` loaded from `process.env` in server-only utilities. All cached data has TTL. No sensitive PII stored unencrypted in cache. Redis used for caching and rate limiting only.

---

## Bright Spots

- **Comprehensive rate limiting infrastructure** — Redis-backed rate limiter with presets (auth: 5/15min, API: 100/min, public: 1000/hr, strict: 10/hr) and proper `429` responses with `Retry-After` headers. Applied to 20+ endpoints.
- **Security headers configured** — `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Strict-Transport-Security`, and `Permissions-Policy` all set in `next.config.ts`.
- **Stripe webhook signature verification** — Proper use of `constructEvent()` with `request.text()` (not `request.json()`), exactly as Stripe recommends.
- **GitHub OAuth CSRF protection** — `state` parameter stored in cookie and verified on callback, preventing CSRF attacks on the OAuth flow.
- **Encrypted token storage** — GitHub access tokens are encrypted before database storage (`encrypt(accessToken)`) and decrypted on use.
- **Environment validation** — `config/env.ts` validates required production variables at startup, preventing deployment with missing configuration.
- **Zod input validation** — Consistent use of Zod schemas across API routes for request body validation, preventing malformed input from reaching business logic.
