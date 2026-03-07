/**
 * DisputeService
 *
 * Business logic for buyer dispute flow.
 * Validates eligibility (7-day window, buyer ownership, escrow held)
 * and orchestrates dispute creation + escrow status update.
 */

import type { DisputeRepository } from '../repositories/DisputeRepository';
import type { TransactionRepository } from '../repositories/TransactionRepository';
import type { EmailService } from './EmailService';

const ADMIN_EMAIL = 'admin@codesalvage.com';

export const DISPUTE_REASONS = [
  'description_mismatch',
  'code_not_functional',
  'missing_features',
  'access_issues',
  'other',
] as const;

export type DisputeReason = (typeof DISPUTE_REASONS)[number];

export class DisputeValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'DisputeValidationError';
  }
}

export class DisputePermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DisputePermissionError';
  }
}

export class DisputeService {
  constructor(
    private disputeRepository: DisputeRepository,
    private transactionRepository: TransactionRepository,
    private emailService?: EmailService
  ) {
    console.log('[DisputeService] Initialized');
  }

  /**
   * Open a dispute for a transaction.
   *
   * Eligibility rules:
   * - Caller must be the buyer on the transaction
   * - escrowStatus must be 'held' (payment succeeded, window open)
   * - Current date must be before escrowReleaseDate (7-day window)
   * - No existing dispute for this transaction
   */
  async openDispute(
    buyerId: string,
    transactionId: string,
    reason: string,
    description: string
  ) {
    console.log('[DisputeService] Opening dispute:', { buyerId, transactionId, reason });

    if (!DISPUTE_REASONS.includes(reason as DisputeReason)) {
      throw new DisputeValidationError('Invalid dispute reason', 'reason');
    }

    if (!description || description.trim().length < 20) {
      throw new DisputeValidationError(
        'Description must be at least 20 characters',
        'description'
      );
    }

    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new DisputeValidationError('Transaction not found');
    }

    if (transaction.buyerId !== buyerId) {
      throw new DisputePermissionError('Only the buyer can open a dispute');
    }

    if (transaction.escrowStatus !== 'held') {
      throw new DisputeValidationError(
        'Disputes can only be opened while escrow is held (within the 7-day review window)'
      );
    }

    if (transaction.escrowReleaseDate && new Date() > transaction.escrowReleaseDate) {
      throw new DisputeValidationError(
        'The 7-day review window has closed. Disputes must be filed before the escrow release date.'
      );
    }

    const existing = await this.disputeRepository.findByTransactionId(transactionId);
    if (existing) {
      throw new DisputeValidationError(
        'A dispute has already been filed for this transaction'
      );
    }

    const dispute = await this.disputeRepository.create({
      transactionId,
      buyerId,
      reason,
      description: description.trim(),
    });

    // Mark transaction escrow as disputed — pauses auto-release cron
    await this.transactionRepository.updateEscrowStatus(transactionId, 'disputed');

    // Non-blocking email notifications — fire and forget
    if (this.emailService) {
      const sellerEmail = transaction.seller?.email;
      const sellerName =
        transaction.seller?.fullName ?? transaction.seller?.username ?? 'Seller';
      const buyerName =
        transaction.buyer?.fullName ?? transaction.buyer?.username ?? 'Buyer';
      const projectTitle = transaction.project?.title ?? 'your project';

      const emailData = {
        buyerName,
        sellerName,
        projectTitle,
        reason,
        description: description.trim(),
        transactionId,
        disputeId: dispute.id,
      };

      if (sellerEmail) {
        this.emailService
          .sendDisputeOpenedSellerNotification(
            { email: sellerEmail, name: sellerName },
            emailData
          )
          .catch((e) => console.error('[DisputeService] Seller notification failed:', e));
      }

      this.emailService
        .sendDisputeOpenedAdminNotification(
          { email: ADMIN_EMAIL, name: 'CodeSalvage Admin' },
          emailData
        )
        .catch((e) => console.error('[DisputeService] Admin notification failed:', e));
    }

    console.log('[DisputeService] Dispute opened:', dispute.id);
    return dispute;
  }

  /**
   * Get the dispute for a transaction, if any.
   * Only accessible by the buyer or seller of the transaction.
   */
  async getDisputeForTransaction(userId: string, transactionId: string) {
    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) return null;

    const isParty = transaction.buyerId === userId || transaction.sellerId === userId;
    if (!isParty) {
      throw new DisputePermissionError('Access denied');
    }

    return this.disputeRepository.findByTransactionId(transactionId);
  }
}
