# Featured Listings - Stripe Payment Integration

Complete implementation of Stripe payment processing for featured listing purchases.

---

## Overview

Sellers can purchase featured placement for their projects using Stripe. The payment flow follows the existing transaction payment pattern with proper webhook confirmation.

---

## Payment Flow

### 1. **Create Payment Intent**

```
POST /api/featured/create-payment-intent
Body: { projectId: "project123", durationDays: 7 }
```

**What happens:**

- Validates seller authentication and permissions
- Validates project ownership and status
- Calculates cost based on duration (7/14/30 days)
- Creates Stripe Payment Intent with metadata
- Returns `clientSecret` for Stripe Elements

**Does NOT immediately set featured status** - waits for webhook confirmation.

### 2. **User Completes Payment**

Frontend uses Stripe Elements with `clientSecret` to collect payment.

### 3. **Webhook Confirms Payment**

```
POST /api/webhooks/stripe
Event: payment_intent.succeeded
```

**What happens:**

- Stripe sends `payment_intent.succeeded` event
- Webhook checks `metadata.featuredListingPurchase === 'true'`
- Calls `featuredListingService.purchaseFeaturedPlacement()`
- Sets `isFeatured = true` and `featuredUntil = now + durationDays`
- Logs success (email notification TODO)

---

## API Endpoints

### **POST /api/featured/create-payment-intent**

Creates Stripe Payment Intent for featured listing purchase.

**Authentication:** Required (seller only)

**Request Body:**

```typescript
{
  projectId: string; // Project to feature
  durationDays: number; // Must be 7, 14, or 30
}
```

**Response (201):**

```typescript
{
  clientSecret: string; // For Stripe Elements
  paymentIntentId: string; // Stripe Payment Intent ID
  amount: number; // Cost in cents
  durationDays: number; // Duration purchased
  projectId: string; // Project ID
}
```

**Validation Rules:**

- User must be authenticated
- User must be a seller (`isSeller === true`)
- User must own the project
- Project must be active (`status === 'active'`)
- Duration must be 7, 14, or 30 days

**Error Responses:**

- `401` - Unauthorized (no session)
- `403` - Forbidden (not a seller, or not project owner)
- `404` - Project not found
- `400` - Validation error (invalid duration, inactive project)
- `500` - Server error (Stripe error, etc.)

**Example:**

```bash
curl -X POST http://localhost:3011/api/featured/create-payment-intent \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=..." \
  -d '{
    "projectId": "cm88n2t8i000408lef7gh2pwr",
    "durationDays": 7
  }'
```

---

### **POST /api/featured** (DEPRECATED)

⚠️ **ADMIN/INTERNAL USE ONLY** ⚠️

Manually sets project as featured WITHOUT payment.

**Use cases:**

- Promotional featured placements
- Refunds/compensations
- Testing

**Should be restricted to admin users in production.**

Regular sellers should use `POST /api/featured/create-payment-intent`.

---

### **POST /api/webhooks/stripe**

Handles Stripe webhook events, including featured listing payments.

**Event Handling:**

- `payment_intent.succeeded` - Confirms payment and sets featured status
- `payment_intent.payment_failed` - Logs failure (no featured status set)

**Metadata Required:**

```typescript
{
  featuredListingPurchase: 'true',  // Identifies featured listing
  projectId: string,                // Project to feature
  sellerId: string,                 // Seller ID
  durationDays: string,             // Duration (as string)
  costCents: string,                // Cost (as string)
}
```

---

## Pricing Tiers

| Duration | Cost (USD) | Cost (Cents) |
| -------- | ---------- | ------------ |
| 7 days   | $29.99     | 2999         |
| 14 days  | $49.99     | 4999         |
| 30 days  | $79.99     | 7999         |

**Note:** Pricing is defined in `FeaturedListingService.getFeaturedPricing()`.

---

## Database Changes

**No new tables required.** Featured status is stored in existing `projects` table:

```prisma
model Project {
  // ...
  isFeatured      Boolean   @default(false)
  featuredUntil   DateTime?
  // ...
}
```

**How it works:**

1. Payment Intent created - project not yet featured
2. Payment succeeds - webhook sets `isFeatured = true`, `featuredUntil = now + duration`
3. Cron job runs hourly - unfeatures expired projects (`featuredUntil <= now`)

---

## Stripe Payment Intent Metadata

**Transaction Purchases** (existing):

```typescript
{
  transactionId: string,
  projectId: string,
  sellerId: string,
  buyerId: string,
  commissionCents: string,
  sellerReceivesCents: string,
}
```

**Featured Listing Purchases** (new):

```typescript
{
  featuredListingPurchase: 'true',  // ← Distinguishes from transactions
  projectId: string,
  sellerId: string,
  durationDays: string,
  costCents: string,
}
```

The webhook handler checks `metadata.featuredListingPurchase === 'true'` to determine payment type.

---

## Security Considerations

### **Authorization**

- Only sellers can purchase featured placements
- Sellers can only feature their own projects
- Payment Intent metadata immutable (signed by Stripe)

### **Validation**

- Project must be active (not draft, not sold)
- Duration must be valid (7, 14, or 30 days)
- Double-purchase prevention handled by webhook idempotency

### **Webhook Verification**

- Stripe signature verification via `stripe.webhooks.constructEvent()`
- `STRIPE_WEBHOOK_SECRET` must be configured
- Webhook returns 200 even if processing fails (Stripe retry logic)

---

## Testing

### **Manual Testing (Test Mode)**

1. **Create Payment Intent:**

```bash
curl -X POST http://localhost:3011/api/featured/create-payment-intent \
  -H "Content-Type: application/json" \
  -H "Cookie: authjs.session-token=..." \
  -d '{"projectId": "project123", "durationDays": 7}'
```

2. **Use Stripe Test Card:**

- Card: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits

3. **Verify in Stripe Dashboard:**

- Check Payment Intent created
- Check webhook event `payment_intent.succeeded` sent

4. **Verify Database:**

```sql
SELECT id, title, isFeatured, featuredUntil
FROM projects
WHERE id = 'project123';
```

### **Webhook Testing (Local)**

Use Stripe CLI to forward webhooks:

```bash
stripe listen --forward-to http://localhost:3011/api/webhooks/stripe
```

Get webhook signing secret:

```bash
stripe listen --print-secret
```

Add to `.env.local`:

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

Trigger test event:

```bash
stripe trigger payment_intent.succeeded
```

---

## Error Handling

### **Payment Intent Creation Errors**

| Error Type        | HTTP Status | Example              |
| ----------------- | ----------- | -------------------- |
| Not authenticated | 401         | No session           |
| Not a seller      | 403         | `isSeller === false` |
| Not project owner | 403         | Different seller ID  |
| Project not found | 404         | Invalid project ID   |
| Invalid duration  | 400         | `durationDays = 5`   |
| Inactive project  | 400         | `status = 'draft'`   |
| Stripe card error | 400         | Card declined        |
| Stripe API error  | 400/500     | Network error        |

### **Webhook Processing Errors**

- Logged to console but **do not** fail webhook (return 200)
- Stripe retries webhooks automatically if non-200 returned
- Check logs for `[StripeWebhook] Failed to process featured listing payment`

---

## Email Notifications ✅

### **Implemented Email Types**

Three email notification types are now fully implemented in [lib/services/EmailService.ts](../../../lib/services/EmailService.ts):

#### 1. **Featured Listing Confirmation** (Immediate)

**Status:** ✅ Implemented and active

**Triggered by:** `handleFeaturedListingPayment()` in webhook handler after payment succeeds

**Recipient:** Seller who purchased featured placement

**Template includes:**

- Project title and featured duration (7/14/30 days)
- Amount paid ($29.99/$49.99/$79.99)
- Featured until date/time
- Benefits of featured placement:
  - Homepage carousel display
  - Featured badge in search results
  - Priority sorting
  - Up to 5x more views
- Tips to maximize featured period
- Call-to-action button to view project

**Code example:**

```typescript
await emailService.sendFeaturedListingConfirmation(
  { email: seller.email, name: seller.fullName },
  {
    sellerName: seller.fullName,
    projectTitle: project.title,
    projectId: project.id,
    durationDays: 7,
    costCents: 2999,
    featuredUntil: '2026-02-02T10:00:00.000Z',
    projectUrl: 'https://app.com/projects/project123',
  }
);
```

#### 2. **Featured Listing Expiration Warning** (3 Days Before)

**Status:** ✅ Implemented, ⏳ Cron trigger pending

**When to send:** 3 days before `featuredUntil` date

**Recipient:** Seller whose featured listing is expiring soon

**Template includes:**

- Expiration date/time reminder
- Warning banner (yellow) with expiration countdown
- Call-to-action to extend featured period
- Explanation of what happens after expiration
- Link to project page to renew

**Implementation:**

```typescript
// TODO: Add to cron job (see Future Enhancements)
await emailService.sendFeaturedListingExpirationWarning(
  { email: seller.email, name: seller.fullName },
  {
    sellerName: seller.fullName,
    projectTitle: project.title,
    projectId: project.id,
    durationDays: 7,
    costCents: 2999,
    featuredUntil: '2026-02-02T10:00:00.000Z',
    projectUrl: 'https://app.com/projects/project123',
  }
);
```

#### 3. **Featured Listing Expired** (At Expiration)

**Status:** ✅ Implemented, ⏳ Cron trigger pending

**When to send:** When featured period ends (via cleanup cron job)

**Recipient:** Seller whose featured listing just expired

**Template includes:**

- Expiration confirmation
- Featured period summary (duration, cost)
- Expired date
- Call-to-action to feature again
- Benefits reminder
- Link to re-purchase featured placement

**Implementation:**

```typescript
// TODO: Add to cleanup-featured cron job
await emailService.sendFeaturedListingExpired(
  { email: seller.email, name: seller.fullName },
  {
    sellerName: seller.fullName,
    projectTitle: project.title,
    projectId: project.id,
    durationDays: 7,
    costCents: 2999,
    featuredUntil: '2026-02-02T10:00:00.000Z',
    projectUrl: 'https://app.com/projects/project123',
  }
);
```

### **Email Template Features**

All emails include:

- **HTML version:** Styled with inline CSS, responsive design
- **Plain text version:** Clean fallback for email clients
- **Branded headers:** Color-coded by email type:
  - Confirmation: Purple (#8b5cf6)
  - Warning: Orange (#f59e0b)
  - Expired: Gray (#6b7280)
- **Clear CTAs:** Prominent action buttons
- **Highlighted details:** Important info in styled boxes
- **Footer:** Links to dashboard and homepage

### **Testing Email Notifications**

**Development mode (no SENDGRID_API_KEY):**

```bash
# Emails are logged to console
[EmailService] Email would be sent (dev mode):
  to: seller@example.com
  subject: Featured Listing Confirmed - My Project
```

**With SendGrid configured:**

```bash
# Set environment variable
export SENDGRID_API_KEY="SG.xxx"
export SENDGRID_FROM_EMAIL="noreply@codesalvage.com"

# Trigger webhook with test payment
stripe trigger payment_intent.succeeded
```

---

## Cron Job Integration

**Existing:** `/api/cron/cleanup-featured`

Runs every 1 hour to unfeature expired projects.

**How it works:**

1. Finds projects where `isFeatured = true` AND `featuredUntil <= now`
2. Sets `isFeatured = false` for expired projects
3. Logs unfeatured projects

**Setup:**
See [app/api/cron/README.md](../cron/README.md) for Railway/Vercel/external cron setup.

---

## Frontend Integration (TODO)

**Required UI components:**

1. **Featured Listing Purchase Button** (Seller Dashboard)
   - Shows pricing tiers (7/14/30 days)
   - Calls `POST /api/featured/create-payment-intent`
   - Renders Stripe Elements with `clientSecret`

2. **Featured Badge** (Project Cards)
   - Shows "Featured" badge if `isFeatured === true`
   - Highlight featured projects in search results

3. **Featured Carousel** (Homepage)
   - Fetches `GET /api/featured?limit=10`
   - Displays featured projects in carousel/grid

4. **Featured Status Indicator** (Seller Dashboard)
   - Shows if project is currently featured
   - Shows `featuredUntil` date
   - "Extend Featured" button (creates new payment intent)

---

## Architecture Diagram

```
┌─────────────────┐
│  Seller clicks  │
│ "Feature Project"│
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ POST /api/featured/create-      │
│ payment-intent                  │
│                                 │
│ - Validates seller              │
│ - Validates project             │
│ - Calculates cost               │
│ - Creates Payment Intent        │
└────────┬────────────────────────┘
         │
         ▼ Returns clientSecret
┌─────────────────┐
│ Stripe Elements │
│ (Frontend)      │
│                 │
│ - Collect card  │
│ - Submit payment│
└────────┬────────┘
         │
         ▼ Payment succeeds
┌─────────────────────────────────┐
│ Stripe sends webhook:           │
│ payment_intent.succeeded        │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ POST /api/webhooks/stripe       │
│                                 │
│ - Verify signature              │
│ - Check metadata                │
│ - Call service to set featured  │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ FeaturedListingService          │
│ .purchaseFeaturedPlacement()    │
│                                 │
│ - Set isFeatured = true         │
│ - Set featuredUntil = now + days│
│ - Update database               │
└─────────────────────────────────┘
```

---

## Files Modified/Created

### **Created:**

- `app/api/featured/create-payment-intent/route.ts` - Payment Intent endpoint
- `app/api/featured/PAYMENT_INTEGRATION.md` - This documentation

### **Modified:**

- `app/api/webhooks/stripe/route.ts` - Added featured listing payment handling
- `app/api/featured/route.ts` - Deprecated POST endpoint (marked as admin-only)

### **No Changes Required:**

- `lib/services/FeaturedListingService.ts` - Already has `purchaseFeaturedPlacement()`
- `lib/repositories/FeaturedListingRepository.ts` - Already has `setFeatured()`
- Database schema - Uses existing `projects.isFeatured` and `projects.featuredUntil`

---

## Deployment Checklist

Before deploying to production:

- [ ] `STRIPE_SECRET_KEY` configured (live mode)
- [ ] `STRIPE_WEBHOOK_SECRET` configured (live mode webhook)
- [ ] Stripe webhook endpoint registered: `https://your-app.com/api/webhooks/stripe`
- [ ] Webhook events enabled: `payment_intent.succeeded`, `payment_intent.payment_failed`
- [ ] Test payment flow in test mode first
- [ ] Verify cron job running for cleanup
- [ ] Add admin restriction to `POST /api/featured` (or remove endpoint)
- [ ] Add email notifications for featured listing confirmations
- [ ] Monitor webhook logs for errors

---

## Monitoring

### **Key Metrics to Track:**

1. **Payment Intent Creation Rate**
   - How many sellers attempt to purchase featured placements?

2. **Payment Success Rate**
   - `payment_intent.succeeded` / `payment_intent.created`
   - Target: >95%

3. **Webhook Processing Rate**
   - Check for webhook failures in logs
   - Stripe Dashboard → Webhooks → View events

4. **Featured Listings Revenue**
   - Sum of all successful featured listing payments
   - Query Stripe: `metadata.featuredListingPurchase: 'true'`

5. **Active Featured Projects**
   - `SELECT COUNT(*) FROM projects WHERE isFeatured = true AND featuredUntil > now()`

### **Logs to Monitor:**

```bash
# Payment Intent creation
[FeaturedPaymentIntentAPI] Creating payment intent for featured listing

# Webhook processing
[StripeWebhook] Featured listing payment succeeded
[StripeWebhook] Project featured successfully

# Errors
[StripeWebhook] Failed to process featured listing payment
[FeaturedPaymentIntentAPI] Error creating payment intent
```

---

## Future Enhancements

1. **Email Notifications**
   - Confirmation after purchase
   - 3-day expiration warning
   - Expiration notification

2. **Analytics Dashboard** (Seller)
   - Featured listing performance
   - Views/favorites while featured
   - ROI calculation

3. **Automatic Renewal**
   - Sellers can enable auto-renewal
   - Charge saved payment method before expiration

4. **Discounts & Promotions**
   - Promo codes for featured placements
   - Volume discounts (buy 30 days, get 3 free)
   - First-time featured discount

5. **Featured Placement Queue**
   - Limited featured slots (e.g., max 10 featured projects)
   - Queue system if slots full

6. **Refund Handling**
   - Partial refunds for unused days
   - Automatic unfeaturing if refunded

---

## Support & Troubleshooting

### **Payment failed but webhook not received**

**Check:**

1. Stripe Dashboard → Webhooks → Check event sent
2. Webhook endpoint responding (check Railway/Vercel logs)
3. `STRIPE_WEBHOOK_SECRET` matches Stripe Dashboard

**Fix:**

- Retry webhook from Stripe Dashboard
- Or manually feature project via `POST /api/featured` (admin)

### **Project not featured after payment succeeded**

**Check:**

1. Webhook event logs: `[StripeWebhook] Featured listing payment succeeded`
2. Database: `SELECT isFeatured, featuredUntil FROM projects WHERE id = '...'`

**Fix:**

- Check webhook logs for errors
- Manually feature via `POST /api/featured` if needed

### **Stripe webhook signature verification failed**

**Error:** `Webhook Error: No signatures found matching the expected signature`

**Fix:**

- Verify `STRIPE_WEBHOOK_SECRET` in environment variables
- Check Stripe Dashboard → Webhooks → Signing secret matches
- Ensure webhook endpoint URL is correct

---

**Last Updated:** January 26, 2026
**Status:** ✅ Complete - Payment integration functional, email notifications pending
