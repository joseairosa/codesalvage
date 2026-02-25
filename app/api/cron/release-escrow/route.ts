/**
 * Escrow Release Cron Job
 *
 * Automated job that runs periodically to release escrowed funds to sellers.
 * Transfers funds from platform to seller after 7-day hold period.
 *
 * GET /api/cron/release-escrow
 *
 * Should be called via cron (Railway Cron, Vercel Cron, or external service):
 * Schedule: Every 6 hours (cron: 0 *\/6 * * *)
 *
 * @example
 * GET /api/cron/release-escrow
 * Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { stripeService, emailService } from '@/lib/services';
import { env } from '@/config/env';
import { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import { TransactionService } from '@/lib/services/TransactionService';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';

const componentName = 'EscrowReleaseCron';

const transactionRepository = new TransactionRepository(prisma);
const userRepository = new UserRepository(prisma);
const projectRepository = new ProjectRepository(prisma);
const transactionService = new TransactionService(
  transactionRepository,
  userRepository,
  projectRepository
);

/**
 * GET /api/cron/release-escrow
 *
 * Release escrowed funds for eligible transactions
 */
export async function GET() {
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const expectedAuth = `Bearer ${env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.error(`[${componentName}] Unauthorized request`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[${componentName}] Starting escrow release job`);

    const now = new Date();

    const transactions = await prisma.transaction.findMany({
      where: {
        escrowStatus: 'held',
        escrowReleaseDate: {
          lte: now,
        },
        paymentStatus: 'succeeded',
        project: {
          githubUrl: null,
        },
      },
      include: {
        seller: {
          select: {
            id: true,
            stripeAccountId: true,
            email: true,
            fullName: true,
            username: true,
          },
        },
        buyer: {
          select: {
            id: true,
            email: true,
            fullName: true,
            username: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      take: 50,
    });

    console.log(
      `[${componentName}] Found ${transactions.length} transactions to release`
    );

    let successCount = 0;
    let errorCount = 0;

    for (const transaction of transactions) {
      try {
        console.log(`[${componentName}] Processing transaction:`, transaction.id);

        if (!transaction.seller.stripeAccountId) {
          console.error(
            `[${componentName}] Seller has no Stripe account:`,
            transaction.sellerId
          );
          errorCount++;
          continue;
        }

        await transactionService.releaseEscrow(transaction.id);

        console.log(`[${componentName}] Escrow released via service:`, transaction.id);

        const transfer = await stripeService.transferToSeller(
          transaction.seller.stripeAccountId,
          transaction.sellerReceivesCents,
          transaction.id
        );

        console.log(`[${componentName}] Stripe transfer completed:`, transfer.id);

        successCount++;

        try {
          await emailService.sendEscrowReleaseNotification(
            {
              email: transaction.seller.email!,
              name: transaction.seller.fullName || transaction.seller.username,
            },
            {
              sellerName: transaction.seller.fullName || transaction.seller.username,
              projectTitle: transaction.project.title,
              amount: transaction.sellerReceivesCents,
              releaseDate: now.toISOString(),
              transactionId: transaction.id,
            }
          );

          console.log(`[${componentName}] Escrow release notification sent to seller`);

          if (transaction.buyer.email) {
            emailService
              .sendEscrowReleasedBuyerCopy(
                {
                  email: transaction.buyer.email,
                  name: transaction.buyer.fullName || transaction.buyer.username,
                },
                {
                  sellerName: transaction.seller.fullName || transaction.seller.username,
                  projectTitle: transaction.project.title,
                  amount: transaction.sellerReceivesCents,
                  releaseDate: now.toISOString(),
                  transactionId: transaction.id,
                  buyerName: transaction.buyer.fullName || transaction.buyer.username,
                }
              )
              .catch((err: Error) =>
                console.error(
                  `[${componentName}] Failed to send escrow released buyer copy:`,
                  err
                )
              );
          }
        } catch (emailError) {
          console.error(`[${componentName}] Failed to send email:`, emailError);
        }
      } catch (error) {
        console.error(`[${componentName}] Failed to release escrow:`, {
          transactionId: transaction.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        errorCount++;
      }
    }

    const result = {
      processed: transactions.length,
      successful: successCount,
      failed: errorCount,
      timestamp: now.toISOString(),
    };

    console.log(`[${componentName}] Job completed:`, result);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(`[${componentName}] Job failed:`, error);

    return NextResponse.json(
      {
        error: 'Escrow release job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
