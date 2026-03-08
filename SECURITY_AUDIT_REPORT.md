# Security Audit Report — CodeSalvage

**Date:** 2026-03-08
**Scan Type:** Full System Scan (All 32 Categories)
**Stack:** Next.js 15, Prisma/PostgreSQL, Firebase Auth, Stripe Connect, Cloudflare R2, Redis, Resend/Postmark, Anthropic Claude

---

## Summary

- **Overall Risk:** Medium
- **Findings:** 0 Critical, 1 High, 4 Medium, 2 Low
- **Passed Checks:** 25 categories fully clear

---

## High Findings

### 1. XSS — JSON-LD Script Tag Injection via Unescaped `</script>`

- **File:** `app/projects/[id]/layout.tsx:129`
- **Code:**
  ```tsx
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
  ```
  Where `jsonLd` contains `project.title` and `project.description` sourced directly from the database (seller-controlled).
- **Why it is vulnerable:** JavaScript's native `JSON.stringify()` does NOT escape `<`, `>`, or `/`. A seller can set their project title to `</script><script>alert(document.cookie)//` and the serialized JSON-LD will contain a literal `</script>` sequence that terminates the `<script type="application/ld+json">` tag. Any content after it executes as JavaScript in every visitor's browser. This affects all users viewing any project detail page.
- **Fix:** Escape the `<` character in the serialized output before injecting:
  ```tsx
  dangerouslySetInnerHTML={{
    __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c')
  }}
  ```
  `\u003c` is valid JSON and browsers render it as `<` in structured data parsers, but it does not trigger HTML tag parsing. This is the standard JSON-LD XSS fix.

---

## Medium Findings

### 2. Rate Limiting — IP Spoofing via Untrusted `X-Forwarded-For`

- **File:** `lib/utils/rateLimit.ts:307–316`
- **Code:**
  ```typescript
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIP = forwardedFor.split(',')[0];
    if (firstIP) {
      return firstIP.trim();
    }
  }
  ```
- **Why it is vulnerable:** The first IP in `X-Forwarded-For` is client-controlled. An attacker sending `X-Forwarded-For: 1.2.3.4` as a request header causes the rate limiter to track `1.2.3.4` — a fake identity. By rotating fake IPs they bypass all auth and API rate limits completely.
- **Fix:** Use the **last** (rightmost) IP in `X-Forwarded-For`, which is appended by your trusted Railway proxy and cannot be spoofed by the client:
  ```typescript
  const ips = forwardedFor.split(',');
  return ips[ips.length - 1].trim();
  ```

### 3. N+1 Queries — `getConversations` Issues One Query Per Conversation Partner

- **File:** `lib/repositories/MessageRepository.conversations.ts:39–67`
- **Code:**
  ```typescript
  const conversations = await Promise.all(
    Array.from(conversationPartnerIds).map(async (partnerId) => {
      const latestMessage = await prisma.message.findFirst({
        where: { OR: [{ senderId: userId, recipientId: partnerId }, ...] },
        ...
      });
    })
  );
  ```
- **Why it is vulnerable:** For a user with N conversation partners this issues N+2 database queries (2 `findMany` + 1 `findFirst` per partner). A seller with 100 conversations generates 102 round-trips per inbox load.
- **Fix:** Fetch all latest messages with a single grouped query, then batch-load partner user data with `findMany({ where: { id: { in: [...partnerIds] } } })`. Total becomes 3 queries regardless of conversation count.

### 4. CI/CD — Third-Party Actions Pinned to Mutable Branch Tags

- **File:** `.github/workflows/ci.yml:39,44,109,166,178,185`
- **Code:**
  ```yaml
  uses: actions/checkout@v4
  uses: actions/setup-node@v4
  uses: codecov/codecov-action@v4
  uses: actions/upload-artifact@v4
  ```
- **Why it is vulnerable:** `@v4` is a mutable tag. If any upstream action repository is compromised, malicious code executes in your CI with access to all secrets (`STRIPE_SECRET_KEY`, `DATABASE_URL`, Firebase credentials in future runs). Supply-chain attacks on GitHub Actions are an active, documented threat.
- **Fix:** Pin every action to its full commit SHA:
  ```yaml
  uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
  uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af  # v4.1.0
  ```
  Use Dependabot or the `pin-github-action` CLI to automate SHA updates.

### 5. Missing Content-Security-Policy Header

- **File:** `next.config.ts:130–162`
- **Evidence:** The `headers()` function configures `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `X-XSS-Protection`, `Permissions-Policy`, and `Strict-Transport-Security` — but no `Content-Security-Policy`.
- **Why it matters:** Without a CSP the browser has no declarative policy against XSS. This is especially relevant alongside Finding #1 and the use of `react-markdown` for rendering seller-supplied project descriptions.
- **Fix:** Add a CSP to the headers array:
  ```typescript
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://api.stripe.com https://*.firebaseio.com https://identitytoolkit.googleapis.com",
      "frame-src https://js.stripe.com",
    ].join('; ')
  }
  ```

---

## Low Findings

### 6. Internal Error Details Exposed in Session API Response

- **File:** `app/api/auth/session/route.ts:65–71`
- **Code:**
  ```typescript
  return NextResponse.json(
    {
      error: isConfigError ? 'Server configuration error' : 'Invalid token',
      details: errorMessage, // raw SDK error message returned to caller
    },
    { status: statusCode }
  );
  ```
- **Why it matters:** Raw Firebase Admin SDK error messages — which may include service account path hints, project IDs, or SDK internals — are returned to the unauthenticated caller.
- **Fix:** Remove `details` from the response. Log it server-side only:
  ```typescript
  console.error('[Session API] Auth error:', errorMessage);
  return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  ```

### 7. Firebase ID Token Stored Verbatim as Session Cookie (Lifetime Mismatch)

- **File:** `app/api/auth/session/route.ts:44`
- **Code:**
  ```typescript
  cookieStore.set('session', idToken, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,  // 7-day cookie
    ...
  });
  ```
- **Why it matters:** Firebase ID tokens expire after **1 hour**. The cookie lives 7 days. After the first hour, `verifyFirebaseToken()` will reject the stored token on every server request until the client re-authenticates. Firebase's documented server-side pattern is to exchange the ID token for a Firebase **session cookie** via `admin.auth().createSessionCookie()`, which supports lifetimes up to 14 days and can be revoked.
- **Fix:** Exchange in the POST handler:
  ```typescript
  const sessionCookie = await admin.auth().createSessionCookie(idToken, {
    expiresIn: 60 * 60 * 24 * 7 * 1000,
  });
  cookieStore.set('session', sessionCookie, { httpOnly: true, secure: true, ... });
  ```
  Update `verifyFirebaseToken` to call `admin.auth().verifySessionCookie(cookie, true)`.

---

## Passed Checks

- [x] **SQL Injection (Cat 1)** — Prisma ORM used throughout; all queries parameterized. `$queryRaw` uses tagged template literal (safe). `$queryRawUnsafe`/`$executeRawUnsafe` only in `tests/helpers/db.ts` with hardcoded table names.
- [~] **XSS (Cat 2)** — One finding above. No other `dangerouslySetInnerHTML` in components. `react-markdown` does not pass raw HTML by default.
- [x] **Hardcoded Secrets (Cat 3)** — No API keys, tokens, or passwords in source. All secrets via `process.env`. CI uses clearly-labelled dummy values. `config/env.ts` enforces required vars at startup.
- [x] **Authentication (Cat 4)** — Firebase Admin SDK verifies every token server-side. Cookie is `httpOnly`, `secure` (prod), `sameSite: lax`. Admin routes doubly protected via middleware + `requireAdminApi()` with `isAdmin` assertion.
- [x] **SSRF (Cat 5)** — GitHub URL validated by Zod + regex before fetch. GitHub API base URL hardcoded in `GitHubService`. No user-controlled URL passed directly to `fetch()`.
- [x] **Supabase (Cat 6)** — Not applicable (PostgreSQL/Prisma stack).
- [x] **Rate Limiting (Cat 7)** — Redis-backed limiter with presets: auth (5/15min), api (100/min), strict (10/hr), public (1000/hr). In-memory fallback (5x limit) on Redis failure. AI endpoint uses strict preset. IP spoofing concern in Finding #2.
- [x] **CORS (Cat 8)** — No wildcard CORS. `serverActions.allowedOrigins` lists only production domains. No `Access-Control-Allow-Origin: *` with credentials.
- [x] **Cryptography (Cat 9)** — `Math.random()` used only for probabilistic cache cleanup (non-security). No MD5/SHA1 for passwords. GitHub OAuth tokens encrypted at rest via `lib/encryption`.
- [x] **Dangerous Patterns (Cat 10)** — No dynamic code evaluation, shell execution, unsafe deserialization, or unsafe YAML loading in production code.
- [x] **Cloud Security (Cat 11)** — R2 credentials from environment only. No IAM policies in-repo.
- [~] **Logging/Data Exposure (Cat 12)** — Logging convention followed. No passwords/tokens/card data logged. Session API error detail issue in Finding #6.
- [x] **Stripe Security (Cat 13)** — `stripe.webhooks.constructEvent(body, signature, secret)` called before any processing. Body read as text (correct). `STRIPE_SECRET_KEY` server-only. No hardcoded price IDs.
- [x] **Auth Providers (Cat 14)** — `FIREBASE_SERVICE_ACCOUNT_BASE64` server-only. `NEXT_PUBLIC_FIREBASE_API_KEY` (publishable) correctly client-exposed. `AUTH_SECRET` not in client bundle.
- [x] **AI API Security (Cat 15)** — `ANTHROPIC_API_KEY` loaded server-side only. Not in `NEXT_PUBLIC_*`. `max_tokens: 2000` set. Endpoint rate-limited (strict preset, 10/hr). Zod validates AI output.
- [x] **Email Services (Cat 16)** — `POSTMARK_SERVER_TOKEN` and `RESEND_API_KEY` server-only. Recipients resolved from authenticated user DB record. No user-controlled email headers.
- [x] **Database Security (Cat 17)** — `DATABASE_URL` server-side only. Prisma ORM parameterizes all queries. No `$queryRawUnsafe` in production paths.
- [x] **Redis/Cache Security (Cat 18)** — `REDIS_URL` server-side only. Redis used only in `lib/utils/rateLimit.ts` and `lib/utils/cache.ts`. No credentials in client code.
- [x] **SMS/Communication (Cat 19)** — Not applicable (no Twilio).
- [x] **HIPAA (Cat 20)** — Not applicable (no health data).
- [x] **SOC 2 (Cat 21)** — Admin audit logging in `AdminService`. Auth at multiple layers. Zod input validation on all routes. Centralised error handling per service.
- [x] **PCI-DSS (Cat 22)** — No raw card numbers, CVV, or PANs in code. All payment flows use Stripe tokenization. Application never handles raw card data.
- [x] **GDPR (Cat 23)** — Deletion: project DELETE, notification DELETE, admin ban/delete. Data access via dashboard. Note: a self-service account-deletion endpoint would strengthen Art. 17 compliance.
- [x] **Memory Leaks (Cat 24)** — No unbounded module-level caches (Redis handles TTL). Rate limiter fallback map uses time-based eviction. No uncleaned event listeners in React components found.
- [~] **N+1 Queries (Cat 25)** — One finding above (`getConversations`). All other repositories use eager loading or batch queries. All `findMany` calls include pagination (`take`/`skip`).
- [x] **Performance (Cat 26)** — `readFileSync` only in Firebase Admin singleton init (startup, not per-request). All `findMany` paginated. `Promise.all` used for independent async ops throughout.
- [x] **Dependencies (Cat 27)** — `package-lock.json` committed. All packages on current major versions (Next.js 15, Prisma 6, Stripe 17, Firebase 11).
- [x] **Authorization/IDOR (Cat 28)** — Transaction and message queries filter by `auth.user.id`. Admin routes require role check. No resource-by-ID endpoint returns data without ownership or role verification.
- [x] **File Uploads (Cat 29)** — R2Service validates MIME types against explicit allowlist. Filenames sanitized (lowercase, special chars stripped, length capped at 100). Pre-signed URL pattern (no server-side multipart). Size limits enforced (10MB images, 500MB zips).
- [x] **Input Validation/ReDoS (Cat 30)** — Zod on all API inputs. No catastrophic regex patterns. Server Actions body size explicitly set (`10mb`). No `path.join` with user input for file reads.
- [~] **CI/CD Security (Cat 31)** — Mutable action tags in Finding #4. No secrets hardcoded in YAML. No `pull_request_target` trigger. No expression injection in `run:` steps.
- [~] **Security Headers (Cat 32)** — Missing CSP in Finding #5. Present: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-XSS-Protection`, `Permissions-Policy`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `poweredByHeader: false`.

---

## Fix Priority

| #   | Finding                                    | Severity | Est. Effort |
| --- | ------------------------------------------ | -------- | ----------- |
| 1   | XSS — JSON-LD `</script>` injection        | **High** | ~5 min      |
| 2   | Error details exposed in session API       | Low      | ~2 min      |
| 3   | Rate limit IP spoofing via X-Forwarded-For | Medium   | ~30 min     |
| 4   | CI/CD — pin actions to commit SHAs         | Medium   | ~30 min     |
| 5   | Missing Content-Security-Policy header     | Medium   | ~2 hrs      |
| 6   | N+1 queries in getConversations            | Medium   | ~2–3 hrs    |
| 7   | Firebase session cookie lifetime mismatch  | Low      | ~2–3 hrs    |

---

_Report generated by snitch:snitch — evidence-based, no false positives._
