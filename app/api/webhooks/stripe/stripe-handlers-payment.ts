/**
 * Stripe Payment Webhook Handlers
 *
 * Handles payment_intent.succeeded, payment_intent.payment_failed,
 * charge.refunded, and featured listing payment events.
 */

import type Stripe from 'stripe';
import type { PrismaClient } from '@prisma/client';
import type { EmailService } from '@/lib/services/EmailService';
import type { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import type { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import type { UserRepository } from '@/lib/repositories/UserRepository';
import type { FeaturedListingService } from '@/lib/services/FeaturedListingService';
import { env } from '@/config/env';

const componentName = 'StripeWebhook';

export interface PaymentHandlerDeps {
  prisma: PrismaClient;
  emailService: EmailService;
  transactionRepository: TransactionRepository;
  projectRepository: ProjectRepository;
  userRepository: UserRepository;
  featuredListingService: FeaturedListingService;
}

export async function handlePaymentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  deps: PaymentHandlerDeps
): Promise<void> {
  console.log(`[${componentName}] Payment succeeded:`, paymentIntent.id);

  const isFeaturedListingPurchase =
    paymentIntent.metadata['featuredListingPurchase'] === 'true';

  if (isFeaturedListingPurchase) {
    await handleFeaturedListingPayment(paymentIntent, deps);
    return;
  }

  const transactionId = paymentIntent.metadata['transactionId'];
  if (!transactionId) {
    console.error(`[${componentName}] No transaction ID in metadata`);
    return;
  }

  await deps.prisma.transaction.update({
    where: { id: transactionId },
    data: {
      paymentStatus: 'succeeded',
      stripePaymentIntentId: paymentIntent.id,
      stripeChargeId: paymentIntent.latest_charge as string,
    },
  });

  await deps.transactionRepository.updateEscrowStatus(transactionId, 'held');

  const transaction = await deps.transactionRepository.findById(transactionId);
  if (!transaction) {
    console.error(
      `[${componentName}] Transaction not found after update:`,
      transactionId
    );
    return;
  }

  await deps.prisma.project.update({
    where: { id: transaction.projectId },
    data: { status: 'sold' },
  });

  const appUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3011';
  const emailData = {
    buyerName: transaction.buyer.fullName || transaction.buyer.username,
    sellerName: transaction.seller.fullName || transaction.seller.username,
    projectTitle: transaction.project.title,
    projectId: transaction.projectId,
    transactionId: transaction.id,
    amount: transaction.amountCents,
    downloadUrl: `${appUrl}/projects/${transaction.projectId}/download`,
    purchaseDate: new Date().toISOString(),
  };

  try {
    await deps.emailService.sendBuyerPurchaseConfirmation(
      { email: transaction.buyer.email!, name: emailData.buyerName },
      emailData
    );
    await deps.emailService.sendSellerPurchaseNotification(
      { email: transaction.seller.email!, name: emailData.sellerName },
      emailData
    );
    console.log(`[${componentName}] Purchase emails sent`);
  } catch (err) {
    console.error(`[${componentName}] Failed to send purchase emails:`, err);
  }
}

export async function handlePaymentFailed(
  paymentIntent: Stripe.PaymentIntent,
  deps: PaymentHandlerDeps
): Promise<void> {
  console.log(`[${componentName}] Payment failed:`, paymentIntent.id);

  const transactionId = paymentIntent.metadata['transactionId'];
  if (!transactionId) {
    console.error(`[${componentName}] No transaction ID in metadata`);
    return;
  }

  const transaction = await deps.prisma.transaction.update({
    where: { id: transactionId },
    data: { paymentStatus: 'failed', stripePaymentIntentId: paymentIntent.id },
    include: {
      buyer: { select: { email: true, fullName: true, username: true } },
      project: { select: { title: true } },
    },
  });

  console.log(`[${componentName}] Transaction marked as failed:`, transactionId);

  if (transaction.buyer.email) {
    deps.emailService
      .sendPaymentFailedNotification(
        {
          email: transaction.buyer.email,
          name: transaction.buyer.fullName || transaction.buyer.username,
        },
        {
          buyerName: transaction.buyer.fullName || transaction.buyer.username,
          projectTitle: transaction.project.title,
          amountCents: paymentIntent.amount,
          transactionId,
        }
      )
      .catch((err: Error) =>
        console.error(`[${componentName}] Failed to send payment failed email:`, err)
      );
  }
}

export async function handleRefund(
  charge: Stripe.Charge,
  deps: PaymentHandlerDeps
): Promise<void> {
  console.log(`[${componentName}] Charge refunded:`, charge.id);

  const transaction = await deps.prisma.transaction.findFirst({
    where: { stripeChargeId: charge.id },
  });

  if (!transaction) {
    console.error(`[${componentName}] Transaction not found for charge:`, charge.id);
    return;
  }

  await deps.prisma.transaction.update({
    where: { id: transaction.id },
    data: { paymentStatus: 'refunded', escrowStatus: 'disputed' },
  });

  console.log(`[${componentName}] Transaction marked as refunded:`, transaction.id);
}

async function handleFeaturedListingPayment(
  paymentIntent: Stripe.PaymentIntent,
  deps: PaymentHandlerDeps
): Promise<void> {
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
    const result = await deps.featuredListingService.purchaseFeaturedPlacement(sellerId, {
      projectId,
      durationDays: durationDaysNum,
    });

    const project = await deps.projectRepository.findById(projectId);
    const seller = await deps.userRepository.findById(sellerId);

    if (!project || !seller) {
      console.error(`[${componentName}] Project or seller not found for email`);
      return;
    }

    const appUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3011';
    await deps.emailService.sendFeaturedListingConfirmation(
      { email: seller.email!, name: seller.fullName || seller.username },
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

    console.log(`[${componentName}] Featured listing processed successfully`);
  } catch (error) {
    console.error(
      `[${componentName}] Failed to process featured listing payment:`,
      error
    );
  }
}
