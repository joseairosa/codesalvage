---
name: stripe-webhooks
description: |
  Stripe webhook signature verification and event handling pattern. Use when:
  (1) adding new Stripe webhook endpoints, (2) debugging "webhook signature
  verification failed" errors, (3) implementing payment event processing.
  Key: read body as text (not JSON), use stripe.webhooks.constructEvent() for
  signature verification, handle events in switch statement.
author: Claude Code
version: 1.0.0
---

# Stripe Webhook Handler Pattern

## Problem

Stripe webhooks require signature verification to ensure events are authentic. Incorrect implementation leads to:

- "Webhook signature verification failed" errors
- Security vulnerabilities (processing fake events)
- Payment processing failures

## Trigger Conditions

Use this pattern when:

- Creating new Stripe webhook endpoints
- Debugging signature verification failures
- Implementing payment event handlers (payment_intent, subscription, invoice, etc.)
- User reports payments not processing or webhook errors

## Critical Pattern

**❌ Common mistakes:**

- Parsing body as JSON before verification → Signature fails
- Not reading stripe-signature header → Signature fails
- Returning wrong status codes → Stripe retries unnecessarily

**✅ Correct implementation:**

```typescript
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import type Stripe from 'stripe';

export async function POST(request: Request) {
  // 1. Read body as TEXT (NOT JSON)
  const body = await request.text();

  // 2. Get signature from headers
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // 3. Verify signature (will throw if invalid)
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // 4. Handle event types
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      default:
        console.log('[Stripe Webhook] Unhandled event type:', event.type);
    }

    // 5. Return 200 (tells Stripe webhook succeeded)
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[Stripe Webhook] Error handling webhook:', error);
    // Return 500 (Stripe will retry)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
```

## Key Rules

1. **Body as text**: `await request.text()` NOT `await request.json()`
2. **Signature header**: Get `stripe-signature` from headers
3. **constructEvent()**: Use `stripe.webhooks.constructEvent(body, signature, secret)`
4. **Status codes**:
   - `400` → Signature verification failed (Stripe won't retry)
   - `200` → Event processed successfully
   - `500` → Handler error (Stripe will retry)

## Environment Variables

```bash
# Webhook secret from Stripe Dashboard → Webhooks
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Get the secret:**

1. Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Copy "Signing secret" (starts with `whsec_`)

## Event Handler Pattern

```typescript
async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('[Stripe] Payment succeeded:', paymentIntent.id);

  // Get metadata (set when creating PaymentIntent)
  const transactionId = paymentIntent.metadata['transactionId'];
  const userId = paymentIntent.metadata['userId'];

  // Update database
  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      paymentStatus: 'succeeded',
      stripePaymentIntentId: paymentIntent.id,
    },
  });

  // Send notification email
  await emailService.sendPaymentConfirmation(...);
}
```

## Common Event Types

| Event                           | When It Fires          | Typical Action                               |
| ------------------------------- | ---------------------- | -------------------------------------------- |
| `payment_intent.succeeded`      | Payment completed      | Update transaction to succeeded, send emails |
| `payment_intent.payment_failed` | Payment failed         | Update transaction to failed, notify user    |
| `charge.refunded`               | Refund processed       | Update transaction, notify seller            |
| `customer.subscription.created` | Subscription starts    | Create subscription record                   |
| `customer.subscription.updated` | Subscription changed   | Update subscription status                   |
| `customer.subscription.deleted` | Subscription canceled  | Mark subscription inactive                   |
| `invoice.payment_succeeded`     | Monthly renewal paid   | Update subscription, send receipt            |
| `invoice.payment_failed`        | Renewal payment failed | Update status, send dunning email            |

## Verification

**Test webhook locally:**

```bash
# Install Stripe CLI
brew install stripe/stripe-brew/stripe

# Login
stripe login

# Forward webhooks to local dev
stripe listen --forward-to localhost:3011/api/webhooks/stripe

# Trigger test event
stripe trigger payment_intent.succeeded
```

**Check logs:**

```typescript
console.log('[Stripe Webhook] Event received:', event.type);
console.log('[Stripe Webhook] Metadata:', event.data.object.metadata);
```

**Verify in Stripe Dashboard:**

- Go to Webhooks → Your endpoint
- Check "Recent deliveries" for status codes
- 200 = success, 400/500 = failed

## Debugging

**Error: "No signatures found matching the expected signature"**

- Check `STRIPE_WEBHOOK_SECRET` is correct
- Verify using `whsec_` secret (not API key)
- Ensure body read as text, not JSON

**Error: "Webhook signature verification failed"**

- Body was modified before verification
- Using wrong secret (test vs live mode)
- Reading `request.json()` instead of `request.text()`

**Events not processing:**

- Check webhook endpoint URL in Stripe Dashboard
- Verify endpoint returns 200 status
- Check handler errors in console logs

## References

- Stripe webhooks docs: https://stripe.com/docs/webhooks
- Event types: https://stripe.com/docs/api/events/types
- Local testing: https://stripe.com/docs/webhooks/test
- Implementation: `app/api/webhooks/stripe/route.ts`

## Example

**Full webhook endpoint:**

See `app/api/webhooks/stripe/route.ts` for complete implementation with:

- Transaction payment processing
- Subscription lifecycle handling
- Featured listing purchases
- Email notifications
- Error handling
