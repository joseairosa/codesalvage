# Production Deployment Workflow - Quick Reference

**CodeSalvage Production Deployment**

This is a quick reference guide. For detailed instructions, see [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md).

---

## Pre-Deployment Checklist (30 minutes)

### 1. Validate Environment Variables

```bash
npm run validate:env
```

**Expected**: All required variables present, no critical warnings

**If failures**: Set missing environment variables in Railway

### 2. Run All Tests

```bash
npm test

# Expected: ✓ 507 passed
```

### 3. Run Linting & Type Checking

```bash
npm run lint
npx tsc --noEmit

# Expected: No errors
```

### 4. Build Verification

```bash
npm run build

# Expected: Successful build, no errors
```

### 5. Review Changes

```bash
git status
git log -5

# Expected: All changes committed, clean working directory
```

---

## Deployment Steps (1-2 hours)

### 1. Configure Honeybadger

- [ ] Copy API key from dashboard: https://app.honeybadger.io/
- [ ] Set in Railway: `HONEYBADGER_API_KEY` and `NEXT_PUBLIC_HONEYBADGER_API_KEY`

### 2. Configure Railway Environment Variables

See [PRODUCTION_DEPLOYMENT.md Section 2](PRODUCTION_DEPLOYMENT.md#2-railway-environment-variables) for complete list (30+ variables)

**Critical variables**:

- `DATABASE_URL` - Already set by Railway Postgres
- `REDIS_URL` - Already set by Railway Redis
- `AUTH_SECRET` - Generate: `openssl rand -base64 32`
- `STRIPE_SECRET_KEY` - Use `sk_live_...` (NOT test mode)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Use `pk_live_...`
- `CRON_SECRET` - Generate random secret

### 3. Configure Custom Domain

```bash
# In Railway dashboard:
# Settings → Domains → Add Custom Domain
# Enter: codesalvage.com

# Update DNS records (at your registrar):
# Type: CNAME
# Name: @
# Value: [Railway provides this, e.g., codesalvage-production.up.railway.app]
# TTL: Auto or 3600

# Wait for DNS propagation (5-60 minutes)
```

**Check DNS propagation**:

```bash
dig codesalvage.com
# Should resolve to Railway's IP
```

### 4. Switch Stripe to Live Mode

- [ ] Stripe Dashboard → Developers → API keys
- [ ] Copy "Secret key" (starts with `sk_live_...`)
- [ ] Copy "Publishable key" (starts with `pk_live_...`)
- [ ] Set in Railway environment variables
- [ ] Configure webhook endpoint: `https://codesalvage.com/api/webhooks/stripe`
- [ ] Copy webhook signing secret (`whsec_...`)
- [ ] Set `STRIPE_WEBHOOK_SECRET` in Railway

### 5. Update GitHub OAuth App

- [ ] GitHub → Settings → Developer settings → OAuth Apps
- [ ] Update "Homepage URL": `https://codesalvage.com`
- [ ] Update "Authorization callback URL": `https://codesalvage.com/api/auth/callback/github`

### 6. Configure SendGrid Domain Authentication

See [PRODUCTION_DEPLOYMENT.md Section 7](PRODUCTION_DEPLOYMENT.md#7-sendgrid-email-configuration)

### 7. Setup Railway Cron Jobs

See [PRODUCTION_DEPLOYMENT.md Section 8](PRODUCTION_DEPLOYMENT.md#8-cron-job-configuration)

**3 cron jobs to configure**:

1. **Escrow Release** - Every 6 hours
2. **Featured Cleanup** - Every 1 hour
3. **Expiration Warnings** - Every 12 hours

### 8. Deploy to Railway

```bash
# Railway will auto-deploy on git push to main branch
git push origin main

# OR deploy manually via Railway CLI:
railway up
```

**Monitor deployment**:

```bash
railway logs
# Watch for errors during deployment
```

### 9. Run Database Migrations

```bash
# After deployment succeeds:
railway run npm run db:migrate:deploy

# Expected: Migrations applied successfully
```

---

## Post-Deployment Verification (15 minutes)

### 1. Run Automated Health Check

```bash
bash scripts/post-deployment-check.sh https://codesalvage.com YOUR_CRON_SECRET

# Expected: ✅ All checks passed!
```

### 2. Detailed Health Check

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://codesalvage.com/api/health?detailed=true" | jq

# Expected: All services "healthy"
```

### 3. Quick Manual Verification

1. **Homepage**: https://codesalvage.com - Loads correctly
2. **Login**: GitHub OAuth flow works
3. **Browse Projects**: `/projects` page loads
4. **Health Check**: `/api/health` returns 200

### 4. Monitor Dashboards

- [ ] **Honeybadger**: No critical errors
- [ ] **Railway**: CPU, memory within normal range
- [ ] **Stripe**: Webhook endpoint reachable
- [ ] **SendGrid**: Email service active

---

## Smoke Testing (30-45 minutes)

Follow [tests/SMOKE_TESTING_CHECKLIST.md](tests/SMOKE_TESTING_CHECKLIST.md)

**Critical tests** (run these first):

1. ✅ Authentication Flow (GitHub OAuth)
2. ✅ Project Browsing
3. ✅ Payment Flow (use test card: `4242 4242 4242 4242`)
4. ✅ Email Notifications
5. ✅ Code Delivery

**If critical tests fail**: STOP and investigate before continuing.

---

## Extended Testing (2-4 hours, within 24 hours)

### Load Testing

```bash
cd tests/load-testing

# Install k6 if not already installed
brew install k6  # macOS

# Run load tests
k6 run homepage-load-test.js
k6 run search-api-load-test.js
k6 run payment-flow-load-test.js
k6 run spike-test.js
```

**Expected**: All tests pass performance thresholds

### Cross-Browser Testing

Follow [tests/CROSS_BROWSER_MOBILE_TESTING.md](tests/CROSS_BROWSER_MOBILE_TESTING.md)

**Priority browsers**:

1. Chrome Desktop
2. Safari Desktop
3. Mobile Safari (iPhone)
4. Mobile Chrome (Android)

### Performance Audit

```bash
# Run Lighthouse in Chrome DevTools
# Expected scores: Performance ≥85, Accessibility ≥90, Best Practices ≥90, SEO ≥90
```

---

## Rollback Plan (if issues occur)

### If deployment fails or critical issues found:

1. **Immediate Rollback**

   ```bash
   # In Railway dashboard:
   # Deployments → Click previous successful deployment → Redeploy
   ```

2. **Investigate Issues**

   ```bash
   railway logs
   # Check Honeybadger for errors
   # Check Railway metrics
   ```

3. **Fix and Redeploy**
   ```bash
   # Fix issues locally
   npm test  # Verify tests pass
   git commit -m "Fix: [description]"
   git push origin main
   ```

---

## Monitoring (First 24-48 Hours)

### Every 2 Hours:

- [ ] Check **Honeybadger** for errors
- [ ] Check **Railway metrics** (CPU, memory, database)
- [ ] Check **Stripe Dashboard** (payment success rate)
- [ ] Check **SendGrid Activity** (email deliveries)

### Daily (First Week):

- [ ] Review error trends in Honeybadger
- [ ] Check Redis cache hit rate
- [ ] Monitor database performance
- [ ] Review user feedback/support tickets

---

## Quick Commands Reference

```bash
# Pre-deployment
npm run validate:env          # Validate environment variables
npm test                      # Run all tests
npm run lint                  # Run linting
npx tsc --noEmit             # Type checking
npm run build                # Build verification

# Deployment
railway logs                  # View deployment logs
railway run npm run db:migrate:deploy  # Run migrations

# Post-deployment
bash scripts/post-deployment-check.sh https://codesalvage.com CRON_SECRET
curl https://codesalvage.com/api/health  # Basic health check

# Load testing
cd tests/load-testing
k6 run homepage-load-test.js

# Monitoring
railway logs -f               # Follow logs in real-time
```

---

## Success Criteria

**Deployment is successful when**:

- ✅ All health checks pass
- ✅ Smoke tests complete without critical errors
- ✅ No errors in Honeybadger
- ✅ Railway metrics normal
- ✅ Stripe webhooks delivering
- ✅ Emails sending via SendGrid
- ✅ DNS resolving correctly
- ✅ HTTPS certificate valid

**Ready to announce launch** when:

- ✅ Smoke tests pass
- ✅ Load tests pass
- ✅ Cross-browser tests pass
- ✅ Performance scores meet targets
- ✅ Monitoring for 24 hours shows stability

---

## Support & Troubleshooting

### Common Issues

**Issue**: Database connection errors
**Solution**: Check `DATABASE_URL` in Railway, verify Postgres service running

**Issue**: Redis connection errors
**Solution**: Check `REDIS_URL` in Railway, verify Redis service running

**Issue**: Stripe webhook failures
**Solution**: Verify webhook URL and signing secret, check Stripe Dashboard → Webhooks

**Issue**: Email not sending
**Solution**: Check SendGrid API key, verify domain authentication, check SendGrid Activity

**Issue**: GitHub OAuth fails
**Solution**: Verify callback URL is `https://codesalvage.com/api/auth/callback/github`

**Issue**: Rate limiting too aggressive
**Solution**: Check Redis, adjust rate limit thresholds if needed

---

## Documentation Links

- **Full Deployment Guide**: [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)
- **Security Audit**: [SECURITY_AUDIT.md](SECURITY_AUDIT.md)
- **Performance Optimization**: [PERFORMANCE_OPTIMIZATION.md](PERFORMANCE_OPTIMIZATION.md)
- **Smoke Testing**: [tests/SMOKE_TESTING_CHECKLIST.md](tests/SMOKE_TESTING_CHECKLIST.md)
- **Cross-Browser Testing**: [tests/CROSS_BROWSER_MOBILE_TESTING.md](tests/CROSS_BROWSER_MOBILE_TESTING.md)
- **Load Testing**: [tests/load-testing/README.md](tests/load-testing/README.md)
- **Testing Quick Start**: [tests/TESTING_QUICK_START.md](tests/TESTING_QUICK_START.md)

---

**Estimated Total Time**: 4-6 hours (including DNS propagation wait time)

**Good luck with your launch!** 🚀
