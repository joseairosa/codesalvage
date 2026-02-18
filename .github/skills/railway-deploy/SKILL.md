---
name: railway-deploy
description: |
  Railway production deployment workflow for CodeSalvage. Use when: (1) user
  asks to deploy to production/Railway, (2) deploying updates after feature
  completion, (3) initial production launch. Multi-step process: pre-deployment
  validation → environment configuration → deploy → migrations → health checks.
author: Claude Code
version: 1.0.0
---

# Railway Production Deployment

## Problem

Deploying to Railway requires coordinating multiple steps: environment variables, database migrations, health checks, and external service configuration (Stripe, SendGrid, GitHub OAuth). Missing any step can cause production failures.

## Trigger Conditions

Use this skill when:

- User asks to "deploy to production" or "deploy to Railway"
- Completing a feature and ready for production release
- Initial production launch setup
- Updating production after bug fixes

## Workflow

### Phase 1: Pre-Deployment Validation (30 min)

**Run locally before deploying:**

```bash
# 1. Validate environment variables
npm run validate:env

# 2. Run all tests
npm test
# Expected: ✓ 507 passed

# 3. Lint and type-check
npm run lint
npx tsc --noEmit

# 4. Build verification
npm run build

# 5. Verify clean working directory
git status
git log -5
```

**Stop if any validation fails. Fix issues before proceeding.**

### Phase 2: Railway Configuration

**Critical environment variables to set in Railway dashboard:**

| Variable                             | Source                       | Example       |
| ------------------------------------ | ---------------------------- | ------------- |
| `DATABASE_URL`                       | Auto-set by Railway Postgres | -             |
| `REDIS_URL`                          | Auto-set by Railway Redis    | -             |
| `AUTH_SECRET`                        | `openssl rand -base64 32`    | -             |
| `STRIPE_SECRET_KEY`                  | Stripe Dashboard (live mode) | `sk_live_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard             | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET`              | Stripe webhook config        | `whsec_...`   |
| `CRON_SECRET`                        | Generate random              | -             |
| `HONEYBADGER_API_KEY`                | Honeybadger dashboard        | -             |

**See PRODUCTION_DEPLOYMENT.md for full list (30+ variables).**

**External service updates:**

- Stripe: Configure webhook `https://codesalvage.com/api/webhooks/stripe`
- GitHub OAuth: Update callback URL to production domain
- Configure custom domain in Railway → Settings → Domains

### Phase 3: Deploy

```bash
# Auto-deploy on push to main
git push origin main

# OR manual deploy via Railway CLI
railway up

# Monitor deployment
railway logs
```

### Phase 4: Database Migrations

```bash
# CRITICAL: Run after deployment succeeds
railway run npm run db:migrate:deploy
```

### Phase 5: Post-Deployment Verification (15 min)

```bash
# 1. Automated health check
bash scripts/post-deployment-check.sh https://codesalvage.com YOUR_CRON_SECRET

# 2. Detailed health check
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://codesalvage.com/api/health?detailed=true" | jq

# 3. Manual checks
# - Homepage loads: https://codesalvage.com
# - GitHub OAuth login works
# - Browse projects: /projects
# - Health endpoint: /api/health returns 200
```

### Phase 6: Monitoring (First 24-48 Hours)

**Check every 2 hours:**

- Honeybadger (no critical errors)
- Railway metrics (CPU, memory normal)
- Stripe Dashboard (webhooks delivering)
- SendGrid Activity (emails sending)

## Success Criteria

Deployment successful when:

- ✅ All health checks pass
- ✅ No errors in Honeybadger
- ✅ Railway metrics normal
- ✅ Stripe webhooks delivering
- ✅ DNS resolving correctly
- ✅ HTTPS certificate valid

## Rollback Plan

If critical issues found:

```bash
# In Railway dashboard:
# Deployments → Click previous successful deployment → Redeploy
```

Then investigate with `railway logs` and Honeybadger.

## Common Issues

| Symptom                    | Fix                                                                     |
| -------------------------- | ----------------------------------------------------------------------- |
| Database connection errors | Check `DATABASE_URL`, verify Postgres running                           |
| Redis connection errors    | Check `REDIS_URL`, verify Redis running                                 |
| Stripe webhook failures    | Verify webhook URL and signing secret in Stripe Dashboard               |
| Email not sending          | Check SendGrid API key, verify domain authentication                    |
| GitHub OAuth fails         | Verify callback URL: `https://codesalvage.com/api/auth/callback/github` |

## References

- Full guide: `DEPLOYMENT_WORKFLOW.md`
- Detailed deployment: `PRODUCTION_DEPLOYMENT.md`
- Smoke testing: `tests/SMOKE_TESTING_CHECKLIST.md`
- Load testing: `tests/load-testing/README.md`

## Example

**Typical deployment session:**

```bash
# Local validation
npm run validate:env && npm test && npm run lint && npm run build

# Deploy
git push origin main

# Monitor
railway logs

# Migrate
railway run npm run db:migrate:deploy

# Verify
bash scripts/post-deployment-check.sh https://codesalvage.com $CRON_SECRET

# Success! Monitor Honeybadger and Railway metrics
```
