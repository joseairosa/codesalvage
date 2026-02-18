/**
 * RepositoryTransferService
 *
 * Business logic layer for GitHub repository transfer lifecycle.
 * Handles the post-purchase flow of transferring repo access from seller to buyer.
 *
 * Responsibilities:
 * - Initiate repository transfer after successful payment
 * - Set buyer GitHub username when missing
 * - Confirm transfer completion (buyer acknowledges access)
 * - Build timeline data for transaction progress UI
 *
 * Architecture:
 * - Depends on RepositoryTransferRepository, TransactionRepository,
 *   GitHubService, NotificationService
 * - Validates business rules before database operations
 * - Throws typed errors for HTTP status mapping
 * - Decrypts seller GitHub tokens via lib/encryption
 */

import type { RepositoryTransfer } from '@prisma/client';
import type { RepositoryTransferRepository } from '../repositories/RepositoryTransferRepository';
import type {
  AutoTransferEligibleTransaction,
  TransactionRepository,
  TransactionWithRelations,
} from '../repositories/TransactionRepository';
import { GitHubServiceError } from './GitHubService';
import type { GitHubService } from './GitHubService';
import type { NotificationService } from './NotificationService';
import { decrypt } from '@/lib/encryption';

export class RepositoryTransferValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryTransferValidationError';
  }
}

export class RepositoryTransferPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryTransferPermissionError';
  }
}

export class RepositoryTransferNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryTransferNotFoundError';
  }
}

export type TimelineStageStatus =
  | 'completed'
  | 'active'
  | 'upcoming'
  | 'skipped'
  | 'failed';

export interface TimelineAction {
  label: string;
  type: 'primary' | 'secondary' | 'link';
  url?: string;
  apiEndpoint?: string;
  apiMethod?: string;
}

export interface TimelineStage {
  name: string;
  status: TimelineStageStatus;
  completedAt?: Date | null;
  description: string;
  actions: TimelineAction[];
  metadata?: Record<string, unknown>;
}

export class RepositoryTransferService {
  constructor(
    private repositoryTransferRepository: RepositoryTransferRepository,
    private transactionRepository: TransactionRepository,
    private gitHubService: GitHubService,
    private notificationService: NotificationService
  ) {
    console.log('[RepositoryTransferService] Initialized');
  }

  /**
   * Initiate a repository transfer after payment succeeds.
   *
   * If the buyer already has a GitHub username on file, an invitation
   * is sent immediately. Otherwise the transfer stays in 'pending'
   * until the buyer provides their username.
   *
   * @param sellerId - Seller user ID (must match transaction.sellerId)
   * @param transactionId - Transaction ID
   * @returns Created repository transfer record
   */
  async initiateTransfer(
    sellerId: string,
    transactionId: string
  ): Promise<RepositoryTransfer> {
    console.log('[RepositoryTransferService] Initiating transfer:', {
      sellerId,
      transactionId,
    });

    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new RepositoryTransferNotFoundError('Transaction not found');
    }

    if (transaction.sellerId !== sellerId) {
      throw new RepositoryTransferPermissionError(
        'Only the seller can initiate a repository transfer'
      );
    }

    if (transaction.paymentStatus !== 'succeeded') {
      throw new RepositoryTransferValidationError('Payment must be completed');
    }

    if (!transaction.project.githubUrl) {
      throw new RepositoryTransferValidationError('Project has no GitHub repository');
    }

    const existingTransfer =
      await this.repositoryTransferRepository.findByTransactionId(transactionId);
    if (existingTransfer) {
      throw new RepositoryTransferValidationError('Transfer already initiated');
    }

    const sellerGithubUsername = transaction.seller.githubUsername;
    const sellerGithubAccessToken = transaction.seller.githubAccessToken;

    if (!sellerGithubAccessToken) {
      throw new RepositoryTransferValidationError('Seller GitHub account not connected');
    }

    const token = decrypt(sellerGithubAccessToken);
    const { owner, repo } = this.gitHubService.parseGitHubUrl(
      transaction.project.githubUrl
    );

    const buyerUsername = transaction.buyer.githubUsername;

    let transfer: RepositoryTransfer;

    if (buyerUsername) {
      await this.gitHubService.addCollaborator(owner, repo, buyerUsername, token);

      transfer = await this.repositoryTransferRepository.create({
        transactionId,
        githubRepoFullName: owner + '/' + repo,
        sellerGithubUsername: sellerGithubUsername!,
        buyerGithubUsername: buyerUsername,
        status: 'invitation_sent',
        initiatedAt: new Date(),
        invitationSentAt: new Date(),
      });
    } else {
      transfer = await this.repositoryTransferRepository.create({
        transactionId,
        githubRepoFullName: owner + '/' + repo,
        sellerGithubUsername: sellerGithubUsername!,
        status: 'pending',
        initiatedAt: new Date(),
      });
    }

    console.log('[RepositoryTransferService] Transfer created:', transfer.id);

    this.notificationService
      .createNotification({
        userId: transaction.buyerId,
        type: 'repo_transfer_initiated',
        title: 'Repository Transfer Started',
        message:
          'The seller has initiated the repository transfer for ' +
          transaction.project.title,
        actionUrl: '/transactions/' + transactionId,
        relatedEntityType: 'transaction',
        relatedEntityId: transactionId,
      })
      .catch((err) => {
        console.error(
          '[RepositoryTransferService] Failed to send transfer notification:',
          err
        );
      });

    return transfer;
  }

  /**
   * Set the buyer's GitHub username on a transfer and immediately grant collaborator access.
   *
   * In the new purchase flow, sellers no longer manually initiate transfers.
   * When the buyer submits their GitHub username after payment, this method:
   * 1. Auto-creates a RepositoryTransfer record if none exists
   * 2. Saves the buyer's GitHub username
   * 3. Calls addCollaborator() to grant immediate access (unless already granted)
   *
   * The username is always saved, even if addCollaborator() fails, so the
   * buyer can retry without losing their input.
   *
   * @param buyerId - Buyer user ID (must match transaction.buyerId)
   * @param transactionId - Transaction ID
   * @param username - Buyer's GitHub username
   * @returns Updated repository transfer record
   */
  async setBuyerGithubUsername(
    buyerId: string,
    transactionId: string,
    username: string
  ): Promise<RepositoryTransfer> {
    console.log('[RepositoryTransferService] Setting buyer GitHub username:', {
      buyerId,
      transactionId,
      username,
    });

    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new RepositoryTransferNotFoundError('Transaction not found');
    }

    if (transaction.buyerId !== buyerId) {
      throw new RepositoryTransferPermissionError(
        'Only the buyer can set their GitHub username'
      );
    }

    if (transaction.paymentStatus !== 'succeeded') {
      throw new RepositoryTransferValidationError(
        'Payment must be completed to access repository'
      );
    }

    if (!transaction.project.githubUrl) {
      throw new RepositoryTransferValidationError('Project has no GitHub repository');
    }

    if (!transaction.seller.githubAccessToken) {
      throw new RepositoryTransferValidationError(
        'Seller GitHub account not connected — cannot grant collaborator access'
      );
    }

    const { owner, repo } = this.gitHubService.parseGitHubUrl(
      transaction.project.githubUrl
    );
    const token = decrypt(transaction.seller.githubAccessToken);

    let transfer =
      await this.repositoryTransferRepository.findByTransactionId(transactionId);
    if (!transfer) {
      transfer = await this.repositoryTransferRepository.create({
        transactionId,
        githubRepoFullName: owner + '/' + repo,
        sellerGithubUsername: transaction.seller.githubUsername ?? '',
        status: 'pending',
        initiatedAt: new Date(),
      });
    }

    let updated = await this.repositoryTransferRepository.setBuyerGithubUsername(
      transfer.id,
      username
    );

    const needsCollaboratorAccess = ['pending', 'failed'].includes(transfer.status);
    if (needsCollaboratorAccess) {
      await this.gitHubService.addCollaborator(owner, repo, username, token);

      updated = await this.repositoryTransferRepository.updateStatus(
        transfer.id,
        'invitation_sent',
        { invitationSentAt: new Date() }
      );
    }

    console.log('[RepositoryTransferService] Buyer GitHub username set:', updated.id);
    return updated;
  }

  /**
   * Confirm that the buyer has accepted the repository transfer.
   *
   * @param buyerId - Buyer user ID (must match transaction.buyerId)
   * @param transactionId - Transaction ID
   * @returns Updated repository transfer record
   */
  async confirmTransfer(
    buyerId: string,
    transactionId: string
  ): Promise<RepositoryTransfer> {
    console.log('[RepositoryTransferService] Confirming transfer:', {
      buyerId,
      transactionId,
    });

    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new RepositoryTransferNotFoundError('Transaction not found');
    }

    if (transaction.buyerId !== buyerId) {
      throw new RepositoryTransferPermissionError(
        'Only the buyer can confirm the repository transfer'
      );
    }

    const transfer =
      await this.repositoryTransferRepository.findByTransactionId(transactionId);
    if (!transfer) {
      throw new RepositoryTransferNotFoundError('Repository transfer not found');
    }

    const updated = await this.repositoryTransferRepository.updateStatus(
      transfer.id,
      'completed',
      { completedAt: new Date() }
    );

    console.log('[RepositoryTransferService] Transfer confirmed:', updated.id);

    this.notificationService
      .createNotification({
        userId: transaction.sellerId,
        type: 'repo_transfer_confirmed',
        title: 'Repository Transfer Confirmed',
        message: 'The buyer has confirmed access to ' + transaction.project.title,
        actionUrl: '/transactions/' + transactionId,
        relatedEntityType: 'transaction',
        relatedEntityId: transactionId,
      })
      .catch((err) => {
        console.error(
          '[RepositoryTransferService] Failed to send confirm notification:',
          err
        );
      });

    return updated;
  }

  /**
   * Build timeline data for a transaction's progress.
   *
   * Returns 5 stages: Offer Accepted, Payment Received, Repository Transfer,
   * Review Period, and Escrow Released.
   *
   * @param transactionId - Transaction ID
   * @param userId - Current user ID (must be buyer or seller)
   * @returns Array of timeline stages
   */
  async getTimelineData(transactionId: string, userId: string): Promise<TimelineStage[]> {
    console.log('[RepositoryTransferService] Getting timeline data:', {
      transactionId,
      userId,
    });

    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new RepositoryTransferNotFoundError('Transaction not found');
    }

    if (transaction.buyerId !== userId && transaction.sellerId !== userId) {
      throw new RepositoryTransferPermissionError(
        'You do not have access to this transaction'
      );
    }

    const role = userId === transaction.buyerId ? 'buyer' : 'seller';

    const stage1 = this.buildOfferAcceptedStage(transaction);

    const stage2 = this.buildPaymentReceivedStage(transaction);

    const stage3 = this.buildRepositoryTransferStage(transaction, role, transactionId);

    const stage4 = this.buildReviewPeriodStage(transaction, stage3, role, transactionId);

    const stage5 = this.buildOwnershipTransferStage(
      transaction,
      stage4,
      role,
      transactionId
    );

    return [stage1, stage2, stage3, stage4, stage5];
  }

  private buildOfferAcceptedStage(transaction: TransactionWithRelations): TimelineStage {
    if (transaction.offer) {
      return {
        name: 'Offer Accepted',
        status: 'completed',
        completedAt: transaction.offer.respondedAt,
        description: `Offer of $${(transaction.offer.offeredPriceCents / 100).toFixed(2)} accepted`,
        actions: [],
      };
    }

    return {
      name: 'Offer Accepted',
      status: 'completed',
      completedAt: transaction.createdAt,
      description: 'Direct purchase at listing price',
      actions: [],
    };
  }

  private buildPaymentReceivedStage(
    transaction: TransactionWithRelations
  ): TimelineStage {
    const paymentSucceeded = transaction.paymentStatus === 'succeeded';
    const paymentFailed = transaction.paymentStatus === 'failed';

    let status: TimelineStageStatus;
    let description: string;

    if (paymentSucceeded) {
      status = 'completed';
      description = 'Payment processed successfully';
    } else if (paymentFailed) {
      status = 'failed';
      description = 'Payment failed';
    } else {
      status = 'active';
      description = 'Waiting for payment confirmation';
    }

    return {
      name: 'Payment Received',
      status,
      completedAt: paymentSucceeded ? transaction.createdAt : null,
      description,
      actions: [],
    };
  }

  private buildRepositoryTransferStage(
    transaction: TransactionWithRelations,
    role: string,
    transactionId: string
  ): TimelineStage {
    if (!transaction.project.githubUrl) {
      return {
        name: 'Collaborator Access',
        status: 'skipped',
        completedAt: null,
        description: 'No GitHub repository linked to this project',
        actions: [],
      };
    }

    const transferRecord = transaction.repositoryTransfer;
    const connectGithubAction: TimelineAction = {
      label: 'Connect GitHub Account',
      type: 'primary',
      url: `/checkout/success?transactionId=${transactionId}`,
    };

    if (transferRecord) {
      let status: TimelineStageStatus;
      let description: string;

      switch (transferRecord.status) {
        case 'completed':
        case 'invitation_sent':
        case 'accepted':
        case 'transfer_initiated':
        case 'ownership_transferred':
          status = 'completed';
          description =
            'Collaborator access granted — buyer has been added to the repository';
          break;
        case 'failed':
          status = 'failed';
          description =
            'Collaborator access failed: ' +
            (transferRecord.errorMessage || 'Unknown error');
          break;
        case 'pending':
        default:
          status = 'active';
          description = 'Awaiting buyer GitHub username';
          break;
      }

      return {
        name: 'Collaborator Access',
        status,
        completedAt:
          status === 'completed'
            ? (transferRecord.invitationSentAt ?? transferRecord.completedAt)
            : null,
        description,
        actions: status === 'active' && role === 'buyer' ? [connectGithubAction] : [],
      };
    }

    const paymentSucceeded = transaction.paymentStatus === 'succeeded';

    if (!paymentSucceeded) {
      return {
        name: 'Collaborator Access',
        status: 'upcoming',
        completedAt: null,
        description: 'Will begin after payment is confirmed',
        actions: [],
      };
    }

    return {
      name: 'Collaborator Access',
      status: 'active',
      completedAt: null,
      description: 'Awaiting buyer GitHub username',
      actions: role === 'buyer' ? [connectGithubAction] : [],
    };
  }

  private buildReviewPeriodStage(
    transaction: TransactionWithRelations,
    _stage3: TimelineStage,
    role: string,
    transactionId: string
  ): TimelineStage {
    const actions: TimelineAction[] = [];
    const paymentDone = transaction.paymentStatus === 'succeeded';
    const escrowReleaseDate = transaction.escrowReleaseDate;
    const now = new Date();

    const daysRemaining = escrowReleaseDate
      ? Math.max(0, Math.ceil((escrowReleaseDate.getTime() - now.getTime()) / 86400000))
      : null;

    let status: TimelineStageStatus;
    let description: string;

    if (!paymentDone) {
      status = 'upcoming';
      description = 'Review period begins after payment';
    } else if (escrowReleaseDate && now >= escrowReleaseDate) {
      status = 'completed';
      description = 'Review period has ended';
    } else {
      status = 'active';
      const days = daysRemaining ?? 7;
      description = `${days} day${days !== 1 ? 's' : ''} remaining to review and raise any disputes`;

      if (role === 'buyer') {
        actions.push({
          label: 'Leave Review',
          type: 'link',
          url: '/transactions/' + transactionId + '/review',
        });
      }
    }

    return {
      name: 'Review Period',
      status,
      completedAt: status === 'completed' && escrowReleaseDate ? escrowReleaseDate : null,
      description,
      actions,
      metadata: {
        escrowReleaseDate: escrowReleaseDate ?? null,
        daysRemaining: daysRemaining ?? 0,
      },
    };
  }

  /**
   * Perform the final GitHub ownership transfer for a transaction.
   *
   * Implements the full transfer pipeline:
   * - Guard against duplicate processing (concurrency-safe via atomic escrow claim)
   * - Call GitHub transfer API with seller's decrypted token
   * - Release escrow if review period has ended; otherwise reset to 'held'
   * - On retryable failure: increment retry count, update status to 'failed'
   * - On 401 (token expired): do NOT increment retry count, update status to 'failed'
   *
   * @param transactionId - Transaction ID to transfer ownership for
   * @returns `{ success: true }` on success, or `{ success: false, skipped, reason }` on skip
   */
  async transferOwnership(
    transactionId: string,
    callerSellerId?: string
  ): Promise<{ success: boolean; skipped?: boolean; reason?: string }> {
    console.log('[RepositoryTransferService] transferOwnership called:', transactionId);

    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new RepositoryTransferNotFoundError('Transaction not found');
    }

    if (callerSellerId && transaction.sellerId !== callerSellerId) {
      throw new RepositoryTransferPermissionError(
        'Only the seller can initiate an ownership transfer'
      );
    }

    const transfer =
      await this.repositoryTransferRepository.findByTransactionId(transactionId);
    if (!transfer) {
      return { success: false, skipped: true, reason: 'No repository transfer record' };
    }

    if (transfer.status === 'pending') {
      return {
        success: false,
        skipped: true,
        reason: 'Transfer pending buyer GitHub username',
      };
    }

    if (!transfer.buyerGithubUsername) {
      return { success: false, skipped: true, reason: 'Buyer GitHub username not set' };
    }

    if (transfer.retryCount > 3) {
      return { success: false, skipped: true, reason: 'Max retries exceeded' };
    }

    if (!transaction.project.githubUrl) {
      return { success: false, skipped: true, reason: 'Project has no GitHub URL' };
    }
    if (!transaction.seller.githubAccessToken) {
      return {
        success: false,
        skipped: true,
        reason: 'Seller GitHub token not available',
      };
    }

    const claimed =
      await this.transactionRepository.claimForTransferProcessing(transactionId);
    if (claimed === 0) {
      return {
        success: false,
        skipped: true,
        reason: 'Already being processed by another worker',
      };
    }

    const { owner, repo } = this.gitHubService.parseGitHubUrl(
      transaction.project.githubUrl
    );
    const token = decrypt(transaction.seller.githubAccessToken);

    try {
      await this.gitHubService.transferOwnership(
        owner,
        repo,
        transfer.buyerGithubUsername,
        token
      );

      await this.repositoryTransferRepository.updateStatus(
        transfer.id,
        'transfer_initiated',
        {
          transferInitiatedAt: new Date(),
        }
      );

      const now = new Date();
      const reviewEnded =
        transaction.escrowReleaseDate != null && now >= transaction.escrowReleaseDate;

      if (reviewEnded) {
        await this.transactionRepository.releaseEscrow(transactionId);
      } else {
        await this.transactionRepository.updateEscrowStatus(transactionId, 'held');
      }

      return { success: true };
    } catch (error) {
      const isNonRetryable =
        error instanceof GitHubServiceError && error.statusCode === 401;

      if (isNonRetryable) {
        console.error(
          `[RepositoryTransferService] [ADMIN_ACTION_REQUIRED] Seller OAuth token expired/revoked for transaction ${transactionId}. ` +
            `Seller must reconnect their GitHub account. Transfer ID: ${transfer.id}`
        );
      } else {
        await this.repositoryTransferRepository.incrementRetryCount(transfer.id);
      }

      await this.repositoryTransferRepository.updateStatus(transfer.id, 'failed', {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        failedAt: new Date(),
      });

      await this.transactionRepository.updateEscrowStatus(transactionId, 'held');

      return { success: false };
    }
  }

  /**
   * Process all pending automatic ownership transfers (called by cron).
   *
   * Finds all GitHub-linked transactions with held escrow and attempts transfers.
   * Skips pending transfers (buyer has not submitted username) without retry.
   * Applies 14-day absolute fallback: if retries exhausted AND transaction is 14+ days old,
   * releases escrow directly without a GitHub transfer.
   *
   * @returns `{ processed }` — count of transactions successfully handled
   */
  async processAutoTransfers(): Promise<{ processed: number }> {
    console.log('[RepositoryTransferService] processAutoTransfers called');

    const now = new Date();
    const transactions =
      await this.transactionRepository.findTransactionsForAutoTransfer(now);

    let processed = 0;

    for (const txn of transactions as AutoTransferEligibleTransaction[]) {
      const rt = txn.repositoryTransfer;
      if (!rt) continue;

      if (rt.status === 'pending') {
        continue;
      }

      if (rt.retryCount > 3) {
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        if (txn.createdAt <= fourteenDaysAgo) {
          await this.transactionRepository.releaseEscrow(txn.id);
          processed++;
        }
        continue;
      }

      try {
        const result = await this.transferOwnership(txn.id);
        if (result.success) {
          processed++;
        }
      } catch (err) {
        console.error(
          '[RepositoryTransferService] Unexpected error processing transfer:',
          txn.id,
          err
        );
      }
    }

    return { processed };
  }

  private buildOwnershipTransferStage(
    transaction: TransactionWithRelations,
    stage4: TimelineStage,
    role: string,
    transactionId: string
  ): TimelineStage {
    const actions: TimelineAction[] = [];
    const transferRecord = transaction.repositoryTransfer;
    const transferStatus = transferRecord?.status;
    const escrowReleaseDate = transaction.escrowReleaseDate;
    const now = new Date();
    const reviewEnded = escrowReleaseDate != null && now >= escrowReleaseDate;

    let status: TimelineStageStatus;
    let description: string;

    if (transaction.escrowStatus === 'released') {
      status = 'completed';
      description = 'Ownership transferred — funds have been released to the seller';
    } else if (
      transferStatus === 'transfer_initiated' ||
      transferStatus === 'ownership_transferred'
    ) {
      status = 'active';
      description =
        'Ownership transfer in progress — buyer must accept the GitHub invitation';
    } else if (stage4.status === 'completed' || reviewEnded) {
      status = 'active';
      description = 'Review period complete — awaiting ownership transfer';

      if (role === 'seller' && transaction.project.githubUrl) {
        actions.push({
          label: 'Transfer Now',
          type: 'primary',
          apiEndpoint: '/api/transactions/' + transactionId + '/transfer-ownership',
          apiMethod: 'POST',
        });
      }
    } else {
      status = 'upcoming';
      description = 'Ownership transfer will happen after the review period';

      if (
        role === 'seller' &&
        transaction.project.githubUrl &&
        transferStatus &&
        ['invitation_sent', 'accepted', 'completed'].includes(transferStatus)
      ) {
        actions.push({
          label: 'Transfer Early',
          type: 'secondary',
          apiEndpoint: '/api/transactions/' + transactionId + '/transfer-ownership',
          apiMethod: 'POST',
        });
      }
    }

    return {
      name: 'Ownership Transfer',
      status,
      completedAt: transaction.releasedToSellerAt ?? null,
      description,
      actions,
    };
  }
}
