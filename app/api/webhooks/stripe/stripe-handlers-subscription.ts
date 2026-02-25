/**
 * Stripe Subscription & Account Webhook Handlers
 *
 * Handles account.updated, customer.subscription.*, and invoice.payment.* events.
 */

import type Stripe from 'stripe';
import type { PrismaClient } from '@prisma/client';
import type { EmailService } from '@/lib/services/EmailService';
import type { SubscriptionService } from '@/lib/services/SubscriptionService';
import type { UserRepository } from '@/lib/repositories/UserRepository';
import { stripe } from '@/lib/stripe';

const componentName = 'StripeWebhook';

export interface SubscriptionHandlerDeps {
  prisma: PrismaClient;
  emailService: EmailService;
  subscriptionService: SubscriptionService;
  userRepository: UserRepository;
}

export async function handleAccountUpdated(
  account: Stripe.Account,
  deps: SubscriptionHandlerDeps
): Promise<void> {
  console.log(`[${componentName}] Account updated:`, account.id);

  const userId = account.metadata?.['userId'];
  if (!userId) {
    console.error(`[${componentName}] No user ID in account metadata`);
    return;
  }

  const isOnboarded = account.charges_enabled && account.details_submitted;

  const existingUser = await deps.prisma.user.findUnique({
    where: { id: userId },
    select: { isVerifiedSeller: true, email: true, fullName: true, username: true },
  });

  await deps.prisma.user.update({
    where: { id: userId },
    data: { isVerifiedSeller: isOnboarded },
  });

  console.log(`[${componentName}] User verification updated:`, {
    userId,
    isVerifiedSeller: isOnboarded,
  });

  if (
    isOnboarded &&
    existingUser &&
    !existingUser.isVerifiedSeller &&
    existingUser.email
  ) {
    deps.emailService
      .sendStripeConnectConfirmedNotification(
        {
          email: existingUser.email,
          name: existingUser.fullName || existingUser.username,
        },
        { sellerName: existingUser.fullName || existingUser.username }
      )
      .catch((err: Error) =>
        console.error(
          `[${componentName}] Failed to send Stripe Connect confirmation email:`,
          err
        )
      );
  }
}

export async function handleSubscriptionCreated(
  subscription: Stripe.Subscription,
  deps: SubscriptionHandlerDeps
): Promise<void> {
  console.log(`[${componentName}] Subscription created:`, subscription.id);

  try {
    await deps.subscriptionService.updateFromWebhook(
      subscription.id,
      subscription.status,
      new Date(subscription.current_period_start * 1000),
      new Date(subscription.current_period_end * 1000)
    );
    console.log(`[${componentName}] Subscription creation confirmed:`, subscription.id);
  } catch (error) {
    console.error(`[${componentName}] Failed to update subscription on creation:`, error);
  }
}

export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  deps: SubscriptionHandlerDeps
): Promise<void> {
  console.log(
    `[${componentName}] Subscription updated:`,
    subscription.id,
    subscription.status
  );

  try {
    await deps.subscriptionService.updateFromWebhook(
      subscription.id,
      subscription.status,
      new Date(subscription.current_period_start * 1000),
      new Date(subscription.current_period_end * 1000)
    );
    console.log(`[${componentName}] Subscription updated successfully:`, subscription.id);
  } catch (error) {
    console.error(`[${componentName}] Failed to update subscription:`, error);
  }
}

export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  deps: SubscriptionHandlerDeps
): Promise<void> {
  console.log(`[${componentName}] Subscription deleted:`, subscription.id);

  try {
    await deps.subscriptionService.cancelImmediately(subscription.id);
    console.log(`[${componentName}] Subscription canceled immediately:`, subscription.id);
  } catch (error) {
    console.error(`[${componentName}] Failed to cancel subscription:`, error);
  }
}

export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice,
  deps: SubscriptionHandlerDeps
): Promise<void> {
  console.log(`[${componentName}] Invoice payment succeeded:`, invoice.id);

  if (!invoice.subscription) return;

  try {
    const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
    await deps.subscriptionService.updateFromWebhook(
      sub.id,
      'active',
      new Date(sub.current_period_start * 1000),
      new Date(sub.current_period_end * 1000)
    );
    console.log(`[${componentName}] Subscription renewed:`, sub.id);
  } catch (error) {
    console.error(`[${componentName}] Failed to process invoice payment:`, error);
  }
}

export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  deps: SubscriptionHandlerDeps
): Promise<void> {
  console.log(`[${componentName}] Invoice payment failed:`, invoice.id);

  if (!invoice.subscription) return;

  try {
    const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
    await deps.subscriptionService.updateFromWebhook(
      sub.id,
      'past_due',
      new Date(sub.current_period_start * 1000),
      new Date(sub.current_period_end * 1000)
    );
    console.log(`[${componentName}] Subscription marked as past_due:`, sub.id);
  } catch (error) {
    console.error(`[${componentName}] Failed to process invoice payment failure:`, error);
  }
}
