/**
 * Stripe Webhook Handler
 *
 * POST /api/webhooks/stripe
 *
 * Routes Stripe events to the appropriate handler in:
 * - stripe-handlers-payment.ts (payment_intent, charge, featured listing)
 * - stripe-handlers-subscription.ts (account, subscription, invoice)
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
import {
  handlePaymentSucceeded,
  handlePaymentFailed,
  handleRefund,
} from './stripe-handlers-payment';
import {
  handleAccountUpdated,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
} from './stripe-handlers-subscription';
import type Stripe from 'stripe';

const transactionRepository = new TransactionRepository(prisma);
const featuredListingRepository = new FeaturedListingRepository(prisma);
const projectRepository = new ProjectRepository(prisma);
const userRepository = new UserRepository(prisma);
const subscriptionRepository = new SubscriptionRepository(prisma);
const subscriptionService = new SubscriptionService(
  subscriptionRepository,
  userRepository
);
const featuredListingService = new FeaturedListingService(
  featuredListingRepository,
  projectRepository,
  userRepository,
  subscriptionService
);

const paymentDeps = {
  prisma,
  emailService,
  transactionRepository,
  projectRepository,
  userRepository,
  featuredListingService,
};

const subscriptionDeps = {
  prisma,
  emailService,
  subscriptionService,
  userRepository,
};

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

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
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err);
    return NextResponse.json(
      { error: `Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 400 }
    );
  }

  console.log('[Stripe Webhook] Event received:', event.type);

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(
          event.data.object as Stripe.PaymentIntent,
          paymentDeps
        );
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent, paymentDeps);
        break;
      case 'charge.refunded':
        await handleRefund(event.data.object as Stripe.Charge, paymentDeps);
        break;
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account, subscriptionDeps);
        break;
      case 'customer.subscription.created':
        await handleSubscriptionCreated(
          event.data.object as Stripe.Subscription,
          subscriptionDeps
        );
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
          subscriptionDeps
        );
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
          subscriptionDeps
        );
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice,
          subscriptionDeps
        );
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice,
          subscriptionDeps
        );
        break;
      default:
        console.log('[Stripe Webhook] Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[Stripe Webhook] Error handling webhook:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
