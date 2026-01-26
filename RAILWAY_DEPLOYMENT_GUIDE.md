# Railway Deployment Guide - CodeSalvage

## Overview

Complete guide for deploying CodeSalvage marketplace to Railway.app with PostgreSQL, Redis, and production configuration.

**Repository**: https://github.com/joseairosa/codesalvage
**Domain**: codesalvage.com
**Platform**: Railway.app

---

## Prerequisites

Before starting deployment, ensure you have:

1. **Railway Account**: Sign up at https://railway.app
2. **GitHub Repository**: Code pushed to https://github.com/joseairosa/codesalvage
3. **Domain**: codesalvage.com registered and ready for DNS configuration
4. **Third-Party Services**:
   - Stripe account with API keys
   - SendGrid account with API key
   - Cloudflare R2 bucket configured
   - GitHub OAuth app configured

---

## Step 1: Create Railway Project

### 1.1 Create New Project

1. Log into Railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway to access your GitHub account
5. Select `joseairosa/codesalvage` repository
6. Railway will automatically detect Next.js and start deployment

### 1.2 Add PostgreSQL Database

1. In your Railway project dashboard, click "New"
2. Select "Database" → "Add PostgreSQL"
3. Railway provisions a PostgreSQL database instance
4. Environment variable `DATABASE_URL` is automatically injected into your app

### 1.3 Add Redis

1. Click "New" again
2. Select "Database" → "Add Redis"
3. Railway provisions a Redis instance
4. Environment variable `REDIS_URL` is automatically injected

---

## Step 2: Configure Environment Variables

In Railway project settings → Variables, add the following:

### Required Variables

```bash
# Database (auto-configured by Railway)
DATABASE_URL=postgresql://... # Auto-injected by Railway Postgres add-on
REDIS_URL=redis://... # Auto-injected by Railway Redis add-on

# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://codesalvage.com

# Auth.js (NextAuth)
AUTH_SECRET=<generate-with-openssl-rand-base64-32>
AUTH_GITHUB_ID=<your-github-oauth-app-client-id>
AUTH_GITHUB_SECRET=<your-github-oauth-app-client-secret>
NEXTAUTH_URL=https://codesalvage.com

# Stripe
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cloudflare R2
R2_ENDPOINT=https://xxxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=codesalvage
R2_PUBLIC_URL=https://pub-xxx.r2.dev

# SendGrid
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=noreply@codesalvage.com

# Cron (for escrow release)
CRON_SECRET=<generate-random-secret>
```

### Generate Secrets

```bash
# Generate AUTH_SECRET
openssl rand -base64 32

# Generate CRON_SECRET
openssl rand -hex 32
```

---

## Step 3: Database Setup

### 3.1 Run Prisma Migrations

Once deployed, Railway will automatically run migrations during build (via `npm run build` which includes `prisma generate`). However, you need to push the schema to the database:

**Option 1: Via Railway CLI**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run migration
railway run npx prisma migrate deploy
```

**Option 2: Via Railway Dashboard**
1. Go to your app service in Railway
2. Click "Settings" → "Deploy"
3. Add a deployment command: `npx prisma migrate deploy`
4. Or run it manually via the Railway console

### 3.2 Seed Database (Optional)

If you have seed data:

```bash
railway run npx prisma db seed
```

---

## Step 4: Configure Domain

### 4.1 Add Domain to Railway

1. In Railway project, go to your app service
2. Click "Settings" → "Domains"
3. Click "Custom Domain"
4. Enter `codesalvage.com`
5. Railway provides DNS configuration instructions

### 4.2 Configure DNS (Cloudflare)

In Cloudflare DNS settings for `codesalvage.com`:

**Add CNAME record:**
```
Type: CNAME
Name: @ (or codesalvage.com)
Target: <railway-provided-url>.up.railway.app
Proxy: Enabled (orange cloud)
```

**Add www redirect (optional):**
```
Type: CNAME
Name: www
Target: codesalvage.com
Proxy: Enabled
```

### 4.3 SSL Certificate

Railway automatically provisions SSL certificates via Let's Encrypt. Wait 5-10 minutes for certificate issuance.

---

## Step 5: Configure Third-Party Services

### 5.1 Update GitHub OAuth

In GitHub OAuth app settings:
- **Homepage URL**: `https://codesalvage.com`
- **Authorization callback URL**: `https://codesalvage.com/api/auth/callback/github`

### 5.2 Configure Stripe Webhooks

In Stripe Dashboard → Developers → Webhooks:

1. Click "Add endpoint"
2. **Endpoint URL**: `https://codesalvage.com/api/webhooks/stripe`
3. **Events to send**:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `account.updated`
4. Copy the signing secret and add to Railway as `STRIPE_WEBHOOK_SECRET`

### 5.3 Configure SendGrid Domain

In SendGrid Settings → Sender Authentication:

1. Authenticate domain `codesalvage.com`
2. Add DNS records to Cloudflare as instructed
3. Verify domain authentication
4. Set `noreply@codesalvage.com` as verified sender

### 5.4 Configure Cloudflare R2 CORS

In Cloudflare R2 bucket settings:

```json
{
  "AllowedOrigins": ["https://codesalvage.com"],
  "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
  "AllowedHeaders": ["*"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}
```

---

## Step 6: Setup Cron Jobs (Escrow Release)

Railway doesn't have built-in cron support. Use an external service:

### Option 1: Railway Scheduled Jobs (Beta)

Check if available for your account.

### Option 2: External Cron Service

Use a service like cron-job.org or EasyCron:

1. Create new cron job
2. **URL**: `https://codesalvage.com/api/cron/release-escrow`
3. **Method**: GET
4. **Headers**: `Authorization: Bearer <CRON_SECRET>`
5. **Schedule**: Every 6 hours (0 */6 * * *)

### Option 3: GitHub Actions

Create `.github/workflows/cron-escrow.yml`:

```yaml
name: Release Escrow Cron

on:
  schedule:
    - cron: '0 */6 * * *' # Every 6 hours

jobs:
  release-escrow:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Escrow Release
        run: |
          curl -X GET https://codesalvage.com/api/cron/release-escrow \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

Add `CRON_SECRET` to GitHub repository secrets.

---

## Step 7: Post-Deployment Verification

### 7.1 Health Check

Visit `https://codesalvage.com/api/health`

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-27T10:30:00.000Z",
  "environment": "production",
  "checks": {
    "database": true,
    "redis": true
  }
}
```

### 7.2 Test User Flows

1. **Authentication**:
   - Sign in with GitHub
   - Verify user profile created

2. **Project Creation**:
   - Create a project listing
   - Upload images to R2
   - Verify project appears in search

3. **Payments**:
   - Test purchase flow with Stripe test cards
   - Verify transaction created
   - Check email notifications

4. **Subscriptions**:
   - Test Pro subscription upgrade
   - Verify Stripe subscription created
   - Check billing portal access

### 7.3 Monitor Logs

In Railway dashboard:
1. Go to your app service
2. Click "Deployments"
3. Select latest deployment
4. View logs for errors

---

## Step 8: Production Checklist

Before announcing launch:

- [ ] Health check endpoint returns 200 OK
- [ ] All environment variables configured
- [ ] Database migrations applied successfully
- [ ] Domain DNS configured and SSL active
- [ ] GitHub OAuth working
- [ ] Stripe webhooks configured and receiving events
- [ ] SendGrid domain verified and emails sending
- [ ] R2 file uploads working
- [ ] Cron job configured for escrow release
- [ ] Test purchase completed successfully
- [ ] Test subscription upgrade working
- [ ] Error monitoring setup (Sentry or similar)
- [ ] Backup strategy configured

---

## Troubleshooting

### Build Failures

**Issue**: Build fails with TypeScript errors

**Solution**:
```bash
# Run locally to check
npm run build

# Fix any TypeScript errors
npx tsc --noEmit
```

**Issue**: Prisma client generation fails

**Solution**: Ensure `prisma generate` runs during build. Check `package.json`:
```json
{
  "scripts": {
    "build": "prisma generate && next build"
  }
}
```

### Database Connection Issues

**Issue**: Health check shows `database: false`

**Solution**:
1. Verify `DATABASE_URL` environment variable set
2. Check Prisma connection in Railway logs
3. Ensure database service is running
4. Verify database migrations applied

### Stripe Webhook Failures

**Issue**: Webhooks not receiving events

**Solution**:
1. Verify webhook URL is correct: `https://codesalvage.com/api/webhooks/stripe`
2. Check `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard
3. Review Railway logs for webhook errors
4. Test webhook with Stripe CLI:
   ```bash
   stripe listen --forward-to https://codesalvage.com/api/webhooks/stripe
   ```

### File Upload Issues

**Issue**: R2 uploads failing with CORS errors

**Solution**:
1. Verify R2 CORS configuration includes `https://codesalvage.com`
2. Check `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` in Railway variables
3. Test R2 connection with AWS CLI

---

## Monitoring and Maintenance

### Railway Metrics

Monitor in Railway dashboard:
- **CPU Usage**: Should stay below 80%
- **Memory Usage**: Should stay below 512MB
- **Request Volume**: Track trends
- **Response Times**: Target <500ms p95

### Database Monitoring

```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('railway')) AS db_size;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check active connections
SELECT count(*) FROM pg_stat_activity;
```

### Log Monitoring

Key log patterns to monitor:
- `[HealthCheck] Database check failed` - Database connectivity issues
- `[StripeWebhook] Failed to process` - Payment processing errors
- `[ProjectService] Validation error` - User input errors
- `[Auth] GitHub OAuth failed` - Authentication issues

### Backup Strategy

**Database Backups**:
- Railway provides automatic daily backups
- Configure retention period in Railway settings
- Test backup restoration periodically

**Code Backups**:
- GitHub repository serves as code backup
- Tag releases: `git tag v1.0.0 && git push --tags`

---

## Scaling Considerations

### Horizontal Scaling

Railway supports horizontal scaling:
1. Go to service settings
2. Increase replica count
3. Railway load balances automatically

**When to scale**:
- CPU usage consistently >80%
- Response times >1s p95
- High request volume (>1000 req/min)

### Database Scaling

**Upgrade Plan**:
- Railway offers larger database instances
- Upgrade in database service settings

**Connection Pooling**:
Already configured via Prisma:
```typescript
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Redis Caching

Implement caching for expensive queries:
- Project listings
- Seller profiles
- Rating calculations

---

## Cost Estimation

**Railway Pricing** (estimated monthly):
- **Starter Plan**: $5/month (includes $5 credit)
- **PostgreSQL Add-on**: $5/month
- **Redis Add-on**: $5/month
- **Usage-based**: ~$10-20/month (depending on traffic)

**Total**: ~$25-35/month initially

**Third-Party Services**:
- Stripe: Pay-as-you-go (2.9% + $0.30 per transaction)
- SendGrid: Free tier (100 emails/day) or $15/month (40k emails)
- Cloudflare R2: $0.015/GB stored, zero egress fees

---

## Support and Resources

**Railway Documentation**: https://docs.railway.app
**Railway Community**: https://discord.gg/railway
**Next.js Deployment**: https://nextjs.org/docs/deployment
**Prisma Railway Guide**: https://www.prisma.io/docs/guides/deployment/railway

---

**Last Updated**: January 27, 2026
**Status**: Ready for Deployment
**Repository**: https://github.com/joseairosa/codesalvage
