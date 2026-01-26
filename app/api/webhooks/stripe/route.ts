/**
 * Stripe Webhook Handler
 *
 * Handles Stripe webhook events for payment processing.
 * Updates transaction status based on payment events.
 *
 * POST /api/webhooks/stripe
 *
 * Webhook Events:
 * - payment_intent.succeeded - Payment completed
 * - payment_intent.payment_failed - Payment failed
 * - charge.refunded - Payment refunded
 * - account.updated - Seller account updated
 *
 * @example
 * Configured in Stripe Dashboard:
 * https://dashboard.stripe.com/webhooks
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { emailService } from '@/lib/services';
import { env } from '@/config/env';
import type Stripe from 'stripe';

const componentName = 'StripeWebhook';

/**
 * POST /api/webhooks/stripe
 *
 * Handle Stripe webhook events
 */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = headers().get('stripe-signature');

  if (!signature) {
    console.error('[Stripe Webhook] No signature provided');
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.error('[Stripe Webhook] No webhook secret configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err);
    return NextResponse.json(
      { error: `Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 400 }
    );
  }

  console.log(`[${componentName}] Event received:`, event.type);

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.refunded':
        await handleRefund(event.data.object as Stripe.Charge);
        break;

      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      default:
        console.log(`[${componentName}] Unhandled event type:`, event.type);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error(`[${componentName}] Error handling webhook:`, error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle payment_intent.succeeded event
 *
 * Called when buyer's payment is successfully processed.
 * Updates transaction status and marks project as sold.
 */
async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log(`[${componentName}] Payment succeeded:`, paymentIntent.id);

  const transactionId = paymentIntent.metadata.transactionId;

  if (!transactionId) {
    console.error(`[${componentName}] No transaction ID in metadata`);
    return;
  }

  // Update transaction status and fetch buyer/seller info
  const transaction = await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      paymentStatus: 'succeeded',
      escrowStatus: 'held',
      stripeChargeId: paymentIntent.latest_charge as string,
    },
    include: {
      project: true,
      buyer: {
        select: {
          id: true,
          email: true,
          fullName: true,
          username: true,
        },
      },
      seller: {
        select: {
          id: true,
          email: true,
          fullName: true,
          username: true,
        },
      },
    },
  });

  console.log(`[${componentName}] Transaction updated:`, transaction.id);

  // Mark project as sold
  await prisma.project.update({
    where: { id: transaction.projectId },
    data: {
      status: 'sold',
    },
  });

  console.log(`[${componentName}] Project marked as sold:`, transaction.projectId);

  // Send email notifications
  const appUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3011';
  const downloadUrl = `${appUrl}/projects/${transaction.projectId}/download`;

  const emailData = {
    buyerName: transaction.buyer.fullName || transaction.buyer.username,
    sellerName: transaction.seller.fullName || transaction.seller.username,
    projectTitle: transaction.project.title,
    projectId: transaction.projectId,
    transactionId: transaction.id,
    amount: transaction.amountCents,
    downloadUrl,
    purchaseDate: new Date().toISOString(),
  };

  try {
    // Send confirmation to buyer
    await emailService.sendBuyerPurchaseConfirmation(
      {
        email: transaction.buyer.email!,
        name: emailData.buyerName,
      },
      emailData
    );

    // Send notification to seller
    await emailService.sendSellerPurchaseNotification(
      {
        email: transaction.seller.email!,
        name: emailData.sellerName,
      },
      emailData
    );

    console.log(`[${componentName}] Email notifications sent successfully`);
  } catch (emailError) {
    console.error(`[${componentName}] Failed to send email notifications:`, emailError);
    // Don't fail the webhook if email fails
  }
}

/**
 * Handle payment_intent.payment_failed event
 *
 * Called when payment fails.
 * Updates transaction status.
 */
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log(`[${componentName}] Payment failed:`, paymentIntent.id);

  const transactionId = paymentIntent.metadata.transactionId;

  if (!transactionId) {
    console.error(`[${componentName}] No transaction ID in metadata`);
    return;
  }

  // Update transaction status
  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      paymentStatus: 'failed',
    },
  });

  console.log(`[${componentName}] Transaction marked as failed:`, transactionId);

  // TODO: Send email notification to buyer (Sprint 8)
}

/**
 * Handle charge.refunded event
 *
 * Called when a charge is refunded.
 * Updates transaction status.
 */
async function handleRefund(charge: Stripe.Charge) {
  console.log(`[${componentName}] Charge refunded:`, charge.id);

  // Find transaction by charge ID
  const transaction = await prisma.transaction.findFirst({
    where: { stripeChargeId: charge.id },
  });

  if (!transaction) {
    console.error(`[${componentName}] Transaction not found for charge:`, charge.id);
    return;
  }

  // Update transaction status
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      paymentStatus: 'refunded',
      escrowStatus: 'disputed',
    },
  });

  console.log(`[${componentName}] Transaction marked as refunded:`, transaction.id);

  // TODO: Send email notifications (Sprint 8)
  // - Notify buyer of refund
  // - Notify seller
}

/**
 * Handle account.updated event
 *
 * Called when a Stripe Connect account is updated.
 * Updates seller verification status.
 */
async function handleAccountUpdated(account: Stripe.Account) {
  console.log(`[${componentName}] Account updated:`, account.id);

  const userId = account.metadata?.userId;

  if (!userId) {
    console.error(`[${componentName}] No user ID in account metadata`);
    return;
  }

  // Check if account is fully onboarded
  const isOnboarded = account.charges_enabled && account.details_submitted;

  // Update user's verification status
  await prisma.user.update({
    where: { id: userId },
    data: {
      isVerifiedSeller: isOnboarded,
    },
  });

  console.log(`[${componentName}] User verification updated:`, {
    userId,
    isVerifiedSeller: isOnboarded,
  });
}
