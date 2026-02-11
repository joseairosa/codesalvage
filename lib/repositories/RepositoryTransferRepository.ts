/**
 * RepositoryTransferRepository — Data Access Layer for Repository Transfers
 *
 * Responsibilities:
 * - CRUD operations for repository transfer records
 * - Track GitHub repository transfer lifecycle (initiated → invited → accepted → completed)
 * - Status transitions and retry count management
 * - Query transfers by ID or transaction
 *
 * Architecture:
 * - Repository Pattern: Abstracts database operations
 * - Uses ULID for IDs (generated via ulidx)
 * - Constructor injection of PrismaClient
 * - Error handling: Catches and wraps database errors with contextual messages
 *
 * @example
 * const repoTransferRepo = new RepositoryTransferRepository(prisma);
 * const transfer = await repoTransferRepo.create({...});
 */

import type { PrismaClient, RepositoryTransfer } from '@prisma/client';
import { ulid } from 'ulidx';

// ---------- Input types ----------

export interface CreateRepositoryTransferInput {
  transactionId: string;
  githubRepoFullName: string;
  method?: string;
  status?: string;
  sellerGithubUsername: string;
  buyerGithubUsername?: string;
  githubInvitationId?: string;
  initiatedAt?: Date;
  invitationSentAt?: Date;
}

// ---------- Repository ----------

export class RepositoryTransferRepository {
  constructor(private prisma: PrismaClient) {
    console.log('[RepositoryTransferRepository] Initialized');
  }

  // ---------- create ----------

  /**
   * Create a new repository transfer record with a ULID
   *
   * @param data - Repository transfer creation data
   * @returns Created repository transfer
   */
  async create(data: CreateRepositoryTransferInput): Promise<RepositoryTransfer> {
    try {
      console.log('[RepositoryTransferRepository] Creating repository transfer', {
        transactionId: data.transactionId,
        githubRepoFullName: data.githubRepoFullName,
        sellerGithubUsername: data.sellerGithubUsername,
      });

      // Build create data conditionally for exactOptionalPropertyTypes
      const createData: {
        id: string;
        transactionId: string;
        githubRepoFullName: string;
        sellerGithubUsername: string;
        method?: string;
        status?: string;
        buyerGithubUsername?: string;
        githubInvitationId?: string;
        initiatedAt?: Date;
        invitationSentAt?: Date;
      } = {
        id: ulid(),
        transactionId: data.transactionId,
        githubRepoFullName: data.githubRepoFullName,
        sellerGithubUsername: data.sellerGithubUsername,
      };

      if (data.method !== undefined) createData.method = data.method;
      if (data.status !== undefined) createData.status = data.status;
      if (data.buyerGithubUsername !== undefined)
        createData.buyerGithubUsername = data.buyerGithubUsername;
      if (data.githubInvitationId !== undefined)
        createData.githubInvitationId = data.githubInvitationId;
      if (data.initiatedAt !== undefined) createData.initiatedAt = data.initiatedAt;
      if (data.invitationSentAt !== undefined)
        createData.invitationSentAt = data.invitationSentAt;

      const transfer = await this.prisma.repositoryTransfer.create({
        data: createData,
      });

      console.log('[RepositoryTransferRepository] Repository transfer created', {
        id: transfer.id,
      });
      return transfer;
    } catch (error) {
      console.error('[RepositoryTransferRepository] create failed:', error);
      throw new Error(
        `[RepositoryTransferRepository] Failed to create repository transfer: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ---------- findById ----------

  /**
   * Find a repository transfer by ID, including the transaction relation
   *
   * @param id - Repository transfer ID
   * @returns Repository transfer with transaction or null
   */
  async findById(id: string): Promise<RepositoryTransfer | null> {
    try {
      console.log('[RepositoryTransferRepository] Finding by ID:', id);

      const transfer = await this.prisma.repositoryTransfer.findUnique({
        where: { id },
        include: { transaction: true },
      });

      console.log('[RepositoryTransferRepository] Found:', !!transfer);
      return transfer;
    } catch (error) {
      console.error('[RepositoryTransferRepository] findById failed:', error);
      throw new Error(
        `[RepositoryTransferRepository] Failed to find repository transfer by id: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ---------- findByTransactionId ----------

  /**
   * Find a repository transfer by transaction ID
   *
   * @param transactionId - Transaction ID
   * @returns Repository transfer or null
   */
  async findByTransactionId(transactionId: string): Promise<RepositoryTransfer | null> {
    try {
      console.log(
        '[RepositoryTransferRepository] Finding by transaction ID:',
        transactionId
      );

      const transfer = await this.prisma.repositoryTransfer.findFirst({
        where: { transactionId },
      });

      console.log('[RepositoryTransferRepository] Found:', !!transfer);
      return transfer;
    } catch (error) {
      console.error('[RepositoryTransferRepository] findByTransactionId failed:', error);
      throw new Error(
        `[RepositoryTransferRepository] Failed to find repository transfer by transaction id: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ---------- updateStatus ----------

  /**
   * Update status and any extra fields on a repository transfer
   *
   * @param id - Repository transfer ID
   * @param status - New status value
   * @param extra - Optional additional fields to update (e.g. completedAt, failedAt, errorMessage)
   * @returns Updated repository transfer
   */
  async updateStatus(
    id: string,
    status: string,
    extra?: Partial<RepositoryTransfer>
  ): Promise<RepositoryTransfer> {
    try {
      console.log('[RepositoryTransferRepository] Updating status', { id, status });

      const transfer = await this.prisma.repositoryTransfer.update({
        where: { id },
        data: {
          status,
          ...extra,
        },
      });

      console.log('[RepositoryTransferRepository] Status updated', {
        id: transfer.id,
        status: transfer.status,
      });
      return transfer;
    } catch (error) {
      console.error('[RepositoryTransferRepository] updateStatus failed:', error);
      throw new Error(
        `[RepositoryTransferRepository] Failed to update repository transfer status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ---------- setBuyerGithubUsername ----------

  /**
   * Set the buyer's GitHub username on a repository transfer
   *
   * @param id - Repository transfer ID
   * @param username - Buyer's GitHub username
   * @returns Updated repository transfer
   */
  async setBuyerGithubUsername(
    id: string,
    username: string
  ): Promise<RepositoryTransfer> {
    try {
      console.log('[RepositoryTransferRepository] Setting buyer GitHub username', {
        id,
        username,
      });

      const transfer = await this.prisma.repositoryTransfer.update({
        where: { id },
        data: { buyerGithubUsername: username },
      });

      console.log('[RepositoryTransferRepository] Buyer GitHub username set', {
        id: transfer.id,
        buyerGithubUsername: transfer.buyerGithubUsername,
      });
      return transfer;
    } catch (error) {
      console.error(
        '[RepositoryTransferRepository] setBuyerGithubUsername failed:',
        error
      );
      throw new Error(
        `[RepositoryTransferRepository] Failed to set buyer GitHub username: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ---------- incrementRetryCount ----------

  /**
   * Increment the retry count by 1
   *
   * @param id - Repository transfer ID
   * @returns Updated repository transfer
   */
  async incrementRetryCount(id: string): Promise<RepositoryTransfer> {
    try {
      console.log('[RepositoryTransferRepository] Incrementing retry count', { id });

      const transfer = await this.prisma.repositoryTransfer.update({
        where: { id },
        data: {
          retryCount: { increment: 1 },
        },
      });

      console.log('[RepositoryTransferRepository] Retry count incremented', {
        id: transfer.id,
        retryCount: transfer.retryCount,
      });
      return transfer;
    } catch (error) {
      console.error('[RepositoryTransferRepository] incrementRetryCount failed:', error);
      throw new Error(
        `[RepositoryTransferRepository] Failed to increment retry count: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
