# GitHub Actions CI/CD Setup

This document explains the GitHub Actions workflows configured for ProjectFinish and how to set them up.

## Table of Contents

1. [Overview](#overview)
2. [Workflows](#workflows)
3. [Setup Instructions](#setup-instructions)
4. [Secrets Configuration](#secrets-configuration)
5. [Troubleshooting](#troubleshooting)

---

## Overview

ProjectFinish uses GitHub Actions for:

- **Continuous Integration (CI):** Automated testing, linting, and type checking on every push and PR
- **Continuous Deployment (CD):** Automated deployment to Railway staging environment on main branch merges

**Benefits:**

- Catch bugs before they reach production
- Ensure code quality standards are met
- Automate repetitive tasks (linting, testing, deployments)
- Provide fast feedback to developers
- Safe deployment process with automated checks

---

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Triggers:**

- Push to `main` or `develop` branches
- Pull requests targeting `main` or `develop`

**Jobs:**

#### `lint` - Lint & Format Check

- Runs ESLint on TypeScript/JavaScript files
- Checks Prettier formatting
- **Duration:** ~2-3 minutes
- **Fails if:** ESLint errors or formatting issues found

#### `type-check` - TypeScript Type Check

- Generates Prisma Client types
- Runs TypeScript compiler in check mode
- **Duration:** ~2-3 minutes
- **Fails if:** Type errors found

#### `unit-test` - Unit Tests

- Runs Vitest unit tests
- Generates coverage report
- Uploads coverage to Codecov (on main branch only)
- **Duration:** ~3-5 minutes
- **Fails if:** Any test fails

#### `e2e-test` - E2E Tests

- Starts PostgreSQL and Redis services
- Runs database migrations
- Installs Playwright browsers
- Runs E2E tests with Playwright
- Uploads test reports and screenshots
- **Duration:** ~8-12 minutes
- **Fails if:** Any E2E test fails

#### `build` - Build Check

- Builds Next.js application
- Verifies `.next` directory exists
- **Duration:** ~5-7 minutes
- **Fails if:** Build fails

#### `all-checks` - Status Gate

- Aggregates results from all jobs
- **Required for PR merges**
- **Fails if:** Any job fails

**Total CI Duration:** ~15-20 minutes (jobs run in parallel)

---

### 2. Railway Deployment Workflow (`.github/workflows/deploy-railway.yml`)

**Triggers:**

- Push to `main` branch
- Manual workflow dispatch (via GitHub UI)

**Jobs:**

#### `deploy` - Deploy to Railway Staging

1. Runs quick CI checks (lint, type-check, build)
2. Installs Railway CLI
3. Deploys to Railway using `railway up`
4. Runs database migrations on Railway environment
5. Verifies deployment status
6. Generates deployment summary

**Duration:** ~10-15 minutes

**Fails if:**

- CI checks fail
- Railway deployment fails
- Database migrations fail

---

## Setup Instructions

### Prerequisites

1. **GitHub Repository:** Push your code to GitHub
2. **Railway Account:** Create account at [railway.app](https://railway.app)
3. **Railway Project:** Create project with Postgres + Redis plugins (see RAILWAY_DEPLOYMENT.md)

### Step 1: Enable GitHub Actions

GitHub Actions are automatically enabled for public repositories. For private repositories:

1. Go to repository **Settings → Actions → General**
2. Under "Actions permissions", select **Allow all actions and reusable workflows**
3. Click **Save**

### Step 2: Configure Branch Protection (Recommended)

Enforce that all checks must pass before merging:

1. Go to **Settings → Branches**
2. Click **Add branch protection rule**
3. Branch name pattern: `main`
4. Check these boxes:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
5. Search for and select these status checks:
   - `Lint & Format Check`
   - `TypeScript Type Check`
   - `Unit Tests`
   - `E2E Tests`
   - `Build Check`
   - `All Checks Passed`
6. Click **Create**

### Step 3: Configure Secrets

See [Secrets Configuration](#secrets-configuration) below.

### Step 4: Test Workflows

#### Test CI Workflow

1. Create a new branch: `git checkout -b test/ci-workflow`
2. Make a small change (e.g., add comment to README)
3. Commit and push: `git push -u origin test/ci-workflow`
4. Create pull request on GitHub
5. Verify all CI checks run and pass
6. Check **Actions** tab to see workflow logs

#### Test Deployment Workflow

1. Merge PR to `main` branch
2. Go to **Actions** tab
3. Select **Deploy to Railway** workflow
4. Verify deployment succeeds
5. Check Railway dashboard for new deployment

---

## Secrets Configuration

### Required Secrets for Railway Deployment

GitHub Actions needs these secrets to deploy to Railway:

#### 1. `RAILWAY_TOKEN` (Required)

**What it is:** Railway API token for authentication

**How to get it:**

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click your profile (top right) → **Account Settings**
3. Navigate to **Tokens** tab
4. Click **Create Token**
5. Name: `GitHub Actions CI/CD`
6. Copy the token (starts with `railway_...`)

**How to add to GitHub:**

1. Go to repository **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `RAILWAY_TOKEN`
4. Value: Paste the Railway token
5. Click **Add secret**

#### 2. `CODECOV_TOKEN` (Optional)

**What it is:** Token for uploading test coverage to Codecov

**How to get it:**

1. Go to [codecov.io](https://codecov.io)
2. Sign in with GitHub
3. Add your repository
4. Copy the upload token

**How to add to GitHub:**

1. Go to repository **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `CODECOV_TOKEN`
4. Value: Paste the Codecov token
5. Click **Add secret**

**Note:** Coverage upload is optional and won't fail the build if token is missing.

---

## Environment Variables in CI

The CI workflow sets these environment variables for testing:

```yaml
DATABASE_URL: 'postgresql://postgres:password@localhost:5432/projectfinish_test'
REDIS_URL: 'redis://localhost:6379'
AUTH_SECRET: 'test-secret-min-32-characters-long-for-ci'
AUTH_GITHUB_ID: 'test-github-id'
AUTH_GITHUB_SECRET: 'test-github-secret'
NEXTAUTH_URL: 'http://localhost:3011'
NEXT_PUBLIC_APP_URL: 'http://localhost:3011'
```

**These are test values only and not used in production.**

Production environment variables are configured directly in Railway (see RAILWAY_DEPLOYMENT.md).

---

## Workflow Optimization Features

### 1. Dependency Caching

Both workflows use `actions/setup-node@v4` with `cache: 'npm'`:

- Caches `node_modules` between runs
- Speeds up dependency installation from ~2min → ~30sec
- Automatically invalidated when `package-lock.json` changes

### 2. Concurrency Control

**CI Workflow:**

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

- Cancels old workflow runs when new commit is pushed
- Saves CI minutes and provides faster feedback

**Deployment Workflow:**

```yaml
concurrency:
  group: railway-deployment
  cancel-in-progress: false
```

- Prevents concurrent deployments
- Ensures deployments finish in order

### 3. Parallel Job Execution

CI jobs run in parallel for speed:

- `lint` + `type-check` + `unit-test` + `e2e-test` + `build` run simultaneously
- Total time = slowest job (~12min) instead of sum of all jobs (~25min)

### 4. Service Containers

E2E tests use GitHub Actions service containers:

- PostgreSQL 16 and Redis 7 start automatically
- Health checks ensure services are ready before tests run
- Isolated environment per test run

### 5. Artifact Uploads

**Playwright Reports:**

- Uploaded on test failure for debugging
- Includes screenshots and videos
- Retained for 7 days
- Download from Actions → Workflow run → Artifacts

**Coverage Reports:**

- Uploaded to Codecov on main branch pushes
- Tracks coverage trends over time
- Optional (won't fail build if Codecov is down)

---

## Troubleshooting

### Issue 1: CI Fails with "npm ci" Error

**Symptoms:**

```
npm ERR! `npm ci` can only install packages when your package.json and package-lock.json are in sync
```

**Solution:**

1. Run `npm install` locally
2. Commit updated `package-lock.json`
3. Push changes

### Issue 2: E2E Tests Timeout

**Symptoms:**

```
Error: page.goto: Test timeout of 30000ms exceeded
```

**Solution:**

- Check if Next.js dev server started properly in workflow logs
- Verify `PLAYWRIGHT_TEST_BASE_URL` is correct
- Increase timeout in `playwright.config.ts` if needed

### Issue 3: Railway Deployment Fails

**Symptoms:**

```
Error: Railway token not found
```

**Solution:**

1. Verify `RAILWAY_TOKEN` secret is configured correctly
2. Check token hasn't expired (Railway tokens don't expire by default)
3. Ensure token has correct permissions

### Issue 4: Type Check Fails After Prisma Schema Change

**Symptoms:**

```
Error: Cannot find module '@prisma/client' or its corresponding type declarations
```

**Solution:**

- Ensure `db:generate` step runs before `type-check`
- Workflow already includes this step, but verify it's not commented out

### Issue 5: Build Fails with Memory Error

**Symptoms:**

```
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
```

**Solution:**

1. Add `NODE_OPTIONS` environment variable to workflow:
   ```yaml
   env:
     NODE_OPTIONS: '--max_old_space_size=4096'
   ```
2. Optimize Next.js build (reduce bundle size, code splitting)

### Issue 6: Tests Pass Locally but Fail in CI

**Symptoms:**
Tests pass on your machine but fail in GitHub Actions

**Common Causes:**

- Environment variable differences
- Database state (tests not cleaning up properly)
- Timing issues (tests depending on specific timing)
- Missing dependencies

**Solution:**

1. Check CI logs for exact error message
2. Run tests locally with same environment variables as CI
3. Ensure tests are isolated and clean up after themselves
4. Add appropriate `waitFor` statements in E2E tests

---

## Viewing Workflow Results

### GitHub Actions Tab

1. Go to repository on GitHub
2. Click **Actions** tab
3. See all workflow runs (past and current)
4. Click a run to see detailed logs
5. Click a job to see step-by-step execution

### Pull Request Checks

When you open a PR, you'll see:

- ✅ Green checkmarks for passing jobs
- ❌ Red X for failing jobs
- 🟡 Yellow dot for in-progress jobs

Click **Details** next to any check to see logs.

### Status Badges (Optional)

Add CI status badge to README.md:

```markdown
![CI Status](https://github.com/YOUR_USERNAME/projectfinish/workflows/CI/badge.svg)
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Best Practices

### 1. Always Create Feature Branches

Never commit directly to `main`:

```bash
git checkout -b feature/my-feature
# Make changes
git commit -m "Add new feature"
git push -u origin feature/my-feature
# Create PR on GitHub
```

### 2. Wait for CI Before Merging

- Always wait for all checks to pass (green checkmarks)
- Review any warnings in CI logs
- Don't use "Merge without waiting for checks" unless emergency

### 3. Fix Broken Builds Immediately

If main branch build breaks:

1. Create hotfix branch immediately
2. Fix the issue
3. Create PR with fix
4. Merge as soon as checks pass

### 4. Keep Workflows Fast

- Optimize test suite (remove slow/flaky tests)
- Use caching effectively
- Run expensive checks only on main branch
- Consider splitting E2E tests into parallel jobs

### 5. Monitor Workflow Usage

GitHub provides:

- 2,000 free CI minutes/month for private repos
- Unlimited for public repos

Check usage: **Settings → Billing → Actions**

---

## Advanced Configuration

### Matrix Testing (Multiple Node Versions)

To test on Node 18, 20, and 22:

```yaml
jobs:
  test:
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
```

### Conditional Jobs

Run deployment only on main branch:

```yaml
jobs:
  deploy:
    if: github.ref == 'refs/heads/main'
```

### Scheduled Workflows

Run tests daily at 2 AM UTC:

```yaml
on:
  schedule:
    - cron: '0 2 * * *'
```

---

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Railway CLI Documentation](https://docs.railway.app/develop/cli)
- [Playwright CI Guide](https://playwright.dev/docs/ci)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Codecov Documentation](https://docs.codecov.com/)

---

## Summary Checklist

Before going live, ensure:

- [ ] GitHub Actions enabled in repository settings
- [ ] Branch protection rules configured for `main`
- [ ] `RAILWAY_TOKEN` secret added
- [ ] CI workflow tested with a PR
- [ ] Deployment workflow tested with merge to main
- [ ] All team members understand CI/CD process
- [ ] Notifications configured (Slack, email, etc.)

**Status:** ✅ GitHub Actions CI/CD configured and ready to use!
