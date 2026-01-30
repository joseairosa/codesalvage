# Firebase Migration - Cleanup TODO

This document lists Auth.js files and code that should be removed after the Firebase migration is complete and tested.

## ⚠️ Important: Do NOT delete these files yet!

**Test the Firebase migration thoroughly in production first**, then come back to this list for cleanup.

---

## Files to Delete (After Migration Complete)

### Auth.js Configuration Files

1. **[`auth.ts`](auth.ts)** - Root-level Auth.js exports
   - Re-exports from `lib/auth.ts`
   - No longer needed with Firebase

2. **[`lib/auth.ts`](lib/auth.ts)** - Auth.js v5 configuration
   - GitHub OAuth provider config
   - Prisma adapter setup
   - Type declarations
   - **DELETE ENTIRE FILE**

3. **[`app/api/auth/[...nextauth]/route.ts`](app/api/auth/[...nextauth]/route.ts)** - Auth.js API handlers
   - OAuth callback handlers
   - Session management
   - **DELETE ENTIRE DIRECTORY**: `app/api/auth/[...nextauth]/`

### Auth.js Components (if any exist)

Search for and delete:

```bash
# Find components using Auth.js
grep -r "useSession" components/
grep -r "SessionProvider" components/
grep -r "signIn.*from.*next-auth" components/
```

Common Auth.js client components to remove:

- Any `<SessionProvider>` wrapper
- Any `useSession()` hooks
- Any `signIn()` / `signOut()` from `next-auth/react`

### Database Tables (After All Users Migrated)

**⚠️ CRITICAL: Only delete after 100% of users have migrated to Firebase!**

Run this Prisma migration **LAST**:

```prisma
// prisma/migrations/YYYYMMDDHHMMSS_remove_auth_js_tables/migration.sql

-- Drop Auth.js tables (only after all users migrated!)
DROP TABLE IF EXISTS "verification_tokens";
DROP TABLE IF EXISTS "sessions";
DROP TABLE IF EXISTS "accounts";
```

Tables to remove from `prisma/schema.prisma`:

- `Account` model
- `Session` model
- `VerificationToken` model

### Environment Variables

Remove from `.env`, `.env.example`, and Railway:

```bash
# Auth.js (OLD - REMOVE)
AUTH_SECRET="..."
NEXTAUTH_URL="..."
GITHUB_ID="..."        # If not migrated to Firebase GitHub OAuth
GITHUB_SECRET="..."    # If not migrated to Firebase GitHub OAuth
```

Keep Firebase environment variables:

```bash
# Firebase (KEEP)
FIREBASE_PROJECT_ID="..."
FIREBASE_SERVICE_ACCOUNT_BASE64="..."
NEXT_PUBLIC_FIREBASE_API_KEY="..."
# ... all other NEXT_PUBLIC_FIREBASE_* variables
```

### Dependencies to Remove

Update `package.json` and run `npm install`:

```json
{
  "dependencies": {
    // REMOVE THESE:
    "next-auth": "^5.0.0-beta.30",
    "@auth/prisma-adapter": "^2.7.4",

    // KEEP THESE:
    "firebase": "^11.1.0",
    "firebase-admin": "^13.0.1"
  }
}
```

---

## API Routes That Still Reference Auth.js

Use this command to find routes that still need updating:

```bash
# Find routes importing from old Auth.js
grep -r "from '@/auth'" app/api/ | grep -v node_modules

# Find routes using old auth helpers
grep -r "requireAdminApi()" app/api/ | grep -v node_modules
grep -r "await auth()" app/api/ | grep -v node_modules
```

**Common routes that may need updates:**

- `/api/messages/*`
- `/api/favorites/*`
- `/api/transactions/*`
- `/api/projects/[id]/*`
- `/api/admin/*` (most already done)

See [`FIREBASE_API_MIGRATION_GUIDE.md`](FIREBASE_API_MIGRATION_GUIDE.md) for update instructions.

---

## Migration Checklist

Before deleting Auth.js code, verify:

### Phase 1: Frontend Testing (Week 2)

- [ ] Users can sign in with Email/Password
- [ ] Users can sign in with Email Magic Link
- [ ] Users can sign in with Google OAuth
- [ ] Users can sign in with GitHub OAuth
- [ ] Users can sign up with all 4 methods
- [ ] User sessions persist across page reloads
- [ ] Sign out works correctly
- [ ] Protected routes redirect to sign-in
- [ ] Callback URLs work after sign-in

### Phase 2: Backend Testing (Week 3)

- [ ] All API routes support cookie-based auth
- [ ] All API routes support API key auth
- [ ] API keys can be created
- [ ] API keys can be listed
- [ ] API keys can be revoked
- [ ] Admin routes enforce admin privileges
- [ ] Seller routes enforce seller privileges
- [ ] Banned users are blocked

### Phase 3: User Migration (Week 3-4)

- [ ] Auto-create Firebase users on first sign-in
- [ ] All existing users have `firebaseUid` populated
- [ ] User roles preserved (isAdmin, isSeller, isVerifiedSeller)
- [ ] User projects preserved and accessible
- [ ] User transactions preserved
- [ ] User messages preserved
- [ ] No user reports of auth issues

### Phase 4: Production Validation (Week 4)

- [ ] Monitor Firebase Auth logs for errors
- [ ] Monitor API error rates (should not increase)
- [ ] Check authentication latency (<100ms)
- [ ] Verify no Auth.js errors in logs
- [ ] Confirm API key usage tracking works
- [ ] Test API key revocation in production
- [ ] Verify ban system still works

### Phase 5: Cleanup (After All Checks Pass)

- [ ] All items in Phase 1-4 complete
- [ ] Zero Auth.js related errors in production logs for 1 week
- [ ] 100% of active users have `firebaseUid` populated
- [ ] All API routes updated (grep checks return empty)
- [ ] Backup database before dropping Auth.js tables

Only after **ALL** checks pass, proceed with cleanup:

1. Delete Auth.js configuration files
2. Delete Auth.js API route handlers
3. Remove Auth.js dependencies from `package.json`
4. Remove Auth.js environment variables
5. Drop Auth.js database tables (LAST STEP!)

---

## Rollback Plan (If Something Goes Wrong)

If the Firebase migration has critical issues:

### Emergency Rollback Steps:

1. **Keep Auth.js files**: Don't delete them yet! They're your rollback
2. **Feature flag**: Add environment variable to toggle between systems
   ```typescript
   const USE_FIREBASE = process.env.NEXT_PUBLIC_USE_FIREBASE === 'true';
   ```
3. **Revert middleware**: Change `middleware.ts` back to Auth.js
4. **Revert sign-in page**: Restore old GitHub OAuth sign-in
5. **Deploy**: Users will be back on Auth.js

This is why we keep Auth.js code until migration is 100% validated!

---

## Timeline Recommendation

- **Week 2**: Deploy frontend, test basic auth flows
- **Week 3**: Deploy API routes, test programmatic access, start user migration
- **Week 4**: Monitor production, validate 100% migration
- **Week 5+**: If everything stable for 1-2 weeks, start cleanup

**Don't rush the cleanup!** It's better to have both systems coexist temporarily than to delete Auth.js too early and need to rollback.

---

## Questions?

If you're unsure about deleting something:

1. Search for references: `grep -r "filename" .`
2. Check if it's imported anywhere
3. When in doubt, keep it a bit longer

The goal is a smooth migration, not a fast cleanup.
