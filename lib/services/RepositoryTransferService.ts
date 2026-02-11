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
  TransactionRepository,
  TransactionWithRelations,
} from '../repositories/TransactionRepository';
import type { GitHubService } from './GitHubService';
import type { NotificationService } from './NotificationService';
import { decrypt } from '@/lib/encryption';

// ---------- Error classes ----------

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

// ---------- Timeline types ----------

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

// ---------- Service ----------

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

    // Fetch and validate transaction
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

    // Check no existing transfer
    const existingTransfer =
      await this.repositoryTransferRepository.findByTransactionId(transactionId);
    if (existingTransfer) {
      throw new RepositoryTransferValidationError('Transfer already initiated');
    }

    // Validate seller GitHub connectivity
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
      // Buyer has GitHub username — send invitation immediately
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
      // Buyer has no GitHub username — create pending transfer
      transfer = await this.repositoryTransferRepository.create({
        transactionId,
        githubRepoFullName: owner + '/' + repo,
        sellerGithubUsername: sellerGithubUsername!,
        status: 'pending',
        initiatedAt: new Date(),
      });
    }

    console.log('[RepositoryTransferService] Transfer created:', transfer.id);

    // Notify buyer (fire-and-forget)
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
   * Set the buyer's GitHub username on a transfer.
   *
   * If the transfer was already initiated by the seller (status 'pending'),
   * the invitation is sent automatically after setting the username.
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

    // Fetch and validate transaction
    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new RepositoryTransferNotFoundError('Transaction not found');
    }

    if (transaction.buyerId !== buyerId) {
      throw new RepositoryTransferPermissionError(
        'Only the buyer can set their GitHub username'
      );
    }

    // Find existing transfer
    const transfer =
      await this.repositoryTransferRepository.findByTransactionId(transactionId);
    if (!transfer) {
      throw new RepositoryTransferNotFoundError('Repository transfer not found');
    }

    // Update the username
    let updated = await this.repositoryTransferRepository.setBuyerGithubUsername(
      transfer.id,
      username
    );

    // Auto-send invitation if transfer is pending and seller already initiated
    if (transfer.status === 'pending' && transfer.initiatedAt) {
      const token = decrypt(transaction.seller.githubAccessToken!);
      const { owner, repo } = this.gitHubService.parseGitHubUrl(
        transaction.project.githubUrl!
      );

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

    // Fetch and validate transaction
    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new RepositoryTransferNotFoundError('Transaction not found');
    }

    if (transaction.buyerId !== buyerId) {
      throw new RepositoryTransferPermissionError(
        'Only the buyer can confirm the repository transfer'
      );
    }

    // Find existing transfer
    const transfer =
      await this.repositoryTransferRepository.findByTransactionId(transactionId);
    if (!transfer) {
      throw new RepositoryTransferNotFoundError('Repository transfer not found');
    }

    // Mark as completed
    const updated = await this.repositoryTransferRepository.updateStatus(
      transfer.id,
      'completed',
      { completedAt: new Date() }
    );

    console.log('[RepositoryTransferService] Transfer confirmed:', updated.id);

    // Notify seller (fire-and-forget)
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

    // Fetch and validate transaction
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

    // Stage 1 — Offer Accepted
    const stage1 = this.buildOfferAcceptedStage(transaction);

    // Stage 2 — Payment Received
    const stage2 = this.buildPaymentReceivedStage(transaction);

    // Stage 3 — Repository Transfer
    const stage3 = this.buildRepositoryTransferStage(transaction, role, transactionId);

    // Stage 4 — Review Period
    const stage4 = this.buildReviewPeriodStage(transaction, stage3, role, transactionId);

    // Stage 5 — Escrow Released
    const stage5 = this.buildEscrowReleasedStage(transaction, stage4);

    return [stage1, stage2, stage3, stage4, stage5];
  }

  // ---------- Private stage builders ----------

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

    // Direct purchase (no offer)
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
    const actions: TimelineAction[] = [];

    // No GitHub URL — skip stage
    if (!transaction.project.githubUrl) {
      return {
        name: 'Repository Transfer',
        status: 'skipped',
        completedAt: null,
        description: 'No GitHub repository linked to this project',
        actions,
      };
    }

    const transferRecord = transaction.repositoryTransfer;

    if (transferRecord) {
      let status: TimelineStageStatus;
      let description: string;

      switch (transferRecord.status) {
        case 'completed':
          status = 'completed';
          description = 'Repository access has been transferred';
          break;
        case 'invitation_sent':
        case 'accepted':
          status = 'active';
          description =
            transferRecord.status === 'invitation_sent'
              ? 'GitHub invitation sent — waiting for buyer to accept'
              : 'Invitation accepted — waiting for buyer to confirm access';
          break;
        case 'failed':
          status = 'failed';
          description =
            'Repository transfer failed: ' +
            (transferRecord.errorMessage || 'Unknown error');
          break;
        case 'pending':
        default:
          status = 'active';
          description = 'Transfer initiated — waiting for buyer GitHub username';
          break;
      }

      // Actions for buyer when invitation is sent
      if (
        role === 'buyer' &&
        status === 'active' &&
        transferRecord.status === 'invitation_sent'
      ) {
        actions.push({
          label: 'Confirm Access',
          type: 'primary',
          apiEndpoint: '/api/transactions/' + transactionId + '/confirm-transfer',
          apiMethod: 'POST',
        });
      }

      return {
        name: 'Repository Transfer',
        status,
        completedAt: transferRecord.completedAt,
        description,
        actions,
      };
    }

    // No transfer record yet
    const paymentSucceeded = transaction.paymentStatus === 'succeeded';

    if (!paymentSucceeded) {
      return {
        name: 'Repository Transfer',
        status: 'upcoming',
        completedAt: null,
        description: 'Will begin after payment is confirmed',
        actions,
      };
    }

    // Payment succeeded but no transfer initiated
    if (role === 'seller') {
      actions.push({
        label: 'Transfer Repository',
        type: 'primary',
        apiEndpoint: '/api/transactions/' + transactionId + '/repository-transfer',
        apiMethod: 'POST',
      });
    }

    return {
      name: 'Repository Transfer',
      status: 'active',
      completedAt: null,
      description: 'Waiting for seller to initiate repository transfer',
      actions,
    };
  }

  private buildReviewPeriodStage(
    transaction: TransactionWithRelations,
    stage3: TimelineStage,
    role: string,
    transactionId: string
  ): TimelineStage {
    const actions: TimelineAction[] = [];
    const transferDoneOrSkipped =
      stage3.status === 'completed' || stage3.status === 'skipped';
    const paymentDone = transaction.paymentStatus === 'succeeded';

    let status: TimelineStageStatus;
    let description: string;

    const escrowReleaseDate = transaction.escrowReleaseDate;
    const now = new Date();

    if (!paymentDone) {
      status = 'upcoming';
      description = 'Review period begins after payment';
    } else if (paymentDone && escrowReleaseDate && now >= escrowReleaseDate) {
      status = 'completed';
      description = 'Review period has ended';
    } else if (paymentDone && transferDoneOrSkipped) {
      status = 'active';
      description = 'Review period is active';

      if (role === 'buyer') {
        actions.push({
          label: 'Leave Review',
          type: 'link',
          url: '/transactions/' + transactionId + '/review',
        });
      }
    } else {
      status = 'upcoming';
      description = 'Review period begins after repository transfer';
    }

    const daysRemaining = escrowReleaseDate
      ? Math.max(0, Math.ceil((escrowReleaseDate.getTime() - now.getTime()) / 86400000))
      : null;

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

  private buildEscrowReleasedStage(
    transaction: TransactionWithRelations,
    stage4: TimelineStage
  ): TimelineStage {
    let status: TimelineStageStatus;
    let description: string;

    if (transaction.escrowStatus === 'released') {
      status = 'completed';
      description = 'Funds have been released to the seller';
    } else if (stage4.status === 'completed') {
      status = 'active';
      description = 'Escrow is ready to be released';
    } else {
      status = 'upcoming';
      description = 'Funds will be released after the review period';
    }

    return {
      name: 'Escrow Released',
      status,
      completedAt: transaction.releasedToSellerAt ?? null,
      description,
      actions: [],
    };
  }
}
