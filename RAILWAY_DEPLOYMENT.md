# Railway Deployment Guide

Complete guide for deploying CodeSalvage to Railway.

## Prerequisites

1. **Railway Account**
   - Sign up at [railway.app](https://railway.app)
   - Install Railway CLI: `npm i -g @railway/cli`
   - Login: `railway login`

2. **GitHub Repository**
   - Push code to GitHub
   - Railway will deploy from your repository

## Initial Setup

### 1. Create Railway Project

```bash
# From project root
railway init

# Follow prompts:
# - Project name: codesalvage-staging (or codesalvage-production)
# - Choose: "Deploy from GitHub repo"
# - Select your repository
```

### 2. Add PostgreSQL Database

```bash
# Add PostgreSQL plugin
railway add --plugin postgresql

# Railway will automatically:
# - Create a PostgreSQL database
# - Set DATABASE_URL environment variable
# - Configure connection pooling
```

**PostgreSQL Configuration:**

- Version: PostgreSQL 16
- Connection pooling: Enabled (via Railway proxy)
- Automatic backups: Daily
- Cost: ~$5/month (500MB included, scales with usage)

### 3. Add Redis

```bash
# Add Redis plugin
railway add --plugin redis

# Railway will automatically:
# - Create a Redis instance
# - Set REDIS_URL environment variable
```

**Redis Configuration:**

- Version: Redis 7
- Persistence: AOF (Append Only File)
- Eviction policy: noeviction
- Cost: ~$5/month (25MB included, scales with usage)

### 4. Configure Environment Variables

Set all required environment variables in Railway dashboard or via CLI:

```bash
# Auth.js Configuration
railway variables set AUTH_SECRET=$(openssl rand -base64 32)
railway variables set AUTH_GITHUB_ID="your-github-oauth-app-id"
railway variables set AUTH_GITHUB_SECRET="your-github-oauth-secret"
railway variables set NEXTAUTH_URL="https://your-app.railway.app"

# Application Configuration
railway variables set NEXT_PUBLIC_APP_URL="https://your-app.railway.app"
railway variables set NODE_ENV="production"

# Cloudflare R2 (when ready)
railway variables set R2_ENDPOINT="https://xxx.r2.cloudflarestorage.com"
railway variables set R2_ACCESS_KEY_ID="your-r2-access-key"
railway variables set R2_SECRET_ACCESS_KEY="your-r2-secret-key"
railway variables set R2_BUCKET_NAME="codesalvage"
railway variables set R2_PUBLIC_URL="https://pub-xxx.r2.dev"

# Stripe (when ready)
railway variables set STRIPE_SECRET_KEY="sk_live_..."
railway variables set STRIPE_PUBLISHABLE_KEY="pk_live_..."
railway variables set STRIPE_WEBHOOK_SECRET="whsec_..."

# SendGrid (when ready)
railway variables set SENDGRID_API_KEY="SG.xxx"
railway variables set SENDGRID_FROM_EMAIL="noreply@codesalvage.com"

# Database URLs are automatically set by Railway plugins
# DATABASE_URL - Set by PostgreSQL plugin
# REDIS_URL - Set by Redis plugin
```

**Environment Variables Checklist:**

- [ ] AUTH_SECRET (generate with `openssl rand -base64 32`)
- [ ] AUTH_GITHUB_ID (from GitHub OAuth app)
- [ ] AUTH_GITHUB_SECRET (from GitHub OAuth app)
- [ ] NEXTAUTH_URL (your Railway app URL)
- [ ] NEXT_PUBLIC_APP_URL (your Railway app URL)
- [ ] DATABASE_URL (auto-set by Railway)
- [ ] REDIS_URL (auto-set by Railway)

### 5. Run Database Migrations

Railway will automatically run migrations on first deploy if configured. To run manually:

```bash
# Run migrations via Railway CLI
railway run npm run db:migrate:deploy

# Or connect to the database directly
railway connect postgres
# Then run: \i path/to/migration.sql
```

**Migration Strategy:**

1. Railway detects `prisma/schema.prisma`
2. Add migration command to package.json build script
3. Migrations run automatically on each deploy

Update `package.json` to include migration in build:

```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy && next build"
  }
}
```

## Deployment

### Deploy via CLI

```bash
# Deploy to Railway
railway up

# Watch deployment logs
railway logs

# Open deployed app
railway open
```

### Deploy via GitHub (Recommended)

1. **Connect Repository**
   - Go to Railway project settings
   - Connect GitHub repository
   - Select branch (main or staging)

2. **Configure Automatic Deployments**
   - Enable "Deploy on Push"
   - Railway will auto-deploy on every commit to main

3. **Deployment Triggers**
   - Push to main → Auto-deploy to production
   - Create PR → Auto-deploy to preview environment
   - Railway creates unique preview URLs for each PR

### Manual Deploy

```bash
# Deploy specific branch
railway up --branch staging

# Deploy with specific environment
railway up --environment production
```

## Post-Deployment Setup

### 1. Run Database Seed (Optional)

```bash
# Seed the database with test data
railway run npm run db:seed
```

### 2. Verify Deployment

**Checklist:**

- [ ] App loads at Railway URL
- [ ] GitHub OAuth sign-in works
- [ ] Database connection works
- [ ] Redis connection works
- [ ] Protected routes redirect correctly
- [ ] Navigation and footer display correctly
- [ ] No console errors in browser DevTools

**Test URLs:**

- Homepage: `https://your-app.railway.app`
- Sign-in: `https://your-app.railway.app/auth/signin`
- Dashboard (requires auth): `https://your-app.railway.app/dashboard`

### 3. Setup Custom Domain (Optional)

```bash
# Add custom domain
railway domain add codesalvage.com

# Railway will provide DNS records to configure:
# - A record: points to Railway IP
# - CNAME record: www.codesalvage.com → your-app.railway.app

# SSL certificate is automatically provisioned
```

**Custom Domain Steps:**

1. Go to Railway project → Settings → Domains
2. Click "Add Domain"
3. Enter your domain (e.g., codesalvage.com)
4. Configure DNS records with your domain registrar
5. Wait for DNS propagation (5-60 minutes)
6. Railway auto-provisions SSL certificate

### 4. Configure GitHub OAuth Callback

Update GitHub OAuth app settings:

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Edit your OAuth App
3. Update Authorization callback URL:
   - `https://your-app.railway.app/api/auth/callback/github`
4. Save changes

## Monitoring & Maintenance

### View Logs

```bash
# Real-time logs
railway logs --tail

# Filter by service
railway logs --service postgres
railway logs --service redis

# Download logs
railway logs --download
```

### Database Management

```bash
# Connect to PostgreSQL
railway connect postgres

# Run Prisma Studio (locally connects to production DB)
railway run npx prisma studio

# Backup database
pg_dump $(railway variables get DATABASE_URL) > backup.sql

# Restore database
psql $(railway variables get DATABASE_URL) < backup.sql
```

### Redis Management

```bash
# Connect to Redis CLI
railway connect redis

# Check Redis stats
railway run redis-cli INFO

# Flush Redis cache (use with caution)
railway run redis-cli FLUSHALL
```

### Resource Usage

Monitor resource usage in Railway dashboard:

1. **Database Metrics**
   - Connection count
   - Query performance
   - Storage usage
   - Backup status

2. **Redis Metrics**
   - Memory usage
   - Hit/miss ratio
   - Connected clients
   - Commands per second

3. **Application Metrics**
   - CPU usage
   - Memory usage
   - Request count
   - Response times

### Scaling

Railway automatically scales based on usage:

**Vertical Scaling (Automatic):**

- CPU: Scales to 8 vCPU max
- Memory: Scales to 32GB max
- Disk: Scales to 100GB max

**Horizontal Scaling (Manual):**

```bash
# Scale to multiple replicas
railway scale --replicas 2

# Auto-scaling based on load (Pro plan)
railway autoscale --min 1 --max 5
```

## Troubleshooting

### Common Issues

#### 1. Build Fails

**Error:** `Module not found: Can't resolve 'prisma'`

**Solution:**

```bash
# Ensure prisma is in dependencies, not devDependencies
npm install prisma @prisma/client
```

#### 2. Database Connection Errors

**Error:** `Can't reach database server`

**Solution:**

```bash
# Verify DATABASE_URL is set
railway variables get DATABASE_URL

# Check PostgreSQL is running
railway status

# Restart PostgreSQL
railway restart --service postgres
```

#### 3. Migration Errors

**Error:** `Migration failed to apply`

**Solution:**

```bash
# Reset database (WARNING: Deletes all data)
railway run npx prisma migrate reset

# Or manually fix migrations
railway connect postgres
# Fix issues in SQL
```

#### 4. Redis Connection Errors

**Error:** `ECONNREFUSED` or `Redis timeout`

**Solution:**

```bash
# Verify REDIS_URL is set
railway variables get REDIS_URL

# Restart Redis
railway restart --service redis
```

#### 5. OAuth Errors

**Error:** `redirect_uri_mismatch`

**Solution:**

- Update GitHub OAuth app callback URL
- Ensure NEXTAUTH_URL matches Railway app URL
- Clear browser cookies and try again

### Debug Mode

Enable debug logging:

```bash
# Set debug environment variables
railway variables set DEBUG="*"
railway variables set LOG_LEVEL="debug"

# View detailed logs
railway logs --tail
```

## Cost Estimation

### Starter Plan (Free Tier)

- **$5 free credit/month**
- PostgreSQL: ~$5/month (500MB)
- Redis: ~$5/month (25MB)
- **Total: ~$5-10/month** (after free credits)

### Pro Plan (Recommended for Production)

- **$20/month base**
- PostgreSQL: ~$5-20/month (scales with usage)
- Redis: ~$5-10/month (scales with usage)
- **Total: ~$30-50/month**

### Enterprise Plan

- Custom pricing
- Dedicated support
- Advanced features (SSO, RBAC, etc.)

## Rollback Strategy

### Rollback to Previous Deployment

```bash
# List recent deployments
railway deployments

# Rollback to specific deployment
railway rollback <deployment-id>
```

### Database Rollback

```bash
# Run database migration rollback
railway run npx prisma migrate resolve --rolled-back <migration-name>

# Restore from backup
psql $(railway variables get DATABASE_URL) < backup.sql
```

## CI/CD Integration

Railway automatically deploys when you push to GitHub. No additional CI/CD setup needed!

**Deployment Flow:**

1. Push code to GitHub
2. Railway detects changes
3. Railway runs build command (`npm run build`)
4. Railway runs migrations (if in build script)
5. Railway deploys new version
6. Zero-downtime deployment (automatic health checks)

**Preview Environments:**

- Every PR gets a unique preview URL
- Test changes before merging to main
- Automatically cleaned up when PR is closed

## Security Best Practices

1. **Rotate Secrets Regularly**

   ```bash
   # Generate new AUTH_SECRET
   railway variables set AUTH_SECRET=$(openssl rand -base64 32)
   ```

2. **Use Environment-Specific Secrets**
   - Different secrets for staging vs. production
   - Never commit secrets to Git

3. **Enable 2FA on Railway Account**
   - Go to Railway account settings
   - Enable two-factor authentication

4. **Restrict Database Access**
   - Database is private by default (only accessible within Railway network)
   - Use Railway proxy for external connections

5. **Monitor for Security Issues**
   - Enable Dependabot on GitHub
   - Run `npm audit` regularly
   - Keep dependencies updated

## Support

- **Railway Documentation:** [docs.railway.app](https://docs.railway.app)
- **Railway Discord:** [discord.gg/railway](https://discord.gg/railway)
- **Railway Status:** [status.railway.app](https://status.railway.app)

## Next Steps

After Railway deployment is working:

1. **Configure GitHub Actions CI/CD** (Task 31)
   - Run tests before deployment
   - Automated checks on PRs

2. **Setup Monitoring**
   - Error tracking (Sentry)
   - Performance monitoring
   - Uptime monitoring

3. **Configure CDN**
   - Cloudflare for static assets
   - Image optimization

4. **Setup Staging Environment**
   - Separate Railway project for staging
   - Test changes before production deploy
