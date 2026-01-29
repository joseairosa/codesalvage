# 🚀 Deployment Checklist - Railway Staging

This checklist guides you through deploying CodeSalvage to Railway staging environment.

---

## Prerequisites ✅

Before deploying, ensure you have:

- [ ] Railway account created at [railway.app](https://railway.app)
- [ ] Railway CLI installed (`npm install -g @railway/cli`)
- [ ] GitHub OAuth app created for production
- [ ] All environment variables documented
- [ ] Database migrations tested locally
- [ ] All CI checks passing on main branch

---

## Part 1: Railway Project Setup

### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
```

Verify installation:

```bash
railway --version
```

### Step 2: Login to Railway

```bash
railway login
```

This opens a browser window for authentication.

### Step 3: Create Railway Project

```bash
# From project root
cd /Users/joseairosa/Development/recycleai

# Initialize Railway project
railway init

# Project name: codesalvage-staging
# Select: Create a new project
```

### Step 4: Add PostgreSQL Plugin

```bash
railway add --plugin postgresql
```

Wait for provisioning (~1-2 minutes).

### Step 5: Add Redis Plugin

```bash
railway add --plugin redis
```

Wait for provisioning (~1-2 minutes).

### Step 6: Link Project

```bash
railway link
```

Select the `codesalvage-staging` project you just created.

---

## Part 2: Environment Variables

### Step 1: Generate AUTH_SECRET

```bash
openssl rand -base64 32
```

Copy the output (e.g., `xyz123abc456...`)

### Step 2: Create GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click **New OAuth App**
3. Fill in:
   - **Application name:** CodeSalvage Staging
   - **Homepage URL:** (Railway will provide this after first deployment)
   - **Authorization callback URL:** `https://your-app.railway.app/api/auth/callback/github`
4. Click **Register application**
5. Copy **Client ID** and **Client Secret**

**Note:** You'll need to update the callback URL after first deployment with the actual Railway domain.

### Step 3: Set Environment Variables

```bash
# Set AUTH_SECRET (replace with value from Step 1)
railway variables set AUTH_SECRET="your-generated-secret-here"

# Set GitHub OAuth credentials (replace with values from Step 2)
railway variables set AUTH_GITHUB_ID="your-github-client-id"
railway variables set AUTH_GITHUB_SECRET="your-github-client-secret"

# Set Node environment
railway variables set NODE_ENV="production"

# Note: DATABASE_URL and REDIS_URL are set automatically by Railway plugins
```

### Step 4: Verify Variables

```bash
railway variables
```

You should see:

- `AUTH_SECRET` ✅
- `AUTH_GITHUB_ID` ✅
- `AUTH_GITHUB_SECRET` ✅
- `NODE_ENV` ✅
- `DATABASE_URL` ✅ (auto-set)
- `REDIS_URL` ✅ (auto-set)

---

## Part 3: First Deployment

### Step 1: Deploy Application

```bash
railway up
```

This will:

1. Build the application
2. Push to Railway
3. Start the deployment

**Expected output:**

```
Building...
Deploying...
Deployment successful!
Your app is live at: https://codesalvage-staging-production-xxxx.up.railway.app
```

### Step 2: Update NEXTAUTH_URL

After first deployment, you'll get a Railway domain. Update environment variables:

```bash
# Replace with your actual Railway domain
railway variables set NEXTAUTH_URL="https://codesalvage-staging-production-xxxx.up.railway.app"
railway variables set NEXT_PUBLIC_APP_URL="https://codesalvage-staging-production-xxxx.up.railway.app"
```

### Step 3: Update GitHub OAuth Callback URL

1. Go back to GitHub OAuth app settings
2. Update **Authorization callback URL** to: `https://your-actual-railway-domain.up.railway.app/api/auth/callback/github`
3. Click **Update application**

### Step 4: Redeploy with Updated Variables

```bash
railway up
```

### Step 5: Run Database Migrations

```bash
railway run npm run db:migrate:deploy
```

**Expected output:**

```
Prisma Migrate applied 1 migration:
  └─ 20240124_init

✨ Done in 5.23s
```

### Step 6: (Optional) Seed Database

For staging environment with test data:

```bash
railway run npm run db:seed
```

---

## Part 4: Verification

### Manual Verification

1. **Open Application:**

   ```bash
   railway open
   ```

2. **Check Homepage:**
   - [ ] Homepage loads without errors
   - [ ] Navigation renders correctly
   - [ ] Footer displays
   - [ ] Hero section visible

3. **Test GitHub OAuth:**
   - [ ] Click "Get Started" or "Sign In"
   - [ ] Redirects to GitHub OAuth
   - [ ] Authorize app
   - [ ] Redirects back to application
   - [ ] User is authenticated (avatar in nav)

4. **Test Protected Routes:**
   - [ ] Navigate to `/dashboard`
   - [ ] Dashboard displays user info
   - [ ] Navigate to `/seller/dashboard` (should redirect if not seller)

5. **Test Database:**
   - [ ] User record created in database
   - [ ] Check Railway logs: `railway logs`
   - [ ] No database connection errors

6. **Test Redis:**
   - [ ] No Redis connection errors in logs

### Automated Verification

Run the verification script:

```bash
# From local machine
npm run verify:deployment
```

See [scripts/verify-deployment.sh](#) for details.

### Check Deployment Logs

```bash
# View live logs
railway logs --tail

# View recent logs
railway logs --lines 100
```

**Look for:**

- ✅ "Server listening on port 3000"
- ✅ "Prisma Client initialized"
- ✅ "Redis connected"
- ❌ No error stack traces
- ❌ No database connection errors

---

## Part 5: CI/CD Integration

### Step 1: Get Railway Token

1. Go to Railway Dashboard → Account Settings → Tokens
2. Click **Create Token**
3. Name: `GitHub Actions Deploy`
4. Copy the token (starts with `railway_...`)

### Step 2: Add GitHub Secret

1. Go to GitHub repository → Settings → Secrets and variables → Actions
2. Click **New repository secret**
3. Name: `RAILWAY_TOKEN`
4. Value: Paste the Railway token
5. Click **Add secret**

### Step 3: Test Automated Deployment

1. Make a small change to the code (e.g., update README)
2. Commit and push to `main` branch
3. Go to GitHub → Actions tab
4. Watch **Deploy to Railway** workflow run
5. Verify deployment succeeds

---

## Part 6: Custom Domain (Optional)

### Step 1: Add Custom Domain in Railway

1. Go to Railway Dashboard → Your Project → Settings
2. Scroll to **Domains**
3. Click **Generate Domain** (gets a railway.app subdomain)
4. Or click **Custom Domain** to add your own

### Step 2: Configure DNS

For custom domain (e.g., `staging.codesalvage.com`):

1. Add CNAME record in your DNS provider:
   - Name: `staging`
   - Value: `your-app.railway.app`
   - TTL: 300

2. Wait for DNS propagation (~5-30 minutes)

### Step 3: Update Environment Variables

```bash
railway variables set NEXTAUTH_URL="https://staging.codesalvage.com"
railway variables set NEXT_PUBLIC_APP_URL="https://staging.codesalvage.com"
```

### Step 4: Update GitHub OAuth

Update callback URL in GitHub OAuth app to use custom domain.

---

## Part 7: Monitoring & Maintenance

### View Deployment Status

```bash
railway status
```

### View Resource Usage

```bash
# Check database size
railway run npx prisma db execute --stdin < "SELECT pg_size_pretty(pg_database_size('railway'))"

# Check Redis memory
railway run redis-cli INFO memory
```

### View Metrics in Dashboard

1. Go to Railway Dashboard → Your Project
2. Click **Metrics** tab
3. View:
   - CPU usage
   - Memory usage
   - Network traffic
   - Request count

### Setup Alerts (Recommended)

1. Railway Dashboard → Project Settings → Notifications
2. Add email/Slack webhook for alerts
3. Configure thresholds:
   - High memory usage (>80%)
   - High CPU usage (>80%)
   - Deployment failures

---

## Troubleshooting

### Issue 1: "Build Failed" Error

**Check:**

```bash
railway logs
```

**Common causes:**

- Missing environment variables
- TypeScript errors
- Prisma generation failed

**Fix:**

```bash
# Ensure all env vars are set
railway variables

# Verify build works locally
npm run build
```

### Issue 2: Database Connection Error

**Symptoms:**

```
Error: P1001: Can't reach database server
```

**Check:**

```bash
railway variables | grep DATABASE_URL
```

**Fix:**

- DATABASE_URL should be set automatically by Railway PostgreSQL plugin
- If missing, go to Railway Dashboard → Plugins → PostgreSQL → Connect → Copy `DATABASE_URL`
- Set manually: `railway variables set DATABASE_URL="postgresql://..."`

### Issue 3: GitHub OAuth Fails

**Symptoms:**

- Redirects to GitHub but then errors
- "Redirect URI mismatch" error

**Fix:**

1. Verify `NEXTAUTH_URL` matches your Railway domain exactly
2. Verify GitHub OAuth callback URL matches `NEXTAUTH_URL/api/auth/callback/github`
3. No trailing slashes in URLs

### Issue 4: Redis Connection Error

**Symptoms:**

```
Error: Redis connection failed
```

**Fix:**

```bash
# Verify Redis plugin is added
railway plugins

# If missing, add it
railway add --plugin redis
```

### Issue 5: 503 Service Unavailable

**Symptoms:**

- App deployed but returns 503

**Check:**

```bash
railway logs --tail
```

**Common causes:**

- App crashed on startup
- PORT environment variable mismatch (Railway sets this automatically)
- Uncaught exceptions in server initialization

---

## Rollback Procedure

If deployment has critical issues:

### Option 1: Rollback via Railway Dashboard

1. Go to Railway Dashboard → Your Project → Deployments
2. Find the last working deployment
3. Click **⋮** menu → **Redeploy**

### Option 2: Rollback via Git

```bash
# Find last working commit
git log --oneline

# Revert to that commit
git revert <commit-hash>

# Push to trigger new deployment
git push origin main
```

### Option 3: Emergency Manual Fix

```bash
# SSH into Railway container (if needed)
railway run bash

# Quick fix and redeploy
railway up
```

---

## Deployment Checklist Summary

### Pre-Deployment

- [ ] Railway CLI installed
- [ ] Railway project created
- [ ] PostgreSQL plugin added
- [ ] Redis plugin added
- [ ] GitHub OAuth app created
- [ ] All environment variables set

### Deployment

- [ ] First deployment successful
- [ ] NEXTAUTH_URL updated
- [ ] GitHub OAuth callback updated
- [ ] Redeployed with updated variables
- [ ] Database migrations run
- [ ] Database seeded (optional)

### Verification

- [ ] Homepage loads
- [ ] GitHub OAuth works
- [ ] Protected routes work
- [ ] Database connected
- [ ] Redis connected
- [ ] No errors in logs

### CI/CD

- [ ] Railway token generated
- [ ] GitHub secret added
- [ ] Automated deployment tested

### Monitoring

- [ ] Railway dashboard reviewed
- [ ] Alerts configured
- [ ] Logs monitored

---

## Success Criteria

Your deployment is successful when:

- ✅ Application is accessible at Railway domain
- ✅ GitHub OAuth sign-in works end-to-end
- ✅ Protected routes redirect correctly
- ✅ Database queries execute without errors
- ✅ Redis caching works
- ✅ No errors in Railway logs
- ✅ CI/CD pipeline deploys automatically on push to main
- ✅ All smoke tests pass

---

## Next Steps After Deployment

1. **Test thoroughly** - Run through all user flows
2. **Load testing** - Use tools like k6 or Artillery
3. **Security audit** - Check for vulnerabilities
4. **Performance optimization** - Review Lighthouse scores
5. **Production deployment** - Repeat process for production environment

---

## Quick Reference

```bash
# Common Railway commands
railway login                          # Authenticate
railway init                           # Initialize project
railway link                           # Link to existing project
railway up                             # Deploy application
railway logs                           # View logs
railway logs --tail                    # Live logs
railway variables                      # List env vars
railway variables set KEY="value"      # Set env var
railway status                         # Deployment status
railway open                           # Open app in browser
railway run <command>                  # Run command on Railway
railway add --plugin postgresql        # Add PostgreSQL
railway add --plugin redis             # Add Redis
railway domain                         # Manage domains
railway down                           # Stop service
```

**Status:** Ready for deployment! 🚀

Follow this checklist step-by-step for a successful Railway staging deployment.
