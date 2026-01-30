# Smoke Testing Checklist - CodeSalvage

**Post-Deployment Verification**

Run this checklist immediately after deploying to production to verify critical functionality.

**Estimated Time**: 30-45 minutes
**Environment**: https://codesalvage.com

---

## Pre-Testing Setup

- [ ] **Clear browser cache** (Cmd+Shift+R / Ctrl+Shift+F5)
- [ ] **Open browser console** (F12) to monitor for errors
- [ ] **Open Honeybadger dashboard** to monitor errors in real-time
- [ ] **Have test payment card ready**: `4242 4242 4242 4242` (Stripe test mode)
- [ ] **Create test GitHub account** if needed for OAuth testing

---

## 1. Authentication Flow ✅

### Test: GitHub OAuth Login

- [ ] Navigate to https://codesalvage.com
- [ ] Click "Sign In" or "Login" button
- [ ] Should redirect to GitHub OAuth
- [ ] Authorize application
- [ ] Should redirect back to codesalvage.com
- [ ] User should be logged in (check for username/avatar in nav)
- [ ] **Expected**: Successful login, no console errors
- [ ] **Check Honeybadger**: No authentication errors

### Test: User Session Persistence

- [ ] Refresh page (Cmd+R / Ctrl+R)
- [ ] User should remain logged in
- [ ] Navigate to different pages
- [ ] Session should persist across pages
- [ ] **Expected**: Session persists, no re-login required

### Test: Logout

- [ ] Click user menu/avatar
- [ ] Click "Logout" or "Sign Out"
- [ ] Should redirect to homepage or login page
- [ ] Should be logged out
- [ ] **Expected**: Successful logout, session cleared

---

## 2. Homepage & Navigation ✅

### Test: Homepage Loads

- [ ] Navigate to https://codesalvage.com
- [ ] Page loads within 3 seconds
- [ ] No console errors
- [ ] Featured projects visible (if any exist)
- [ ] Navigation menu functional
- [ ] **Expected**: Clean load, no errors
- [ ] **Check Honeybadger**: No homepage errors

### Test: Navigation Menu

- [ ] Click "Browse Projects" or "Projects"
- [ ] Should navigate to `/projects`
- [ ] Click "Pricing" (if exists)
- [ ] Should show subscription pricing
- [ ] Click "How It Works" or "About"
- [ ] Should load info pages
- [ ] **Expected**: All navigation links work

---

## 3. Project Browsing & Search ✅

### Test: Browse Projects Page

- [ ] Navigate to `/projects`
- [ ] Projects list loads (or "No projects" message)
- [ ] Pagination controls visible (if >20 projects)
- [ ] Project cards show: title, price, completion %, tech stack
- [ ] **Expected**: Project list loads, no errors
- [ ] **Check Response Time**: Should load in <2 seconds

### Test: Search Functionality

- [ ] Enter search term (e.g., "react", "dashboard")
- [ ] Click search or press Enter
- [ ] Results should filter
- [ ] Clear search
- [ ] Should show all projects again
- [ ] **Expected**: Search works, results update

### Test: Filter Sidebar

- [ ] Select category (e.g., "Web App")
- [ ] Projects should filter
- [ ] Adjust completion slider (e.g., 80-100%)
- [ ] Projects should filter
- [ ] Select tech stack (e.g., "Next.js", "Tailwind")
- [ ] Projects should filter
- [ ] Clear all filters
- [ ] Should show all projects
- [ ] **Expected**: All filters work, results update

### Test: Project Detail Page

- [ ] Click on a project card
- [ ] Should navigate to `/projects/[id]`
- [ ] Project details load (title, description, screenshots)
- [ ] Price displays correctly
- [ ] Tech stack badges visible
- [ ] Seller profile visible
- [ ] "Buy Now" or "Purchase" button visible (if logged in)
- [ ] "Contact Seller" button visible
- [ ] **Expected**: Full project details load, no errors

---

## 4. Seller Flow ✅

### Test: Become a Seller

- [ ] Log in as test user
- [ ] Navigate to seller onboarding (e.g., `/seller/onboard`)
- [ ] Click "Become a Seller" or similar
- [ ] Should redirect to Stripe Connect onboarding
- [ ] Complete Stripe Connect setup (use test business details)
- [ ] Should redirect back to codesalvage.com
- [ ] **Expected**: Stripe account connected, seller status active
- [ ] **Check Honeybadger**: No Stripe webhook errors

### Test: Create New Project

- [ ] Navigate to `/seller/dashboard` or `/projects/new`
- [ ] Fill in project form:
  - Title: "Test Project - Delete Me"
  - Description: "This is a test project"
  - Completion: 85%
  - Price: $50.00
  - Tech Stack: React, Tailwind
  - License: Full Code
- [ ] Upload thumbnail image (< 5MB)
- [ ] Click "Save as Draft" or "Publish"
- [ ] Project should be created
- [ ] Should see success message
- [ ] **Expected**: Project created successfully
- [ ] **Check Database**: Project record exists
- [ ] **Check Cloudflare R2**: Image uploaded successfully

### Test: Seller Dashboard

- [ ] Navigate to `/seller/dashboard`
- [ ] Projects list loads
- [ ] View count, favorite count visible
- [ ] Edit/delete buttons functional
- [ ] "New Project" button visible
- [ ] **Expected**: Dashboard loads, all data visible

### Test: Analytics Page (if applicable)

- [ ] Navigate to `/seller/analytics`
- [ ] Analytics overview loads
- [ ] Charts render (revenue, views, etc.)
- [ ] No console errors
- [ ] **Expected**: Analytics load, charts render correctly

---

## 5. Purchase Flow ✅ **CRITICAL**

### Test: Create Payment Intent

- [ ] Log in as buyer (different account from seller)
- [ ] Navigate to a project detail page
- [ ] Click "Buy Now" or "Purchase"
- [ ] Should redirect to checkout page
- [ ] Order summary displays (project title, price)
- [ ] **Expected**: Checkout page loads
- [ ] **Check Console**: No errors

### Test: Complete Payment (Stripe Test Mode)

- [ ] On checkout page, fill in Stripe payment form:
  - Card Number: `4242 4242 4242 4242`
  - Expiry: Any future date (e.g., 12/25)
  - CVC: Any 3 digits (e.g., 123)
  - ZIP: Any 5 digits (e.g., 12345)
- [ ] Click "Pay" or "Complete Purchase"
- [ ] Payment should process (spinner/loading indicator)
- [ ] Should redirect to success page or transaction page
- [ ] **Expected**: Payment succeeds, transaction created
- [ ] **Check Stripe Dashboard**: Payment Intent created
- [ ] **Check Database**: Transaction record created with `paymentStatus: 'succeeded'`
- [ ] **Check Honeybadger**: No payment errors

### Test: Email Notifications

- [ ] Check buyer email inbox
- [ ] Should receive purchase confirmation email
- [ ] Check seller email inbox
- [ ] Should receive sale notification email
- [ ] **Expected**: Both emails sent via SendGrid
- [ ] **Check SendGrid Activity**: Emails delivered

### Test: Code Delivery

- [ ] On transaction success page, should see "Download Code" link
- [ ] Click "Download Code"
- [ ] Should download ZIP file OR redirect to GitHub
- [ ] ZIP file should contain code (not empty)
- [ ] **Expected**: Code delivered successfully
- [ ] **Check Cloudflare R2**: Pre-signed URL generated

### Test: Transaction History

- [ ] As buyer, navigate to `/buyer/dashboard` or `/transactions`
- [ ] Transaction should appear in list
- [ ] Transaction status should be "Completed" or "Pending Escrow"
- [ ] As seller, navigate to `/seller/dashboard`
- [ ] Transaction should appear in sales list
- [ ] **Expected**: Transactions visible in both dashboards

---

## 6. Messaging System ✅

### Test: Send Message to Seller

- [ ] Log in as buyer
- [ ] On project detail page, click "Contact Seller"
- [ ] Message form should appear (modal or new page)
- [ ] Enter message: "Is this project still available?"
- [ ] Click "Send"
- [ ] Should see success message
- [ ] **Expected**: Message sent successfully

### Test: Receive Message

- [ ] Log in as seller (project owner)
- [ ] Navigate to `/messages` or check notification icon
- [ ] Should see unread message indicator
- [ ] Click to view message
- [ ] Should see buyer's message
- [ ] **Expected**: Message visible, unread indicator works

### Test: Reply to Message

- [ ] As seller, reply to message
- [ ] Enter reply text
- [ ] Click "Send"
- [ ] Reply should appear in thread
- [ ] **Expected**: Reply sent successfully

---

## 7. Reviews & Ratings ✅

### Test: Submit Review (Post-Purchase)

- [ ] Log in as buyer who completed a purchase
- [ ] Navigate to transaction detail page
- [ ] Click "Leave Review" or "Rate Seller"
- [ ] Fill in review form:
  - Overall Rating: 5 stars
  - Code Quality: 5 stars
  - Documentation: 4 stars
  - Responsiveness: 5 stars
  - Comment: "Great project, well documented!"
- [ ] Click "Submit Review"
- [ ] Should see success message
- [ ] **Expected**: Review submitted successfully

### Test: View Reviews

- [ ] Navigate to project detail page
- [ ] Scroll to reviews section
- [ ] Review should appear
- [ ] Rating should be visible
- [ ] **Expected**: Review visible on project page

### Test: Seller Rating Update

- [ ] Navigate to seller profile or project page
- [ ] Seller average rating should update
- [ ] Rating count should increment
- [ ] **Expected**: Seller rating updated correctly

---

## 8. Featured Listings ✅

### Test: Purchase Featured Placement

- [ ] Log in as seller
- [ ] Navigate to project management
- [ ] Click "Feature This Project" or similar
- [ ] Select duration (e.g., 7 days)
- [ ] Should show pricing (e.g., $19.99 for 7 days)
- [ ] Complete payment (Stripe test card)
- [ ] Project should become featured
- [ ] **Expected**: Featured placement activated
- [ ] **Check Database**: `isFeatured: true`, `featuredUntil` set

### Test: Featured Projects Display

- [ ] Navigate to homepage
- [ ] Featured projects should be highlighted (banner, carousel, etc.)
- [ ] Featured badge visible on project cards
- [ ] **Expected**: Featured projects prominently displayed

---

## 9. Subscription Plans ✅

### Test: View Subscription Pricing

- [ ] Navigate to `/pricing` or subscription page
- [ ] Pricing tiers should load (Free, Pro, etc.)
- [ ] Features list visible for each tier
- [ ] **Expected**: Pricing page loads correctly

### Test: Subscribe to Pro Plan (if applicable)

- [ ] Click "Subscribe" or "Upgrade to Pro"
- [ ] Should redirect to Stripe Checkout or payment form
- [ ] Complete payment (Stripe test card)
- [ ] Should redirect back with success message
- [ ] User profile should show Pro badge or status
- [ ] **Expected**: Subscription activated
- [ ] **Check Stripe Dashboard**: Subscription created

---

## 10. API Rate Limiting ✅

### Test: Rate Limiting Works

- [ ] Open browser console
- [ ] Run this script to test rate limiting:

```javascript
// Test public endpoint rate limiting (1000 req/hour per IP)
for (let i = 0; i < 10; i++) {
  fetch('/api/projects').then((r) => console.log(`Request ${i + 1}: ${r.status}`));
}
```

- [ ] Should see 200 responses initially
- [ ] If you continue making rapid requests, should eventually see 429 (Too Many Requests)
- [ ] **Expected**: Rate limiting engages after threshold
- [ ] **Check Honeybadger**: No rate limit errors logged

---

## 11. Error Monitoring ✅

### Test: Honeybadger Integration

- [ ] Navigate to Honeybadger dashboard
- [ ] Filter by environment: "production"
- [ ] Should see any errors from testing (if they occurred)
- [ ] Errors should have context (user ID, URL, stack trace)
- [ ] Sensitive data should be filtered (passwords, tokens)
- [ ] **Expected**: Honeybadger captures errors correctly

### Test: Intentional Error (Optional)

- [ ] Navigate to a non-existent page (e.g., `/nonexistent-page-12345`)
- [ ] Should see 404 page
- [ ] Check Honeybadger
- [ ] 404 error should be logged (or intentionally not logged if configured)
- [ ] **Expected**: Error handling works correctly

---

## 12. Performance Validation ✅

### Test: Lighthouse Audit

- [ ] Open Chrome DevTools (F12)
- [ ] Navigate to "Lighthouse" tab
- [ ] Select "Performance", "Accessibility", "Best Practices", "SEO"
- [ ] Click "Generate report"
- [ ] Wait for audit to complete
- [ ] **Expected Scores**:
  - Performance: ≥ 85
  - Accessibility: ≥ 90
  - Best Practices: ≥ 90
  - SEO: ≥ 90
- [ ] **Check for Critical Issues**: Fix any red items

### Test: Page Load Times

- [ ] Open Network tab in DevTools
- [ ] Hard refresh (Cmd+Shift+R / Ctrl+Shift+F5)
- [ ] Check "Load" time at bottom
- [ ] **Expected**:
  - Homepage: < 3 seconds
  - Project List: < 2 seconds
  - Project Detail: < 2 seconds

---

## 13. Security Validation ✅

### Test: HTTPS Enforcement

- [ ] Try accessing http://codesalvage.com (without 's')
- [ ] Should redirect to https://codesalvage.com
- [ ] **Expected**: HTTPS enforced

### Test: Authentication Required

- [ ] Log out
- [ ] Try accessing `/seller/dashboard` directly
- [ ] Should redirect to login page
- [ ] **Expected**: Protected routes require authentication

### Test: Authorization Checks

- [ ] Log in as User A
- [ ] Create a project (note the project ID)
- [ ] Log out
- [ ] Log in as User B
- [ ] Try to edit User A's project (e.g., `/projects/[id]/edit`)
- [ ] Should see "Unauthorized" or "Forbidden" error
- [ ] **Expected**: Users can't edit others' projects

---

## 14. Legal & Compliance ✅

### Test: Legal Documents Accessible

- [ ] Navigate to footer
- [ ] Click "Terms of Service"
- [ ] Terms should load (markdown or HTML)
- [ ] Click "Privacy Policy"
- [ ] Privacy Policy should load
- [ ] Click "Cookie Policy"
- [ ] Cookie Policy should load
- [ ] **Expected**: All legal documents accessible

### Test: Cookie Consent (if implemented)

- [ ] Visit site in incognito/private mode
- [ ] Should see cookie consent banner
- [ ] Accept cookies
- [ ] Banner should disappear
- [ ] **Expected**: Cookie consent works

---

## Post-Testing Cleanup

- [ ] **Delete test projects** created during testing
- [ ] **Delete test transactions** (if possible)
- [ ] **Cancel test subscriptions** (Stripe Dashboard)
- [ ] **Review Honeybadger errors** - investigate any unexpected issues
- [ ] **Review Railway logs** - check for anomalies
- [ ] **Review Stripe Dashboard** - verify all test payments

---

## Summary Report Template

**Smoke Test Date**: **\*\***\_**\*\***
**Tester**: **\*\***\_**\*\***
**Environment**: https://codesalvage.com
**Duration**: **\_** minutes

### Results

**Critical Issues** (blocking issues, must fix):

- [ ] None found ✅
- [ ] Issue 1: **\*\***\_**\*\***
- [ ] Issue 2: **\*\***\_**\*\***

**High Priority Issues** (should fix before launch):

- [ ] None found ✅
- [ ] Issue 1: **\*\***\_**\*\***
- [ ] Issue 2: **\*\***\_**\*\***

**Medium Priority Issues** (fix post-launch):

- [ ] None found ✅
- [ ] Issue 1: **\*\***\_**\*\***
- [ ] Issue 2: **\*\***\_**\*\***

**Overall Status**:

- [ ] ✅ **PASS** - Ready for launch
- [ ] ⚠️ **PASS WITH ISSUES** - Launch with monitoring
- [ ] ❌ **FAIL** - Do not launch, critical issues found

**Notes**:

---

---

---

**Smoke Testing Complete** ✅
**Next Step**: Cross-browser and mobile testing (see CROSS_BROWSER_TESTING_CHECKLIST.md)
