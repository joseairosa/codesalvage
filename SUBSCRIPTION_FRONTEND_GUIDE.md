# Subscription Frontend Implementation Guide

## Overview

Complete frontend implementation for Premium Seller Subscriptions (Sprint 9-10). Allows sellers to upgrade to Pro plan, manage subscriptions, and view benefits.

## Pages

### 1. Pricing Page `/pricing`

**Route**: [http://localhost:3011/pricing](http://localhost:3011/pricing)

**Access**: Public (anyone can view)

**Features**:
- Free vs Pro plan comparison
- Detailed benefits list for each tier
- Featured listing savings calculator
- FAQ section
- Dynamic CTA based on authentication state:
  - Not authenticated → "Sign In to Upgrade"
  - Authenticated but not seller → "Become a Seller"
  - Authenticated seller → "Upgrade to Pro"

**File**: `app/pricing/page.tsx`

### 2. Subscription Management `/seller/subscription`

**Route**: [http://localhost:3011/seller/subscription](http://localhost:3011/seller/subscription)

**Access**: Protected (sellers only)

**Features**:
- Current subscription status display
- Subscription benefits breakdown
- Upgrade/cancel functionality
- Billing portal access
- Next billing date display
- Cancellation notice (if applicable)

**File**: `app/seller/subscription/page.tsx`

## Components

### Client Components (Interactive)

#### 1. `UpgradeToProButton`

**Location**: `components/subscription/UpgradeToProButton.tsx`

**Functionality**:
- Creates Pro subscription via `/api/subscriptions` POST
- Integrates with Stripe for payment collection
- Shows loading state during processing
- Displays errors if subscription creation fails
- Redirects on success

**Usage**:
```tsx
import { UpgradeToProButton } from '@/components/subscription/UpgradeToProButton';

<UpgradeToProButton />
```

#### 2. `CancelSubscriptionButton`

**Location**: `components/subscription/CancelSubscriptionButton.tsx`

**Functionality**:
- Cancels Pro subscription via `/api/subscriptions` DELETE
- Shows confirmation dialog before canceling
- Explains what happens after cancellation
- Subscription continues until end of billing period

**Usage**:
```tsx
import { CancelSubscriptionButton } from '@/components/subscription/CancelSubscriptionButton';

<CancelSubscriptionButton />
```

#### 3. `BillingPortalButton`

**Location**: `components/subscription/BillingPortalButton.tsx`

**Functionality**:
- Opens Stripe Customer Portal via `/api/subscriptions/portal` POST
- Allows users to:
  - View/download invoices
  - Update payment methods
  - View billing history

**Usage**:
```tsx
import { BillingPortalButton } from '@/components/subscription/BillingPortalButton';

<BillingPortalButton />
```

### Server Components (Display)

#### 4. `SubscriptionBadge`

**Location**: `components/subscription/SubscriptionBadge.tsx`

**Functionality**:
- Displays subscription tier badge (Free/Pro)
- Pro badge includes crown icon
- Customizable styling

**Usage**:
```tsx
import { SubscriptionBadge } from '@/components/subscription/SubscriptionBadge';

<SubscriptionBadge plan="pro" showIcon={true} />
<SubscriptionBadge plan="free" />
```

## API Integration

All components use the following API endpoints:

### GET `/api/subscriptions`
- Fetch current subscription status
- Returns: `{ subscription: SubscriptionStatus }`

### POST `/api/subscriptions`
- Create new Pro subscription
- Body: `{ plan: 'pro', paymentMethodId?: string }`
- Returns: `{ subscription: { subscriptionId, clientSecret, ... } }`

### DELETE `/api/subscriptions`
- Cancel subscription (at end of period)
- Returns: `{ subscription: { status, cancelAtPeriodEnd, ... } }`

### POST `/api/subscriptions/portal`
- Generate Stripe billing portal URL
- Returns: `{ url: string }`

## Environment Variables

Required for client-side Stripe integration:

```bash
# .env.local
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

Also required (server-side):
```bash
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

## User Flow

### Free → Pro Upgrade Flow

1. User visits `/pricing` or `/seller/subscription`
2. Clicks "Upgrade to Pro" button
3. `UpgradeToProButton` calls `/api/subscriptions` POST
4. Backend:
   - Validates seller status
   - Creates/retrieves Stripe customer
   - Creates Stripe subscription
   - Stores subscription in database
5. Stripe Payment Intent created
6. Client confirms payment with Stripe
7. Page reloads showing Pro status

### Pro → Free Downgrade Flow

1. User visits `/seller/subscription`
2. Clicks "Cancel Subscription" button
3. Confirmation dialog explains consequences
4. `CancelSubscriptionButton` calls `/api/subscriptions` DELETE
5. Backend:
   - Updates Stripe subscription (`cancel_at_period_end = true`)
   - Updates database record
6. Page reloads showing "Canceling" notice
7. User retains Pro access until billing period ends
8. Webhook automatically downgrades to Free at period end

## Integration Points

### Navigation/Header

Add subscription badge to seller navigation:

```tsx
import { SubscriptionBadge } from '@/components/subscription/SubscriptionBadge';

// In navigation component
{session?.user?.isSeller && (
  <Link href="/seller/subscription">
    <SubscriptionBadge plan={subscriptionPlan} />
  </Link>
)}
```

### Seller Dashboard

Add quick link to subscription management:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Subscription</CardTitle>
  </CardHeader>
  <CardContent>
    <SubscriptionBadge plan={subscription.plan} />
    <Button asChild className="mt-4" variant="outline">
      <Link href="/seller/subscription">Manage Subscription</Link>
    </Button>
  </CardContent>
</Card>
```

### Project Creation

Show upgrade prompt when hitting free tier limit:

```tsx
// When API returns 403 with plan_limit error code
if (error.code === 'plan_limit') {
  return (
    <Alert>
      <AlertDescription>
        You've reached the 3-project limit on the Free plan.{' '}
        <Link href="/pricing" className="font-semibold underline">
          Upgrade to Pro
        </Link>{' '}
        for unlimited projects.
      </AlertDescription>
    </Alert>
  );
}
```

## Testing Checklist

### Manual Testing

- [ ] Pricing page renders for unauthenticated users
- [ ] Pricing page shows correct CTAs for sellers
- [ ] Subscription page redirects non-sellers
- [ ] Upgrade button creates subscription successfully
- [ ] Payment flow completes with test card
- [ ] Subscription status updates after upgrade
- [ ] Cancel button shows confirmation dialog
- [ ] Cancellation sets `cancelAtPeriodEnd` flag
- [ ] Billing portal button opens Stripe portal
- [ ] Featured listing discount applied for Pro users
- [ ] Project limit enforced for free tier
- [ ] Pro users can create unlimited projects

### Test Cards (Stripe)

```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
3D Secure: 4000 0025 0000 3155
```

Use any future expiry date and any 3-digit CVC.

## Known Limitations

1. **No Trial Period**: Immediate billing on upgrade (can be added later)
2. **No Proration**: Simplified billing without mid-cycle proration
3. **Single Plan**: Only Free and Pro tiers (no Enterprise/Custom)
4. **No Annual Billing**: Only monthly subscriptions supported
5. **Stripe Elements**: Uses confirmCardPayment (could use Checkout for full-page)

## Future Enhancements

1. **7-Day Free Trial**: Add trial period for new Pro subscribers
2. **Annual Plan**: Offer annual billing with discount (e.g., $99/year, save 17%)
3. **Team Plans**: Multi-seller accounts for agencies
4. **Usage-Based Billing**: Charge per transaction instead of flat fee
5. **Granular Permissions**: Different feature tiers beyond binary Free/Pro
6. **Onboarding Flow**: Guided tour after upgrade showing new features
7. **Referral Credits**: Give credits for referring other sellers

## Support

For issues or questions about the subscription frontend:
- Backend API documentation: `lib/services/SUBSCRIPTIONS_IMPLEMENTATION_COMPLETE.md`
- Stripe webhook handling: `app/api/webhooks/stripe/route.ts`
- Service logic: `lib/services/SubscriptionService.ts`

---

**Last Updated**: January 26, 2026
**Sprint**: 9-10 (Analytics & Premium Features)
**Status**: ✅ Complete
