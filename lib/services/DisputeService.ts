/**
 * DisputeService
 *
 * Business logic for buyer dispute flow.
 * Validates eligibility (7-day window, buyer ownership, escrow held)
 * and orchestrates dispute creation + escrow status update.
 */

import type { DisputeRepository } from '../repositories/DisputeRepository';
import type { TransactionRepository } from '../repositories/TransactionRepository';

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
    private transactionRepository: TransactionRepository
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

    const isParty =
      transaction.buyerId === userId || transaction.sellerId === userId;
    if (!isParty) {
      throw new DisputePermissionError('Access denied');
    }

    return this.disputeRepository.findByTransactionId(transactionId);
  }
}
