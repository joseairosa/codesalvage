/**
 * Stripe Webhook Handler
 *
 * Handles Stripe webhook events for payment processing and subscriptions.
 * Updates transaction status, subscription status, and featured listings based on events.
 *
 * POST /api/webhooks/stripe
 *
 * Webhook Events:
 * - payment_intent.succeeded - Payment completed (transactions + featured listings)
 * - payment_intent.payment_failed - Payment failed
 * - charge.refunded - Payment refunded
 * - account.updated - Seller account updated
 * - customer.subscription.created - Subscription created
 * - customer.subscription.updated - Subscription status changed
 * - customer.subscription.deleted - Subscription canceled immediately
 * - invoice.payment_succeeded - Subscription invoice paid (monthly renewal)
 * - invoice.payment_failed - Subscription invoice payment failed
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
import { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import { FeaturedListingRepository } from '@/lib/repositories/FeaturedListingRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { SubscriptionRepository } from '@/lib/repositories/SubscriptionRepository';
import { FeaturedListingService } from '@/lib/services/FeaturedListingService';
import { SubscriptionService } from '@/lib/services/SubscriptionService';
import type Stripe from 'stripe';

const componentName = 'StripeWebhook';

// Initialize repositories
const transactionRepository = new TransactionRepository(prisma);
const featuredListingRepository = new FeaturedListingRepository(prisma);
const projectRepository = new ProjectRepository(prisma);
const userRepository = new UserRepository(prisma);
const subscriptionRepository = new SubscriptionRepository(prisma);
const subscriptionService = new SubscriptionService(subscriptionRepository, userRepository);
const featuredListingService = new FeaturedListingService(
  featuredListingRepository,
  projectRepository,
  userRepository,
  subscriptionService
);

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

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
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
 * Called when payment is successfully processed.
 * Handles both:
 * - Project purchase transactions (buyer purchasing project)
 * - Featured listing purchases (seller purchasing featured placement)
 */
async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log(`[${componentName}] Payment succeeded:`, paymentIntent.id);

  // Check if this is a featured listing purchase
  const isFeaturedListingPurchase = paymentIntent.metadata.featuredListingPurchase === 'true';

  if (isFeaturedListingPurchase) {
    await handleFeaturedListingPayment(paymentIntent);
    return;
  }

  // Otherwise, handle as regular transaction
  const transactionId = paymentIntent.metadata.transactionId;

  if (!transactionId) {
    console.error(`[${componentName}] No transaction ID in metadata`);
    return;
  }

  // Update transaction payment status to succeeded
  await transactionRepository.updatePaymentStatus(
    transactionId,
    'succeeded',
    paymentIntent.id,
    paymentIntent.latest_charge as string
  );

  // Update escrow status to held
  await transactionRepository.updateEscrowStatus(transactionId, 'held');

  console.log(`[${componentName}] Transaction updated to succeeded with escrow held:`, transactionId);

  // Fetch transaction details for email notifications
  const transaction = await transactionRepository.findById(transactionId);

  if (!transaction) {
    console.error(`[${componentName}] Transaction not found after update:`, transactionId);
    return;
  }

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

  // Update transaction payment status to failed using repository
  await transactionRepository.updatePaymentStatus(
    transactionId,
    'failed',
    paymentIntent.id
  );

  console.log(`[${componentName}] Transaction marked as failed:`, transactionId);

  // TODO: Send email notification to buyer about payment failure
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

/**
 * Handle featured listing payment success
 *
 * Called when seller's payment for featured placement is successful.
 * Sets project as featured for the purchased duration.
 */
async function handleFeaturedListingPayment(paymentIntent: Stripe.PaymentIntent) {
  console.log(`[${componentName}] Featured listing payment succeeded:`, paymentIntent.id);

  const { projectId, sellerId, durationDays, costCents } = paymentIntent.metadata;

  if (!projectId || !sellerId || !durationDays) {
    console.error(`[${componentName}] Missing metadata for featured listing:`, {
      projectId,
      sellerId,
      durationDays,
    });
    return;
  }

  const durationDaysNum = parseInt(durationDays, 10);

  try {
    // Set project as featured using the service
    const result = await featuredListingService.purchaseFeaturedPlacement(sellerId, {
      projectId,
      durationDays: durationDaysNum,
    });

    console.log(`[${componentName}] Project featured successfully:`, {
      projectId,
      featuredUntil: result.featuredUntil,
    });

    // Fetch project and seller details for email
    const project = await projectRepository.findById(projectId);
    const seller = await userRepository.findById(sellerId);

    if (!project || !seller) {
      console.error(`[${componentName}] Project or seller not found for email notification`);
      return;
    }

    // Send confirmation email to seller
    try {
      const appUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3011';
      await emailService.sendFeaturedListingConfirmation(
        {
          email: seller.email!,
          name: seller.fullName || seller.username,
        },
        {
          sellerName: seller.fullName || seller.username,
          projectTitle: project.title,
          projectId: project.id,
          durationDays: durationDaysNum,
          costCents: parseInt(costCents || '0', 10),
          featuredUntil: result.featuredUntil,
          projectUrl: `${appUrl}/projects/${project.id}`,
        }
      );

      console.log(`[${componentName}] Featured listing confirmation email sent to seller`);
    } catch (emailError) {
      console.error(`[${componentName}] Failed to send featured listing email:`, emailError);
      // Don't fail webhook if email fails
    }

    console.log(`[${componentName}] Featured listing payment processed successfully`);
  } catch (error) {
    console.error(`[${componentName}] Failed to process featured listing payment:`, error);
    // Don't throw - webhook should still return 200 to Stripe
  }
}

/**
 * Handle customer.subscription.created event
 *
 * Called when a subscription is created.
 * Note: The subscription is already created in the database by the API route,
 * this handler is mainly for logging and validation.
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log(`[${componentName}] Subscription created:`, subscription.id);

  try {
    // Update subscription status from webhook (in case of timing issues)
    await subscriptionService.updateFromWebhook(
      subscription.id,
      subscription.status,
      new Date(subscription.current_period_start * 1000),
      new Date(subscription.current_period_end * 1000)
    );

    console.log(`[${componentName}] Subscription creation confirmed via webhook:`, subscription.id);
  } catch (error) {
    console.error(`[${componentName}] Failed to update subscription on creation:`, error);
    // Don't throw - webhook should still return 200 to Stripe
  }
}

/**
 * Handle customer.subscription.updated event
 *
 * Called when subscription status changes (active, past_due, canceled, etc.)
 * or when billing cycle renews.
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log(`[${componentName}] Subscription updated:`, {
    id: subscription.id,
    status: subscription.status,
  });

  try {
    // Update subscription with new status and period
    await subscriptionService.updateFromWebhook(
      subscription.id,
      subscription.status,
      new Date(subscription.current_period_start * 1000),
      new Date(subscription.current_period_end * 1000)
    );

    console.log(`[${componentName}] Subscription updated successfully:`, subscription.id);
  } catch (error) {
    console.error(`[${componentName}] Failed to update subscription:`, error);
    // Don't throw - webhook should still return 200 to Stripe
  }
}

/**
 * Handle customer.subscription.deleted event
 *
 * Called when subscription is canceled immediately (not at period end).
 * This happens when payment fails repeatedly or admin cancels.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log(`[${componentName}] Subscription deleted:`, subscription.id);

  try {
    // Cancel subscription immediately in database
    await subscriptionService.cancelImmediately(subscription.id);

    console.log(`[${componentName}] Subscription canceled immediately:`, subscription.id);
  } catch (error) {
    console.error(`[${componentName}] Failed to cancel subscription:`, error);
    // Don't throw - webhook should still return 200 to Stripe
  }
}

/**
 * Handle invoice.payment_succeeded event
 *
 * Called when subscription invoice payment succeeds (monthly billing).
 * Subscription remains active.
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log(`[${componentName}] Invoice payment succeeded:`, invoice.id);

  // Only process subscription invoices
  if (!invoice.subscription) {
    return;
  }

  try {
    const subscriptionId = invoice.subscription as string;

    // Fetch full subscription details
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Update subscription status to active (in case it was past_due)
    await subscriptionService.updateFromWebhook(
      subscription.id,
      'active',
      new Date(subscription.current_period_start * 1000),
      new Date(subscription.current_period_end * 1000)
    );

    console.log(`[${componentName}] Subscription renewed successfully:`, subscription.id);
  } catch (error) {
    console.error(`[${componentName}] Failed to process invoice payment:`, error);
    // Don't throw - webhook should still return 200 to Stripe
  }
}

/**
 * Handle invoice.payment_failed event
 *
 * Called when subscription invoice payment fails.
 * Subscription will move to past_due status.
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log(`[${componentName}] Invoice payment failed:`, invoice.id);

  // Only process subscription invoices
  if (!invoice.subscription) {
    return;
  }

  try {
    const subscriptionId = invoice.subscription as string;

    // Fetch full subscription details
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Update subscription status to past_due
    await subscriptionService.updateFromWebhook(
      subscription.id,
      'past_due',
      new Date(subscription.current_period_start * 1000),
      new Date(subscription.current_period_end * 1000)
    );

    console.log(`[${componentName}] Subscription marked as past_due:`, subscription.id);

    // TODO: Send email notification to user about payment failure
  } catch (error) {
    console.error(`[${componentName}] Failed to process invoice payment failure:`, error);
    // Don't throw - webhook should still return 200 to Stripe
  }
}
