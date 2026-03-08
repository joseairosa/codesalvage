# Security Improvements — 2026-03-08

Applied as a batch fix following the full-system security audit (SECURITY_AUDIT_REPORT.md).

---

## 1. XSS — JSON-LD `</script>` Injection (HIGH)

**File:** `app/projects/[id]/layout.tsx`

`JSON.stringify()` does not escape `<`, `>`, or `/`. A seller could set their project title to `</script><script>alert(...)//` and break out of the `<script type="application/ld+json">` tag, executing arbitrary JavaScript in every visitor's browser.

**Fix:** Added `.replace(/</g, '\\u003c')` to the serialized JSON-LD output before injection. `\u003c` is valid JSON and renders as `<` in structured data parsers, but cannot trigger HTML tag parsing.

```tsx
// Before
dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}

// After
dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
```

---

## 2. Error Details Exposed in Session API (LOW)

**File:** `app/api/auth/session/route.ts`

Raw Firebase Admin SDK error messages (which may include service account path hints, project IDs, or SDK internals) were returned to the unauthenticated caller via a `details` field.

**Fix:** Removed `details` from the API response. The error message is now logged server-side only.

```typescript
// Before
return NextResponse.json({ error: '...', details: errorMessage }, { status: statusCode });

// After
console.error('[Session API] Auth error:', errorMessage);
return NextResponse.json({ error: '...' }, { status: statusCode });
```

---

## 3. Rate Limit IP Spoofing via X-Forwarded-For (MEDIUM)

**File:** `lib/utils/rateLimit.ts`

The rate limiter was reading the **first** (leftmost) IP from `X-Forwarded-For`, which is client-controlled. Attackers could bypass all rate limits by rotating fake IPs via a custom header.

**Fix:** Now reads the **last** (rightmost) IP, which is appended by the trusted Railway proxy and cannot be forged by clients.

```typescript
// Before
const firstIP = forwardedFor.split(',')[0];

// After
const ips = forwardedFor.split(',');
const trustedIP = ips[ips.length - 1];
```

---

## 4. CI/CD — Actions Pinned to Mutable Branch Tags (MEDIUM)

**File:** `.github/workflows/ci.yml`

All third-party GitHub Actions were pinned to mutable `@v4` tags. A supply-chain compromise of any upstream action repository could silently execute malicious code in CI with access to all secrets.

**Fix:** Every action is now pinned to its full commit SHA with a version comment.

| Action                    | SHA                                        | Version |
| ------------------------- | ------------------------------------------ | ------- |
| `actions/checkout`        | `34e114876b0b11c390a56381ad16ebd13914f8d5` | v4.3.1  |
| `actions/setup-node`      | `49933ea5288caeca8642d1e84afbd3f7d6820020` | v4.4.0  |
| `codecov/codecov-action`  | `b9fd7d16f6d7d1b5d2bec1a2887e65ceed900238` | v4.6.0  |
| `actions/upload-artifact` | `ea165f8d65b6e75b540449e92b4886f43607fa02` | v4.6.2  |

**Maintenance:** Use Dependabot or `pin-github-action` CLI to keep SHAs current as new versions are released.

---

## 5. Missing Content-Security-Policy Header (MEDIUM)

**File:** `next.config.ts`

No `Content-Security-Policy` header was configured, leaving the browser with no declarative policy to block XSS. This was especially relevant given Finding #1 and the use of `react-markdown` for seller-supplied content.

**Fix:** Added a CSP to the `headers()` function covering all integration endpoints:

```
default-src 'self';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https: blob:;
connect-src 'self' https://api.stripe.com https://*.firebaseio.com
            https://identitytoolkit.googleapis.com https://securetoken.googleapis.com;
frame-src https://js.stripe.com https://hooks.stripe.com;
font-src 'self' data:
```

Note: `unsafe-inline` for scripts is required by Next.js App Router until a nonce-based CSP is implemented. This still provides value by blocking external script loads from unknown origins.

---

## 6. N+1 Queries in `getConversations` (MEDIUM)

**File:** `lib/repositories/MessageRepository.conversations.ts`

For a user with N conversation partners, the inbox loaded with N `findFirst` + N `count` queries, producing 2+2N total database round-trips. A seller with 100 conversations generated 202 queries per inbox load.

**Fix:** Refactored to 4 queries regardless of conversation count:

1. `findMany` — distinct sent message partner IDs
2. `findMany` — distinct received message partner IDs
3. `findMany` — all messages between the user and all partners (batch, ordered newest first; grouped by partner in JavaScript)
4. `groupBy` — all unread counts in one query (replaces N `count` queries)

```typescript
// Before: N findFirst + N count = 2+2N queries
const latestMessage = await prisma.message.findFirst({ where: { ... } });
const unreadCount = await prisma.message.count({ where: { ... } });

// After: 1 findMany + 1 groupBy = 4 queries total
const allMessages = await prisma.message.findMany({ where: { OR: [...all partners] } });
const unreadGroups = await prisma.message.groupBy({ by: ['senderId'], _count: { id: true } });
```

---

## 7. Firebase ID Token Lifetime Mismatch (LOW)

**Files:** `app/api/auth/session/route.ts`, `lib/firebase-auth.ts`, `lib/auth-helpers.ts`

The session cookie was storing the raw Firebase ID token directly with a 7-day `maxAge`. Firebase ID tokens expire after **1 hour**, causing session verification to fail for any user who did not refresh within the hour.

**Fix:** Implemented Firebase's documented server-side session cookie pattern:

- **`POST /api/auth/session`** now calls `admin.auth().createSessionCookie(idToken, { expiresIn: 7d })` to exchange the short-lived ID token for a proper 7-day session cookie before storing it.
- **`lib/firebase-auth.ts`** has a new `verifyFirebaseSessionCookie(cookie)` function that calls `admin.auth().verifySessionCookie(cookie, true)` (with revocation checking).
- **`lib/auth-helpers.ts`** (`requireAuth`, `requireAdmin`, `getSession`, etc.) now call `verifyFirebaseSessionCookie` instead of `verifyFirebaseToken`.

The user creation and account-linking logic (`verifyFirebaseToken`) still runs during the POST handler (when the ID token is first presented), so new user provisioning is unaffected.

**Migration note:** Existing sessions stored as raw ID tokens will fail `verifySessionCookie` and redirect users to sign in once. No data loss — users sign in and receive a properly formatted session cookie.

---

## Test Coverage

All existing unit tests were updated to reflect the new implementations:

- `lib/repositories/__tests__/MessageRepository.test.ts` — updated `getConversations` tests to mock `findMany` batch + `groupBy` instead of `findFirst` + `count`
- Mock setup extended with `groupBy: vi.fn()` on the Prisma message mock

All 1277 tests pass. TypeScript strict mode: zero errors.
