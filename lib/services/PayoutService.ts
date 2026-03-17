/**
 * PayoutService
 *
 * Business logic for seller payouts.
 *
 * Responsibilities:
 * - Submit and manage seller payout details
 * - Create payout requests when escrow releases
 * - Process batch payouts via PayPal Payouts API
 * - Manual completion and retry for admin
 */

import type {
  SellerPayoutDetailsRepository,
  CreatePayoutDetailsInput,
} from '@/lib/repositories/SellerPayoutDetailsRepository';
import type {
  PayoutRequestRepository,
  PayoutRequestWithRelations,
} from '@/lib/repositories/PayoutRequestRepository';
import type { UserRepository } from '@/lib/repositories/UserRepository';
import type { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import type { EmailService } from '@/lib/services/EmailService';
import { getPayPalClient, paypal } from '@/lib/paypal';
import { monotonicFactory } from 'ulidx';

const generateBatchId = monotonicFactory();
const componentName = 'PayoutService';

export class PayoutValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'PayoutValidationError';
  }
}

export class PayoutPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayoutPermissionError';
  }
}

export class PayoutNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayoutNotFoundError';
  }
}

export interface SubmitPayoutDetailsInput {
  payoutMethod: string;
  payoutEmail: string;
}

export interface ProcessBatchResult {
  processed: number;
  successful: number;
  failed: number;
  batchId: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class PayoutService {
  constructor(
    private payoutDetailsRepo: SellerPayoutDetailsRepository,
    private payoutRequestRepo: PayoutRequestRepository,
    private userRepo: UserRepository,
    private transactionRepo: TransactionRepository,
    private emailService: EmailService
  ) {
    console.log(`[${componentName}] Initialized`);
  }

  /**
   * Submit or update seller payout details.
   * Sets isSeller=true and isVerifiedSeller=true atomically.
   */
  async submitPayoutDetails(userId: string, input: SubmitPayoutDetailsInput) {
    console.log(`[${componentName}] Submitting payout details for user:`, userId);

    if (!input.payoutEmail || !input.payoutEmail.trim()) {
      throw new PayoutValidationError('Payout email is required', 'payoutEmail');
    }

    if (!EMAIL_REGEX.test(input.payoutEmail)) {
      throw new PayoutValidationError('Invalid email format', 'payoutEmail');
    }

    if (!input.payoutMethod) {
      throw new PayoutValidationError('Payout method is required', 'payoutMethod');
    }

    const existing = await this.payoutDetailsRepo.findByUserId(userId);

    let result;
    if (existing) {
      result = await this.payoutDetailsRepo.update(userId, {
        payoutMethod: input.payoutMethod,
        payoutEmail: input.payoutEmail,
        isActive: true,
      });
    } else {
      result = await this.payoutDetailsRepo.create({
        userId,
        payoutMethod: input.payoutMethod,
        payoutEmail: input.payoutEmail,
      } as CreatePayoutDetailsInput);
    }

    await this.userRepo.updateUserRoles(userId, {
      isSeller: true,
      isVerifiedSeller: true,
    });

    console.log(`[${componentName}] Payout details saved and user verified:`, userId);
    return result;
  }

  /**
   * Create a payout request for a released escrow transaction.
   * Uses transaction.sellerReceivesCents as the payout amount (already commission-deducted).
   */
  async createPayoutRequest(transactionId: string) {
    console.log(`[${componentName}] Creating payout request for transaction:`, transactionId);

    const transaction = await this.transactionRepo.findById(transactionId);
    if (!transaction) {
      throw new PayoutNotFoundError('Transaction not found');
    }

    const payoutDetails = await this.payoutDetailsRepo.findByUserId(transaction.sellerId);
    if (!payoutDetails || !payoutDetails.isActive) {
      throw new PayoutValidationError(
        'Seller has no active payout details',
        'sellerPayoutDetails'
      );
    }

    const result = await this.payoutRequestRepo.create({
      transactionId,
      sellerId: transaction.sellerId,
      amountCents: transaction.sellerReceivesCents,
      commissionCents: transaction.commissionCents,
      payoutMethod: payoutDetails.payoutMethod,
      payoutEmail: payoutDetails.payoutEmail,
    });

    console.log(`[${componentName}] Payout request created:`, result.id);
    return result;
  }

  /**
   * Process all pending payout requests in a batch via PayPal Payouts API.
   */
  async processBatch(): Promise<ProcessBatchResult> {
    console.log(`[${componentName}] Starting batch payout processing`);

    const pending = await this.payoutRequestRepo.findPending();

    if (pending.length === 0) {
      console.log(`[${componentName}] No pending payout requests`);
      return { processed: 0, successful: 0, failed: 0, batchId: '' };
    }

    const batchId = `CS-${generateBatchId()}`;
    let successful = 0;
    let failed = 0;

    // Process in chunks of 50 to stay within PayPal batch limits
    const BATCH_SIZE = 50;
    const chunks: PayoutRequestWithRelations[][] = [];
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      chunks.push(pending.slice(i, i + BATCH_SIZE));
    }

    console.log(`[${componentName}] Processing ${pending.length} requests in ${chunks.length} chunk(s)`);

    for (const chunk of chunks) {
      // Mark chunk as processing
      for (const request of chunk) {
        await this.payoutRequestRepo.updateStatus(request.id, {
          status: 'processing',
          batchId,
        });
      }

      try {
        const client = getPayPalClient();
        const payoutRequest = new paypal.payouts.PayoutsPostRequest();

        payoutRequest.requestBody({
          sender_batch_header: {
            sender_batch_id: `${batchId}-${chunks.indexOf(chunk)}`,
            email_subject: 'You have a payment from CodeSalvage',
            email_message: 'Your payout from a project sale on CodeSalvage has been processed.',
          },
          items: chunk.map((req: PayoutRequestWithRelations) => ({
            recipient_type: 'EMAIL',
            amount: {
              value: (req.amountCents / 100).toFixed(2),
              currency: 'USD',
            },
            receiver: req.payoutEmail,
            note: `Payout for transaction ${req.transactionId}`,
            sender_item_id: req.id,
          })),
        });

        const response = await client.execute(payoutRequest);
        const paypalBatchId = response.result?.batch_header?.payout_batch_id;

        console.log(`[${componentName}] PayPal batch submitted:`, {
          batchId,
          paypalBatchId,
          status: response.result?.batch_header?.batch_status,
        });

        // "completed" here means "submitted to PayPal" — PayPal processes asynchronously.
        // Individual items may still fail in PayPal's system. Admin can check the PayPal
        // dashboard using the externalReference (PayPal batch ID) for reconciliation.
        // PayPal webhook integration is deferred (see plan's Deferred Ideas).
        for (const request of chunk) {
          await this.payoutRequestRepo.updateStatus(request.id, {
            status: 'completed',
            processedAt: new Date(),
            externalReference: paypalBatchId,
          });
          successful++;

          this.sendPayoutCompletedEmail(request).catch((err: Error) =>
            console.error(`[${componentName}] Failed to send payout email:`, err)
          );
        }
      } catch (error) {
        console.error(`[${componentName}] PayPal batch chunk failed:`, error);

        const reason = error instanceof Error ? error.message : 'PayPal API error';
        for (const request of chunk) {
          await this.payoutRequestRepo.updateStatus(request.id, {
            status: 'failed',
            failedReason: reason,
          });
          failed++;

          this.sendPayoutFailedEmail(request, reason).catch((err: Error) =>
            console.error(`[${componentName}] Failed to send failure email:`, err)
          );
        }
      }
    }

    const result = { processed: pending.length, successful, failed, batchId };
    console.log(`[${componentName}] Batch processing complete:`, result);
    return result;
  }

  /**
   * Manually mark a payout request as completed (admin action).
   */
  async markCompleted(id: string, adminId: string, externalReference: string) {
    console.log(`[${componentName}] Marking payout completed:`, { id, adminId });

    const request = await this.payoutRequestRepo.findById(id);
    if (!request) {
      throw new PayoutNotFoundError('Payout request not found');
    }

    await this.payoutRequestRepo.updateStatus(id, {
      status: 'completed',
      processedAt: new Date(),
      processedBy: adminId,
      externalReference,
    });

    this.sendPayoutCompletedEmail(request).catch((err: Error) =>
      console.error(`[${componentName}] Failed to send payout email:`, err)
    );

    console.log(`[${componentName}] Payout marked completed:`, id);
  }

  /**
   * Retry a failed payout request (admin action).
   */
  async retryFailed(id: string) {
    console.log(`[${componentName}] Retrying failed payout:`, id);

    const request = await this.payoutRequestRepo.findById(id);
    if (!request) {
      throw new PayoutNotFoundError('Payout request not found');
    }

    if (request.status !== 'failed') {
      throw new PayoutValidationError(
        'Only failed payouts can be retried',
        'status'
      );
    }

    await this.payoutRequestRepo.updateStatus(id, {
      status: 'pending',
      failedReason: null,
      processedAt: null,
      processedBy: null,
      externalReference: null,
      batchId: null,
    });

    console.log(`[${componentName}] Payout reset to pending:`, id);
  }

  private async sendPayoutCompletedEmail(request: PayoutRequestWithRelations) {
    if (!request.seller.email) return;
    await this.emailService.sendPayoutCompletedNotification(
      {
        email: request.seller.email,
        name: request.seller.fullName || request.seller.username,
      },
      {
        sellerName: request.seller.fullName || request.seller.username,
        amount: request.amountCents,
        transactionId: request.transactionId,
        payoutMethod: request.payoutMethod,
        projectTitle: request.transaction.project.title,
      }
    );
  }

  private async sendPayoutFailedEmail(request: PayoutRequestWithRelations, reason: string) {
    if (!request.seller.email) return;
    await this.emailService.sendPayoutFailedNotification(
      {
        email: request.seller.email,
        name: request.seller.fullName || request.seller.username,
      },
      {
        sellerName: request.seller.fullName || request.seller.username,
        amount: request.amountCents,
        reason,
        projectTitle: request.transaction.project.title,
      }
    );
  }
}
