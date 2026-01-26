# Cron Jobs

Automated background jobs for periodic maintenance tasks.

## Available Jobs

### 1. Escrow Release (`/api/cron/release-escrow`)

Releases escrowed funds to sellers after the 7-day hold period.

- **Schedule**: Every 6 hours (`0 */6 * * *`)
- **What it does**:
  - Finds transactions with escrow ready for release
  - Transfers funds to seller via Stripe Connect
  - Updates transaction status to 'released'
  - Sends email notification to seller

### 2. Featured Listings Cleanup (`/api/cron/cleanup-featured`)

Automatically unfeatures projects that have expired featured periods and sends notification emails.

- **Schedule**: Every 1 hour (`0 * * * *`)
- **What it does**:
  - Finds projects with `featuredUntil` <= current time
  - Sets `isFeatured = false` for expired projects
  - Sends "Featured Listing Expired" email to sellers
  - Logs details of unfeatured projects and email results

### 3. Featured Listings Expiration Warning (`/api/cron/featured-expiration-warning`)

Sends warning emails to sellers 3 days before their featured listings expire.

- **Schedule**: Every 12 hours (`0 */12 * * *`)
- **What it does**:
  - Finds projects with `featuredUntil` in approximately 3 days
  - Sends "Featured Listing Expiring Soon" email to sellers
  - Encourages sellers to extend their featured period
  - Logs details of expiring projects and email results

## Authentication

All cron endpoints require Bearer token authentication:

```bash
Authorization: Bearer <CRON_SECRET>
```

The `CRON_SECRET` must be set in environment variables.

## Setup Instructions

### Railway Cron

1. In Railway dashboard, go to your service
2. Add a Cron Job service
3. Configure schedule and endpoint:

**Escrow Release:**
```
Schedule: 0 */6 * * *
Command: curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.railway.app/api/cron/release-escrow
```

**Featured Cleanup:**
```
Schedule: 0 * * * *
Command: curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.railway.app/api/cron/cleanup-featured
```

**Featured Expiration Warning:**
```
Schedule: 0 */12 * * *
Command: curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.railway.app/api/cron/featured-expiration-warning
```

### Vercel Cron

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/release-escrow",
      "schedule": "0 */6 * * *"
    },
    {
      "path": "/api/cron/cleanup-featured",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/featured-expiration-warning",
      "schedule": "0 */12 * * *"
    }
  ]
}
```

### External Cron Services (e.g., cron-job.org)

Create HTTP requests:

```
Method: GET
URL: https://your-app.com/api/cron/release-escrow
Headers: Authorization: Bearer YOUR_CRON_SECRET
Schedule: Every 6 hours
```

```
Method: GET
URL: https://your-app.com/api/cron/cleanup-featured
Headers: Authorization: Bearer YOUR_CRON_SECRET
Schedule: Every 1 hour
```

```
Method: GET
URL: https://your-app.com/api/cron/featured-expiration-warning
Headers: Authorization: Bearer YOUR_CRON_SECRET
Schedule: Every 12 hours
```

## Testing Locally

```bash
# Test escrow release
curl -H "Authorization: Bearer your-local-cron-secret" \
  http://localhost:3011/api/cron/release-escrow

# Test featured cleanup
curl -H "Authorization: Bearer your-local-cron-secret" \
  http://localhost:3011/api/cron/cleanup-featured

# Test featured expiration warning
curl -H "Authorization: Bearer your-local-cron-secret" \
  http://localhost:3011/api/cron/featured-expiration-warning
```

## Response Format

All cron jobs return JSON with execution details:

**Success Response (200):**
```json
{
  "processed": 5,
  "successful": 4,
  "failed": 1,
  "timestamp": "2026-01-26T10:00:00.000Z"
}
```

**Error Response (401/500):**
```json
{
  "error": "Unauthorized" | "Job failed",
  "message": "Error details"
}
```

## Monitoring

Check cron job execution logs:

```bash
# Railway
railway logs --filter="[EscrowReleaseCron]"
railway logs --filter="[FeaturedCleanupCron]"
railway logs --filter="[FeaturedExpirationWarningCron]"

# Vercel
vercel logs --filter="cron"
```

## Environment Variables

Required:
- `CRON_SECRET` - Secret token for authenticating cron requests

## Error Handling

- Jobs log all errors but continue processing remaining items
- Failed items are counted and reported in response
- Email failures don't prevent escrow release or cleanup operations
- All operations are idempotent (safe to retry)
- Featured expiration warnings: email failures are logged but don't fail the job
