# Testing Quick Start Guide - CodeSalvage

**Complete Testing Workflow for Production Launch**

This guide walks you through the complete testing process before and after deploying to production.

---

## Overview

The testing process has 4 phases:

1. **Pre-Deployment Tests** (Run before deploying)
2. **Deployment** (Deploy to production)
3. **Post-Deployment Smoke Tests** (Critical verification)
4. **Extended Testing** (Load testing, cross-browser, mobile)

**Total Time**: ~4-6 hours

---

## Phase 1: Pre-Deployment Tests ✅

### Run All Unit & Integration Tests
```bash
# From project root
npm test

# Expected: All 507 tests passing
# ✓ 507 passed
```

### Check Test Coverage
```bash
npm test -- --coverage

# Expected: > 85% coverage
# Statements: 86.92%
# Branches: 85%+
# Functions: 85%+
# Lines: 86%+
```

### Run Linting
```bash
npm run lint

# Expected: No errors
# If errors, run: npm run lint:fix
```

### TypeScript Type Checking
```bash
npx tsc --noEmit

# Expected: No type errors
```

### Build Verification
```bash
npm run build

# Expected: Successful build
# Check for:
# - No build errors
# - Bundle size warnings
# - Route compilation success
```

---

## Phase 2: Deployment 🚀

Follow the [PRODUCTION_DEPLOYMENT.md](../PRODUCTION_DEPLOYMENT.md) checklist:

1. Configure Honeybadger API keys
2. Set Railway environment variables (30+ vars)
3. Configure DNS for codesalvage.com
4. Switch Stripe to live mode
5. Deploy to Railway
6. Run database migrations

**Deployment Time**: ~2-3 hours

---

## Phase 3: Post-Deployment Smoke Tests ✅ **CRITICAL**

**Run this immediately after deployment (within 15 minutes)**

### Quick Smoke Test (10 minutes)
Essential checks to verify production is functional:

1. **Homepage loads** - https://codesalvage.com
2. **Login works** - GitHub OAuth flow
3. **Browse projects** - /projects page loads
4. **View project detail** - Click a project
5. **Seller dashboard** - Create test project
6. **Payment flow** - Complete test purchase
7. **Check Honeybadger** - No critical errors
8. **Check Railway logs** - No anomalies
9. **Check Stripe Dashboard** - Payment recorded
10. **Check SendGrid** - Emails sent

**If any of these fail, STOP and investigate before continuing.**

### Full Smoke Test (30-45 minutes)
Complete checklist in [SMOKE_TESTING_CHECKLIST.md](./SMOKE_TESTING_CHECKLIST.md)

**Sections**:
1. Authentication Flow
2. Homepage & Navigation
3. Project Browsing & Search
4. Seller Flow
5. Purchase Flow (CRITICAL)
6. Messaging System
7. Reviews & Ratings
8. Featured Listings
9. Subscription Plans
10. API Rate Limiting
11. Error Monitoring
12. Performance Validation
13. Security Validation
14. Legal & Compliance

**Expected Result**: All checks pass ✅

---

## Phase 4: Extended Testing (2-4 hours)

### 4.1 Load Testing (1-2 hours)

**Prerequisites**:
```bash
# Install k6
brew install k6  # macOS
# OR
choco install k6  # Windows
```

**Run Load Tests**:
```bash
cd tests/load-testing

# 1. Homepage Load Test (8 minutes)
k6 run homepage-load-test.js

# Expected:
# - P95 response time < 2s
# - Error rate < 1%
# - 100 concurrent users handled

# 2. Search API Load Test (4 minutes)
k6 run search-api-load-test.js

# Expected:
# - P95 response time < 500ms
# - Error rate < 1%
# - 50 concurrent users handled

# 3. Payment Flow Load Test (3 minutes)
TEST_AUTH_TOKEN=your-token k6 run payment-flow-load-test.js

# Expected:
# - P95 response time < 3s
# - Payment intent success rate > 99%
# - 20 concurrent authenticated users handled

# 4. Spike Test (3 minutes)
k6 run spike-test.js

# Expected:
# - System recovers from 200-user spike
# - Error rate < 5%
# - Rate limiting engages appropriately
```

**Monitor During Load Tests**:
- **Honeybadger**: Watch for error spikes
- **Railway Metrics**: CPU, memory, database connections
- **Redis Metrics**: Cache hit rate, memory usage
- **Stripe Dashboard**: Payment success rate

**If load tests fail**:
1. Check Railway resource limits
2. Check database connection pool
3. Check Redis memory
4. Optimize slow queries
5. Adjust rate limits if needed

### 4.2 Cross-Browser Testing (1 hour)

Follow [CROSS_BROWSER_MOBILE_TESTING.md](./CROSS_BROWSER_MOBILE_TESTING.md)

**Priority 1 Browsers** (30 minutes):
1. Chrome Desktop (latest)
2. Safari Desktop (latest)
3. Mobile Safari (iPhone)
4. Mobile Chrome (Android)

**Test each browser**:
- [ ] Homepage renders correctly
- [ ] Navigation works
- [ ] Forms functional
- [ ] Payment flow works
- [ ] No console errors

**Priority 2 Browsers** (20 minutes):
5. Firefox Desktop
6. Edge Desktop
7. Samsung Internet

**Priority 3** (10 minutes):
8. iPad testing (portrait & landscape)
9. Accessibility (keyboard navigation, screen reader basics)

**Use BrowserStack or LambdaTest** for browsers/devices you don't have access to.

### 4.3 Mobile Responsive Testing (30 minutes)

**Screen Sizes to Test**:
- iPhone SE (375px)
- iPhone 14 (390px)
- iPhone 14 Pro Max (430px)
- iPad Mini (768px)
- iPad Pro (1024px)

**Using Chrome DevTools Device Mode**:
1. Open Chrome DevTools (F12)
2. Click "Toggle Device Toolbar" (Cmd+Shift+M)
3. Select device from dropdown
4. Test:
   - [ ] Layout responsive
   - [ ] Navigation (hamburger menu)
   - [ ] Forms usable
   - [ ] Payment flow works
   - [ ] Touch targets large enough
   - [ ] No horizontal scroll

### 4.4 Performance Validation (15 minutes)

**Run Lighthouse Audit**:
1. Open Chrome DevTools (F12)
2. Go to "Lighthouse" tab
3. Select all categories
4. Click "Generate report"

**Expected Scores**:
- Performance: ≥ 85
- Accessibility: ≥ 90
- Best Practices: ≥ 90
- SEO: ≥ 90

**Test Multiple Pages**:
- Homepage: https://codesalvage.com
- Project List: https://codesalvage.com/projects
- Project Detail: https://codesalvage.com/projects/[id]

**If scores are low**:
- Check "Opportunities" section for recommendations
- Optimize images (WebP, AVIF)
- Reduce JavaScript bundle size
- Enable caching headers

---

## Testing Checklist Summary

### Before Deployment
- [x] 507 tests passing
- [x] Test coverage > 85%
- [x] No lint errors
- [x] No TypeScript errors
- [x] Build successful

### After Deployment (Immediate)
- [ ] Quick smoke test (10 min)
- [ ] Full smoke test (45 min)
- [ ] Check monitoring dashboards

### Extended Testing (Within 24 hours)
- [ ] Load testing (1-2 hours)
- [ ] Cross-browser testing (1 hour)
- [ ] Mobile testing (30 min)
- [ ] Performance audit (15 min)

### Post-Launch Monitoring (First Week)
- [ ] Monitor Honeybadger daily
- [ ] Check Railway metrics daily
- [ ] Review Stripe transactions daily
- [ ] Monitor Redis cache performance
- [ ] Check for user-reported issues

---

## Issue Response Protocol

### Critical Issues (Site Down, Payments Failing)
1. **Immediate**: Roll back deployment
2. **Investigate**: Check Honeybadger, Railway logs
3. **Fix**: Apply hotfix
4. **Deploy**: Redeploy with fix
5. **Re-test**: Run smoke tests again

### High Priority Issues (Major Feature Broken)
1. **Document**: Create GitHub issue
2. **Prioritize**: Add to sprint backlog
3. **Fix**: Within 24 hours
4. **Deploy**: Hotfix deployment
5. **Verify**: Re-test affected feature

### Medium/Low Priority Issues
1. **Document**: Create GitHub issue
2. **Prioritize**: Add to next sprint
3. **Fix**: Normal development cycle
4. **Deploy**: Next release

---

## Monitoring Dashboards

### Production Monitoring (Check Daily)
- **Honeybadger**: https://app.honeybadger.io/
  - Errors, warnings, alerts
  - Response times
  - User context
- **Railway**: https://railway.app/dashboard
  - CPU, memory, disk usage
  - Database connections
  - Deployment logs
- **Stripe**: https://dashboard.stripe.com/
  - Payment success rate
  - Failed payments
  - Webhook deliveries
- **SendGrid**: https://app.sendgrid.com/
  - Email deliveries
  - Bounces, spam reports
  - Engagement metrics

---

## Testing Best Practices

1. **Test in Production-like Environment**: Staging should mirror production
2. **Use Real Devices**: Mobile testing on real devices > emulators
3. **Test with Real Data**: Use production-like data volumes
4. **Monitor During Tests**: Watch dashboards in real-time
5. **Document Everything**: Record results, issues, and resolutions
6. **Clean Up Test Data**: Delete test projects, transactions, subscriptions
7. **Run Regression Tests**: After every fix, re-test affected areas
8. **Automate Where Possible**: CI/CD for unit/integration tests

---

## Success Criteria

**Ready for Launch when**:
- ✅ All 507 tests passing
- ✅ Smoke tests pass (all critical features work)
- ✅ Load tests pass (performance under load acceptable)
- ✅ Cross-browser tests pass (works in all major browsers)
- ✅ Mobile tests pass (responsive and functional)
- ✅ Performance scores ≥ 85 (Lighthouse)
- ✅ No critical errors in Honeybadger
- ✅ Monitoring dashboards configured
- ✅ Rollback plan documented

**Launch with Confidence** 🚀

---

## Quick Commands Reference

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run linting
npm run lint

# Run TypeScript check
npx tsc --noEmit

# Build for production
npm run build

# Load testing
cd tests/load-testing
k6 run homepage-load-test.js
k6 run search-api-load-test.js
k6 run payment-flow-load-test.js
k6 run spike-test.js

# Check Railway logs
# (in Railway dashboard or CLI)
railway logs

# Check database
npx prisma studio
```

---

**Testing Complete** ✅

**Next Step**: Monitor production for first 24-48 hours, address any issues promptly.

**Good luck with your launch!** 🎉
