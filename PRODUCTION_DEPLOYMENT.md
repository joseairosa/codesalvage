# Production Deployment Checklist
**Project**: ProjectFinish (codesalvage.com)
**Status**: 🚀 READY FOR DEPLOYMENT

---

## Pre-Deployment Summary

**Completed** ✅:
- [x] 507 tests passing
- [x] Redis rate limiting implemented
- [x] Redis caching on expensive queries
- [x] Security audit (OWASP Top 10) complete
- [x] Performance optimization complete
- [x] Legal documents created (ToS, Privacy, Cookies)
- [x] Honeybadger error monitoring configured (code-level)

**Remaining** ⏹️:
- [ ] Railway production environment configuration
- [ ] Honeybadger production API key setup
- [ ] Custom domain (codesalvage.com) configuration
- [ ] Stripe live mode configuration
- [ ] Final smoke testing

---

## 1. Honeybadger Production Setup

### Step 1: Get API Key from Honeybadger Dashboard

**Current Status**: You're on the setup page ✅

**Actions**:
1. Copy your Honeybadger API key from the dashboard
2. Note it down securely (you'll need it for Railway environment variables)

**API Key Format**: `hbp_xxxxxxxxxxxxxxxxxxxxxx`

---

## 2. Railway Environment Variables Configuration

### Step 2: Configure Railway Production Environment

**Railway Dashboard**: https://railway.app/

**Environment Variables to Set**:

```bash
# ============================================
# DATABASE (Already configured via Railway)
# ============================================
DATABASE_URL="postgresql://..." # Auto-configured by Railway Postgres

# ============================================
# REDIS (Already configured via Railway)
# ============================================
REDIS_URL="redis://..." # Auto-configured by Railway Redis

# ============================================
# HONEYBADGER (ERROR MONITORING) - SET THESE
# ============================================
HONEYBADGER_API_KEY="hbp_your_api_key_here"
NEXT_PUBLIC_HONEYBADGER_API_KEY="hbp_your_api_key_here"
HONEYBADGER_ENV="production"

# ============================================
# NEXT.JS
# ============================================
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://codesalvage.com"

# ============================================
# AUTH.JS (GITHUB OAUTH) - VERIFY THESE
# ============================================
AUTH_SECRET="your_existing_auth_secret"
AUTH_GITHUB_ID="your_github_oauth_app_id"
AUTH_GITHUB_SECRET="your_github_oauth_app_secret"
NEXTAUTH_URL="https://codesalvage.com"

# ============================================
# STRIPE (SWITCH TO LIVE MODE) - UPDATE THESE
# ============================================
# CURRENT: Test mode keys (sk_test_...)
# REQUIRED: Live mode keys (sk_live_...)

STRIPE_SECRET_KEY="sk_live_your_live_secret_key"
STRIPE_PUBLISHABLE_KEY="pk_live_your_live_publishable_key"
STRIPE_WEBHOOK_SECRET="whsec_your_production_webhook_secret"

# ============================================
# CLOUDFLARE R2 (FILE STORAGE) - VERIFY THESE
# ============================================
R2_ENDPOINT="https://your_account.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="your_r2_access_key"
R2_SECRET_ACCESS_KEY="your_r2_secret_key"
R2_BUCKET_NAME="projectfinish-production"
R2_PUBLIC_URL="https://pub-xxxxx.r2.dev"

# ============================================
# SENDGRID (EMAIL) - VERIFY THIS
# ============================================
SENDGRID_API_KEY="SG.your_sendgrid_api_key"
SENDGRID_FROM_EMAIL="noreply@codesalvage.com"

# ============================================
# CRON JOBS (GENERATE NEW SECRET)
# ============================================
# Generate with: openssl rand -base64 32
CRON_SECRET="your_cron_secret_for_production"
```

### How to Set Variables in Railway:

1. Go to Railway Dashboard
2. Select your project (ProjectFinish)
3. Click "Variables" tab
4. Click "New Variable"
5. Add each variable above
6. Click "Deploy" to apply changes

---

## 3. Stripe Live Mode Configuration

### Step 3: Switch to Stripe Live Mode

**Stripe Dashboard**: https://dashboard.stripe.com/

#### 3.1 Get Live API Keys

1. Go to Stripe Dashboard
2. Toggle from "Test mode" to "Live mode" (top right)
3. Navigate to "Developers" → "API keys"
4. Copy:
   - **Secret key** (sk_live_...)
   - **Publishable key** (pk_live_...)
5. Add to Railway environment variables

#### 3.2 Configure Stripe Connect (for seller payouts)

1. Go to "Connect" → "Settings" in Stripe Dashboard
2. Verify business information is complete
3. Enable "Express" account type
4. Set brand name: "CodeSalvage" or "ProjectFinish"
5. Set brand color and logo (optional)

#### 3.3 Setup Production Webhooks

**Webhook URL**: `https://codesalvage.com/api/webhooks/stripe`

**Events to Subscribe**:
```
payment_intent.succeeded
payment_intent.payment_failed
account.updated
account.application.deauthorized
charge.refunded
```

**How to Create Webhook**:
1. Go to "Developers" → "Webhooks" in Stripe Dashboard
2. Click "Add endpoint"
3. Enter URL: `https://codesalvage.com/api/webhooks/stripe`
4. Select events listed above
5. Click "Add endpoint"
6. Copy "Signing secret" (whsec_...)
7. Add `STRIPE_WEBHOOK_SECRET` to Railway environment variables

#### 3.4 Test Stripe Integration (After Deployment)

```bash
# Use Stripe CLI to test webhook locally first
stripe listen --forward-to https://codesalvage.com/api/webhooks/stripe

# Trigger test payment
stripe trigger payment_intent.succeeded
```

---

## 4. Custom Domain Configuration (codesalvage.com)

### Step 4: Connect Domain to Railway

**Railway Domain Settings**:

1. Go to Railway Dashboard → Your Project → Settings
2. Click "Domains" tab
3. Click "Add Domain"
4. Enter: `codesalvage.com`
5. Railway will provide DNS records

#### 4.1 DNS Configuration (Your Domain Registrar)

**Add these DNS records at your domain registrar**:

**Option A: Using CNAME (Recommended)**
```
Type: CNAME
Name: @ (or leave blank for root domain)
Value: [railway-provided-domain].up.railway.app
TTL: 3600
```

**Option B: Using A Record (if CNAME not supported for root)**
```
Type: A
Name: @ (or leave blank)
Value: [Railway-provided IP address]
TTL: 3600
```

**For www subdomain**:
```
Type: CNAME
Name: www
Value: codesalvage.com
TTL: 3600
```

#### 4.2 SSL Certificate (Automatic)

Railway automatically provisions SSL certificates via Let's Encrypt once DNS propagates.

**Verification**:
- Wait 10-60 minutes for DNS propagation
- Railway will show "SSL Active" in domain settings
- Visit `https://codesalvage.com` to verify

---

## 5. GitHub OAuth App Configuration

### Step 5: Update GitHub OAuth Redirect URLs

**GitHub Settings**: https://github.com/settings/developers

1. Go to your GitHub OAuth App settings
2. Update "Authorization callback URL":
   - Add: `https://codesalvage.com/api/auth/callback/github`
   - Keep existing localhost URL for local development
3. Update "Homepage URL": `https://codesalvage.com`
4. Click "Update application"

---

## 6. Cloudflare R2 CORS Configuration

### Step 6: Configure CORS for Production Domain

**Cloudflare Dashboard**: https://dash.cloudflare.com/

1. Navigate to R2 → Your Bucket
2. Go to "Settings" → "CORS Policy"
3. Add CORS rule:

```json
[
  {
    "AllowedOrigins": [
      "https://codesalvage.com",
      "https://www.codesalvage.com"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 7. SendGrid Email Configuration

### Step 7: Verify SendGrid Domain

**SendGrid Dashboard**: https://app.sendgrid.com/

1. Go to "Settings" → "Sender Authentication"
2. Click "Authenticate Your Domain"
3. Enter: `codesalvage.com`
4. Add DNS records provided by SendGrid to your domain registrar
5. Wait for verification (1-24 hours)
6. Set default "From" email: `noreply@codesalvage.com`

**Verify Environment Variable**:
```bash
SENDGRID_FROM_EMAIL="noreply@codesalvage.com"
```

---

## 8. Cron Job Configuration (Railway)

### Step 8: Setup Scheduled Tasks

**Railway Cron Jobs** (3 jobs):

#### 8.1 Escrow Release (Every 6 hours)

**Cron Expression**: `0 */6 * * *`

**Command**:
```bash
curl -H "Authorization: Bearer ${CRON_SECRET}" https://codesalvage.com/api/cron/release-escrow
```

#### 8.2 Featured Listing Cleanup (Daily at 2 AM)

**Cron Expression**: `0 2 * * *`

**Command**:
```bash
curl -H "Authorization: Bearer ${CRON_SECRET}" https://codesalvage.com/api/cron/cleanup-featured
```

#### 8.3 Featured Expiration Warning (Daily at 10 AM)

**Cron Expression**: `0 10 * * *`

**Command**:
```bash
curl -H "Authorization: Bearer ${CRON_SECRET}" https://codesalvage.com/api/cron/featured-expiration-warning
```

**How to Add Cron Jobs in Railway**:
1. Railway Dashboard → Your Project
2. Click "Add Service" → "Cron Job"
3. Enter cron expression and command
4. Click "Create"

**Alternative**: Use external cron service (cron-job.org, EasyCron, etc.)

---

## 9. Deployment Steps

### Step 9: Deploy to Production

**Method 1: Deploy via Git Push (Recommended)**

```bash
# Ensure you're on main branch
git checkout main

# Ensure all changes committed
git status

# Push to Railway (auto-deploys)
git push origin main
```

Railway will automatically:
1. Detect the push
2. Run `npm run build` (includes Prisma generate)
3. Deploy the standalone Next.js app
4. Run database migrations (if configured)

**Method 2: Deploy via Railway Dashboard**

1. Go to Railway Dashboard → Your Project
2. Click "Deployments" tab
3. Click "Deploy" button
4. Select branch: `main`
5. Click "Deploy Now"

---

## 10. Database Migration (Production)

### Step 10: Run Prisma Migrations

**Option A: Via Railway CLI**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Link project
railway link

# Run migration
railway run npx prisma migrate deploy
```

**Option B: Via Railway Dashboard (One-time command)**

1. Railway Dashboard → Your Project → Service
2. Click "Settings" → "Deploy"
3. Add to "Build Command":
   ```
   npm run build && npx prisma migrate deploy
   ```

---

## 11. Post-Deployment Verification

### Step 11: Smoke Testing Checklist

#### 11.1 Basic Availability ✅
- [ ] Visit `https://codesalvage.com`
- [ ] Verify homepage loads without errors
- [ ] Check browser console for JavaScript errors
- [ ] Verify SSL certificate is valid (green padlock)

#### 11.2 Authentication ✅
- [ ] Click "Sign In" button
- [ ] Sign in with GitHub OAuth
- [ ] Verify redirected back to homepage after login
- [ ] Check user menu displays correctly

#### 11.3 API Endpoints ✅
- [ ] Visit `/api/health` (should return 200 OK)
- [ ] Visit `/api/projects` (should return projects list)
- [ ] Check Honeybadger dashboard for any errors

#### 11.4 Database Connectivity ✅
- [ ] Create a test project (as seller)
- [ ] Verify project appears in database
- [ ] Delete test project

#### 11.5 Redis Connectivity ✅
- [ ] Check rate limiting works (try 10 rapid requests)
- [ ] Verify cached responses (check response headers if implemented)

#### 11.6 Stripe Integration ✅
- [ ] Make a test purchase (use test card: 4242 4242 4242 4242)
- [ ] Verify webhook received (check Stripe Dashboard → Webhooks)
- [ ] Check transaction appears in database

#### 11.7 SendGrid Emails ✅
- [ ] Complete a test purchase
- [ ] Verify buyer receives confirmation email
- [ ] Verify seller receives notification email

#### 11.8 File Uploads (Cloudflare R2) ✅
- [ ] Upload a project screenshot
- [ ] Verify image displays correctly
- [ ] Check R2 bucket for uploaded file

---

## 12. Monitoring Setup (Post-Deployment)

### Step 12: Configure Monitoring and Alerts

#### 12.1 Honeybadger Alerts

**Email Notifications**:
1. Honeybadger Dashboard → Project Settings → Notifications
2. Add your email address
3. Configure alert rules:
   - New error types: Immediate
   - Error rate threshold: 10 errors/hour
   - Critical errors (tagged `severity: critical`): Immediate

**Slack Integration** (Optional):
1. Honeybadger → Integrations → Slack
2. Connect your Slack workspace
3. Choose channel: `#engineering` or `#alerts`
4. Configure notification rules

#### 12.2 Railway Monitoring

**Railway Dashboard**:
1. Go to "Metrics" tab
2. Monitor:
   - CPU usage
   - Memory usage
   - Request count
   - Response time

**Set up alerts** (if available):
- CPU > 80%: Alert
- Memory > 80%: Alert
- Error rate > 5%: Alert

#### 12.3 Uptime Monitoring (Optional)

**Recommended Tools**:
- **UptimeRobot** (Free): https://uptimerobot.com/
- **Pingdom** (Paid): https://www.pingdom.com/
- **StatusCake** (Free tier): https://www.statuscake.com/

**Setup**:
1. Create account
2. Add monitor: `https://codesalvage.com/api/health`
3. Check interval: 5 minutes
4. Alert contacts: Your email

---

## 13. Security Final Checks

### Step 13: Production Security Verification

#### 13.1 HTTPS Enforcement ✅
```bash
# Test HTTP redirects to HTTPS
curl -I http://codesalvage.com
# Should return: 301 Moved Permanently → https://codesalvage.com
```

#### 13.2 Security Headers ✅
```bash
# Check security headers
curl -I https://codesalvage.com | grep -E "(X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security)"
```

**Expected Headers**:
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

#### 13.3 Rate Limiting ✅
```bash
# Test rate limiting
for i in {1..10}; do curl -I https://codesalvage.com/api/projects; done
# Should see: 429 Too Many Requests after 5-10 requests
```

#### 13.4 Environment Variables ✅
- [ ] Verify no secrets in public code (GitHub)
- [ ] Verify `.env` files are in `.gitignore`
- [ ] Verify Railway environment variables are set correctly

---

## 14. Performance Validation

### Step 14: Run Lighthouse Audit

**Chrome DevTools**:
1. Open Chrome DevTools (F12)
2. Navigate to "Lighthouse" tab
3. Select all categories
4. Click "Analyze page load"

**Expected Scores**:
- Performance: > 90 (desktop), > 80 (mobile)
- Accessibility: > 95
- Best Practices: > 95
- SEO: > 90

**Fix Common Issues**:
- Low performance: Check image optimization, JavaScript bundle size
- Low accessibility: Check alt text, ARIA labels, color contrast
- Low SEO: Check meta tags, sitemap, robots.txt

---

## 15. Legal Compliance Final Check

### Step 15: Verify Legal Documents

- [ ] Terms of Service accessible at `/terms`
- [ ] Privacy Policy accessible at `/privacy`
- [ ] Cookie Policy accessible at `/cookies`
- [ ] Links in footer to all legal documents
- [ ] Contact information for GDPR/CCPA requests

---

## 16. Rollback Plan

### Step 16: Prepare Rollback Strategy

**If Something Goes Wrong**:

**Option 1: Revert to Previous Deployment (Railway)**
1. Railway Dashboard → Deployments
2. Find previous successful deployment
3. Click "..." → "Redeploy"

**Option 2: Rollback Git Commit**
```bash
# Find last working commit
git log

# Revert to previous commit
git revert HEAD

# Push to trigger redeploy
git push origin main
```

**Option 3: Rollback Environment Variables**
1. Railway Dashboard → Variables
2. Click on variable
3. View history
4. Revert to previous value

---

## 17. Launch Day Checklist

### Final Pre-Launch Checklist

**24 Hours Before Launch**:
- [ ] All environment variables configured in Railway
- [ ] Honeybadger API key set and tested
- [ ] Custom domain (codesalvage.com) DNS configured
- [ ] SSL certificate active (green padlock)
- [ ] Stripe live mode keys configured
- [ ] Stripe webhooks configured and tested
- [ ] GitHub OAuth callback URLs updated
- [ ] SendGrid domain authenticated
- [ ] Cron jobs configured in Railway
- [ ] Database migrations run successfully
- [ ] All 507 tests passing locally
- [ ] Smoke testing completed (all items ✅)
- [ ] Honeybadger alerts configured
- [ ] Uptime monitoring configured
- [ ] Lighthouse audit > 80 all categories

**Launch Day**:
- [ ] Deploy to production (git push)
- [ ] Verify homepage loads
- [ ] Test authentication flow
- [ ] Make a test purchase (real payment, then refund)
- [ ] Monitor Honeybadger for first 1 hour
- [ ] Check Railway metrics (CPU, memory)
- [ ] Announce launch (ProductHunt, social media)

**First Week**:
- [ ] Monitor Honeybadger daily
- [ ] Check Railway resource usage
- [ ] Review user feedback
- [ ] Fix any critical bugs immediately
- [ ] Run `npm audit` and fix vulnerabilities

---

## 18. Support and Escalation

### Contact Information

**Critical Issues** (Production Down):
1. Check Railway status: https://status.railway.app/
2. Check Honeybadger dashboard for errors
3. Check Railway logs: Dashboard → Logs

**Stripe Issues**:
- Stripe Support: https://support.stripe.com/

**Honeybadger Issues**:
- Honeybadger Support: support@honeybadger.io

**Domain/DNS Issues**:
- Your domain registrar support

---

## 19. Post-Launch Optimization

### Week 1-2 Optimizations

**Monitor and Optimize**:
1. Review Honeybadger error frequency
2. Optimize slow API endpoints (> 1s response time)
3. Review Redis cache hit rates
4. Optimize database queries (if slow query logs available)
5. Review Lighthouse recommendations
6. Implement user feedback

---

## Summary: Quick Start Guide

### Fastest Path to Production (2-3 hours)

1. **Honeybadger** (10 min):
   - Copy API key from dashboard
   - Add to Railway environment variables

2. **Railway Environment Variables** (20 min):
   - Set all variables listed in Section 2
   - Verify DATABASE_URL and REDIS_URL exist
   - Update NODE_ENV=production
   - Update NEXT_PUBLIC_APP_URL=https://codesalvage.com

3. **Stripe Live Mode** (30 min):
   - Toggle to live mode in Stripe Dashboard
   - Copy live API keys (sk_live_, pk_live_)
   - Add to Railway environment variables
   - Create webhook endpoint
   - Copy webhook secret (whsec_)
   - Add to Railway environment variables

4. **Custom Domain** (30 min + DNS propagation time):
   - Add domain in Railway Dashboard
   - Copy DNS records
   - Add DNS records at domain registrar
   - Wait for DNS propagation (10-60 min)

5. **GitHub OAuth** (5 min):
   - Update callback URL in GitHub OAuth app settings

6. **Deploy** (10 min):
   ```bash
   git push origin main
   ```

7. **Smoke Testing** (30 min):
   - Visit https://codesalvage.com
   - Sign in with GitHub
   - Make test purchase
   - Verify emails sent
   - Check Honeybadger dashboard

8. **Cron Jobs** (15 min):
   - Configure 3 cron jobs in Railway or external service

9. **Monitoring** (15 min):
   - Configure Honeybadger alerts
   - Setup uptime monitoring (UptimeRobot)

10. **Final Checks** (10 min):
    - Run Lighthouse audit
    - Verify all legal documents accessible
    - Test rate limiting

**Total Time**: ~2-3 hours (excluding DNS propagation)

---

**Deployment Status**: ⏹️ AWAITING CONFIGURATION

**Next Action**: Configure Railway environment variables (Section 2)

**Questions?** Refer to specific sections above or ask for clarification.
