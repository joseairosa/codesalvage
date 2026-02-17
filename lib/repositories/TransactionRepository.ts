/**
 * TransactionRepository
 *
 * Data access layer for transaction/payment operations.
 * Abstracts all Prisma database operations for transactions.
 *
 * Responsibilities:
 * - CRUD operations for transactions
 * - Transaction queries with pagination
 * - Payment and escrow status updates
 * - Code delivery tracking
 *
 * Architecture:
 * - Pure data access, no business logic
 * - Returns typed Prisma models
 * - Comprehensive error logging with [TransactionRepository] prefix
 */

import type { PrismaClient, Transaction } from '@prisma/client';

/**
 * Input data for creating a new transaction
 */
export interface CreateTransactionInput {
  projectId: string;
  sellerId: string;
  buyerId: string;
  amountCents: number;
  commissionCents: number;
  sellerReceivesCents: number;
  stripePaymentIntentId?: string | null;
  escrowReleaseDate?: Date | null;
  notes?: string | null;
}

/**
 * Transaction with all related data
 */
export interface TransactionWithRelations extends Transaction {
  project: {
    id: string;
    title: string;
    description: string;
    thumbnailImageUrl: string | null;
    priceCents: number;
    status: string;
    githubUrl: string | null;
    githubRepoName: string | null;
  };
  seller: {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
    stripeAccountId: string | null;
    email: string | null;
    githubUsername: string | null;
    githubAccessToken: string | null;
  };
  buyer: {
    id: string;
    username: string;
    fullName: string | null;
    avatarUrl: string | null;
    email: string | null;
    githubUsername: string | null;
  };
  review?: {
    id: string;
    overallRating: number;
    comment: string | null;
    createdAt: Date;
  } | null;
  offer?: {
    id: string;
    status: string;
    offeredPriceCents: number;
    respondedAt: Date | null;
  } | null;
  repositoryTransfer?: {
    id: string;
    githubRepoFullName: string;
    method: string;
    status: string;
    githubInvitationId: string | null;
    sellerGithubUsername: string;
    buyerGithubUsername: string | null;
    initiatedAt: Date | null;
    invitationSentAt: Date | null;
    acceptedAt: Date | null;
    completedAt: Date | null;
    failedAt: Date | null;
    errorMessage: string | null;
    retryCount: number;
    createdAt: Date;
  } | null;
}

/**
 * Paginated transaction results
 */
export interface PaginatedTransactions {
  transactions: TransactionWithRelations[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Pagination configuration
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

/**
 * TransactionRepository
 *
 * Handles all database operations for transactions.
 */
export class TransactionRepository {
  constructor(private prisma: PrismaClient) {
    console.log('[TransactionRepository] Initialized');
  }

  /**
   * Find transaction by ID with all relations
   *
   * @param id - Transaction ID
   * @returns Transaction with relations or null
   */
  async findById(id: string): Promise<TransactionWithRelations | null> {
    try {
      console.log('[TransactionRepository] Finding transaction by ID:', id);

      const transaction = await this.prisma.transaction.findUnique({
        where: { id },
        include: {
          project: {
            select: {
              id: true,
              title: true,
              description: true,
              thumbnailImageUrl: true,
              priceCents: true,
              status: true,
              githubUrl: true,
              githubRepoName: true,
            },
          },
          seller: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
              stripeAccountId: true,
              email: true,
              githubUsername: true,
              githubAccessToken: true,
            },
          },
          buyer: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
              email: true,
              githubUsername: true,
            },
          },
          review: {
            select: {
              id: true,
              overallRating: true,
              comment: true,
              createdAt: true,
            },
          },
          offer: {
            select: {
              id: true,
              status: true,
              offeredPriceCents: true,
              respondedAt: true,
            },
          },
          repositoryTransfer: true,
        },
      });

      return transaction as TransactionWithRelations | null;
    } catch (error) {
      console.error('[TransactionRepository] findById failed:', error);
      throw new Error('[TransactionRepository] Failed to find transaction by ID');
    }
  }

  /**
   * Find transactions by buyer ID with pagination
   *
   * @param buyerId - Buyer user ID
   * @param options - Pagination options
   * @returns Paginated transactions
   */
  async findByBuyerId(
    buyerId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedTransactions> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      console.log('[TransactionRepository] Finding transactions by buyer:', {
        buyerId,
        page,
        limit,
      });

      const [transactions, total] = await Promise.all([
        this.prisma.transaction.findMany({
          where: { buyerId },
          include: {
            project: {
              select: {
                id: true,
                title: true,
                description: true,
                thumbnailImageUrl: true,
                priceCents: true,
                status: true,
              },
            },
            seller: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
                stripeAccountId: true,
              },
            },
            buyer: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
              },
            },
            review: {
              select: {
                id: true,
                overallRating: true,
                comment: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.transaction.count({ where: { buyerId } }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        transactions: transactions as unknown as TransactionWithRelations[],
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    } catch (error) {
      console.error('[TransactionRepository] findByBuyerId failed:', error);
      throw new Error('[TransactionRepository] Failed to find transactions by buyer');
    }
  }

  /**
   * Find transactions by seller ID with pagination
   *
   * @param sellerId - Seller user ID
   * @param options - Pagination options
   * @returns Paginated transactions
   */
  async findBySellerId(
    sellerId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedTransactions> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      console.log('[TransactionRepository] Finding transactions by seller:', {
        sellerId,
        page,
        limit,
      });

      const [transactions, total] = await Promise.all([
        this.prisma.transaction.findMany({
          where: { sellerId },
          include: {
            project: {
              select: {
                id: true,
                title: true,
                description: true,
                thumbnailImageUrl: true,
                priceCents: true,
                status: true,
              },
            },
            seller: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
                stripeAccountId: true,
              },
            },
            buyer: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
              },
            },
            review: {
              select: {
                id: true,
                overallRating: true,
                comment: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.transaction.count({ where: { sellerId } }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        transactions: transactions as unknown as TransactionWithRelations[],
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    } catch (error) {
      console.error('[TransactionRepository] findBySellerId failed:', error);
      throw new Error('[TransactionRepository] Failed to find transactions by seller');
    }
  }

  /**
   * Find transactions by project ID with pagination
   *
   * @param projectId - Project ID
   * @param options - Pagination options
   * @returns Paginated transactions
   */
  async findByProjectId(
    projectId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedTransactions> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      console.log('[TransactionRepository] Finding transactions by project:', {
        projectId,
        page,
        limit,
      });

      const [transactions, total] = await Promise.all([
        this.prisma.transaction.findMany({
          where: { projectId },
          include: {
            project: {
              select: {
                id: true,
                title: true,
                description: true,
                thumbnailImageUrl: true,
                priceCents: true,
                status: true,
              },
            },
            seller: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
                stripeAccountId: true,
              },
            },
            buyer: {
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
              },
            },
            review: {
              select: {
                id: true,
                overallRating: true,
                comment: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.transaction.count({ where: { projectId } }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        transactions: transactions as unknown as TransactionWithRelations[],
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      };
    } catch (error) {
      console.error('[TransactionRepository] findByProjectId failed:', error);
      throw new Error('[TransactionRepository] Failed to find transactions by project');
    }
  }

  /**
   * Create a new transaction
   *
   * @param data - Transaction creation data
   * @returns Created transaction with relations
   */
  async create(data: CreateTransactionInput): Promise<TransactionWithRelations> {
    try {
      console.log('[TransactionRepository] Creating transaction:', {
        projectId: data.projectId,
        buyerId: data.buyerId,
      });

      const transaction = await this.prisma.transaction.create({
        data: {
          projectId: data.projectId,
          sellerId: data.sellerId,
          buyerId: data.buyerId,
          amountCents: data.amountCents,
          commissionCents: data.commissionCents,
          sellerReceivesCents: data.sellerReceivesCents,
          stripePaymentIntentId: data.stripePaymentIntentId,
          escrowReleaseDate: data.escrowReleaseDate,
          notes: data.notes,
        } as any,
        include: {
          project: {
            select: {
              id: true,
              title: true,
              description: true,
              thumbnailImageUrl: true,
              priceCents: true,
              status: true,
            },
          },
          seller: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
              stripeAccountId: true,
              email: true,
            },
          },
          buyer: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
              email: true,
            },
          },
          review: {
            select: {
              id: true,
              overallRating: true,
              comment: true,
              createdAt: true,
            },
          },
        },
      });

      return transaction as TransactionWithRelations;
    } catch (error) {
      console.error('[TransactionRepository] create failed:', error);
      throw new Error('[TransactionRepository] Failed to create transaction');
    }
  }

  /**
   * Update transaction payment status
   *
   * @param id - Transaction ID
   * @param status - New payment status
   * @returns Updated transaction
   */
  async updatePaymentStatus(id: string, status: string): Promise<Transaction> {
    try {
      console.log('[TransactionRepository] Updating payment status:', { id, status });

      const transaction = await this.prisma.transaction.update({
        where: { id },
        data: { paymentStatus: status },
      });

      return transaction;
    } catch (error) {
      console.error('[TransactionRepository] updatePaymentStatus failed:', error);
      throw new Error('[TransactionRepository] Failed to update payment status');
    }
  }

  /**
   * Update transaction escrow status
   *
   * @param id - Transaction ID
   * @param status - New escrow status
   * @returns Updated transaction
   */
  async updateEscrowStatus(id: string, status: string): Promise<Transaction> {
    try {
      console.log('[TransactionRepository] Updating escrow status:', { id, status });

      const transaction = await this.prisma.transaction.update({
        where: { id },
        data: { escrowStatus: status },
      });

      return transaction;
    } catch (error) {
      console.error('[TransactionRepository] updateEscrowStatus failed:', error);
      throw new Error('[TransactionRepository] Failed to update escrow status');
    }
  }

  /**
   * Mark transaction as refunded (atomic update)
   *
   * Updates both paymentStatus and escrowStatus in a single Prisma update
   * to prevent inconsistent state if one update fails.
   *
   * @param id - Transaction ID
   * @returns Updated transaction
   */
  async markRefunded(id: string): Promise<Transaction> {
    try {
      console.log('[TransactionRepository] Marking transaction as refunded:', id);

      const transaction = await this.prisma.transaction.update({
        where: { id },
        data: {
          paymentStatus: 'refunded',
          escrowStatus: 'released',
        },
      });

      return transaction;
    } catch (error) {
      console.error('[TransactionRepository] markRefunded failed:', error);
      throw new Error('[TransactionRepository] Failed to mark transaction as refunded');
    }
  }

  /**
   * Release escrow to seller
   *
   * @param id - Transaction ID
   * @returns Updated transaction
   */
  async releaseEscrow(id: string): Promise<Transaction> {
    try {
      console.log('[TransactionRepository] Releasing escrow:', id);

      const transaction = await this.prisma.transaction.update({
        where: { id },
        data: {
          escrowStatus: 'released',
          releasedToSellerAt: new Date(),
        },
      });

      return transaction;
    } catch (error) {
      console.error('[TransactionRepository] releaseEscrow failed:', error);
      throw new Error('[TransactionRepository] Failed to release escrow');
    }
  }

  /**
   * Update code delivery status
   *
   * @param id - Transaction ID
   * @param status - New code delivery status
   * @returns Updated transaction
   */
  async updateCodeDeliveryStatus(id: string, status: string): Promise<Transaction> {
    try {
      console.log('[TransactionRepository] Updating code delivery status:', {
        id,
        status,
      });

      const transaction = await this.prisma.transaction.update({
        where: { id },
        data: { codeDeliveryStatus: status },
      });

      return transaction;
    } catch (error) {
      console.error('[TransactionRepository] updateCodeDeliveryStatus failed:', error);
      throw new Error('[TransactionRepository] Failed to update code delivery status');
    }
  }

  /**
   * Update transaction with code access timestamp
   *
   * @param id - Transaction ID
   * @returns Updated transaction
   */
  async markCodeAccessed(id: string): Promise<Transaction> {
    try {
      console.log('[TransactionRepository] Marking code as accessed:', id);

      const transaction = await this.prisma.transaction.update({
        where: { id },
        data: {
          codeAccessedAt: new Date(),
          codeDeliveryStatus: 'accessed',
        },
      });

      return transaction;
    } catch (error) {
      console.error('[TransactionRepository] markCodeAccessed failed:', error);
      throw new Error('[TransactionRepository] Failed to mark code as accessed');
    }
  }

  /**
   * Find transaction by Stripe Payment Intent ID
   *
   * @param stripePaymentIntentId - Stripe Payment Intent ID
   * @returns Transaction with relations or null
   */
  async findByStripePaymentIntentId(
    stripePaymentIntentId: string
  ): Promise<TransactionWithRelations | null> {
    try {
      console.log(
        '[TransactionRepository] Finding transaction by Stripe Payment Intent ID:',
        stripePaymentIntentId
      );

      const transaction = await this.prisma.transaction.findUnique({
        where: { stripePaymentIntentId },
        include: {
          project: {
            select: {
              id: true,
              title: true,
              description: true,
              thumbnailImageUrl: true,
              priceCents: true,
              status: true,
            },
          },
          seller: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
              stripeAccountId: true,
              email: true,
            },
          },
          buyer: {
            select: {
              id: true,
              username: true,
              fullName: true,
              avatarUrl: true,
              email: true,
            },
          },
          review: {
            select: {
              id: true,
              overallRating: true,
              comment: true,
              createdAt: true,
            },
          },
        },
      });

      return transaction as TransactionWithRelations | null;
    } catch (error) {
      console.error('[TransactionRepository] findByStripePaymentIntentId failed:', error);
      throw new Error(
        '[TransactionRepository] Failed to find transaction by Stripe Payment Intent ID'
      );
    }
  }

  /**
   * Get all transactions with admin-level access (ADMIN ONLY)
   *
   * Returns all transactions with full details, pagination, and filtering.
   * Includes buyer, seller, and project information.
   *
   * @param options - Filtering and pagination options
   * @returns Array of transactions with relations
   * @throws Error if query fails
   *
   * @example
   * const allTransactions = await transactionRepo.getAllTransactions({
   *   paymentStatus: 'succeeded',
   *   limit: 100
   * });
   */
  async getAllTransactions(options?: {
    paymentStatus?: string;
    escrowStatus?: string;
    sellerId?: string;
    buyerId?: string;
    projectId?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'amountCents' | 'escrowReleaseDate';
    sortOrder?: 'asc' | 'desc';
  }): Promise<TransactionWithRelations[]> {
    const {
      paymentStatus,
      escrowStatus,
      sellerId,
      buyerId,
      projectId,
      limit = 50,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options || {};

    console.log('[TransactionRepository] getAllTransactions called:', {
      filters: { paymentStatus, escrowStatus, sellerId, buyerId, projectId },
      limit,
      offset,
    });

    const where: any = {};

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (escrowStatus) {
      where.escrowStatus = escrowStatus;
    }

    if (sellerId) {
      where.sellerId = sellerId;
    }

    if (buyerId) {
      where.buyerId = buyerId;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    try {
      const transactions = await this.prisma.transaction.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { [sortBy]: sortOrder },
        include: {
          project: {
            select: {
              id: true,
              title: true,
              description: true,
              thumbnailImageUrl: true,
              priceCents: true,
              status: true,
            },
          },
          seller: {
            select: {
              id: true,
              username: true,
              email: true,
              fullName: true,
              avatarUrl: true,
              isVerifiedSeller: true,
              stripeAccountId: true,
            },
          },
          buyer: {
            select: {
              id: true,
              username: true,
              email: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          review: {
            select: {
              id: true,
              overallRating: true,
              comment: true,
              createdAt: true,
            },
          },
        },
      });

      console.log(
        '[TransactionRepository] Found transactions (admin):',
        transactions.length
      );
      return transactions as unknown as TransactionWithRelations[];
    } catch (error) {
      console.error('[TransactionRepository] getAllTransactions failed:', error);
      throw new Error('[TransactionRepository] Failed to get all transactions');
    }
  }

  /**
   * Count all transactions (ADMIN ONLY)
   *
   * @param options - Filtering options
   * @returns Count of transactions matching filters
   * @throws Error if query fails
   *
   * @example
   * const succeededCount = await transactionRepo.countAllTransactions({
   *   paymentStatus: 'succeeded'
   * });
   */
  async countAllTransactions(options?: {
    paymentStatus?: string;
    escrowStatus?: string;
    sellerId?: string;
    buyerId?: string;
    projectId?: string;
  }): Promise<number> {
    const { paymentStatus, escrowStatus, sellerId, buyerId, projectId } = options || {};

    console.log('[TransactionRepository] countAllTransactions called:', {
      paymentStatus,
      escrowStatus,
      sellerId,
      buyerId,
      projectId,
    });

    const where: any = {};

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (escrowStatus) {
      where.escrowStatus = escrowStatus;
    }

    if (sellerId) {
      where.sellerId = sellerId;
    }

    if (buyerId) {
      where.buyerId = buyerId;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    try {
      const count = await this.prisma.transaction.count({ where });

      console.log('[TransactionRepository] Transaction count (admin):', count);
      return count;
    } catch (error) {
      console.error('[TransactionRepository] countAllTransactions failed:', error);
      throw new Error('[TransactionRepository] Failed to count transactions');
    }
  }

  /**
   * Manually release escrow for a transaction (ADMIN ONLY)
   *
   * Used for manual intervention in dispute resolution.
   * Sets escrow status to 'released' immediately.
   *
   * @param transactionId - Transaction ID to release escrow for
   * @returns Updated transaction
   * @throws Error if transaction not found or update fails
   *
   * @example
   * const releasedTx = await transactionRepo.releaseEscrowManually('tx123');
   */
  async releaseEscrowManually(transactionId: string): Promise<Transaction> {
    console.log('[TransactionRepository] releaseEscrowManually called:', transactionId);

    try {
      const transaction = await this.prisma.transaction.update({
        where: { id: transactionId },
        data: {
          escrowStatus: 'released',
          escrowReleaseDate: new Date(),
        },
      });

      console.log('[TransactionRepository] Escrow released manually:', transactionId);
      return transaction;
    } catch (error) {
      console.error('[TransactionRepository] releaseEscrowManually failed:', error);
      throw new Error('[TransactionRepository] Failed to release escrow manually');
    }
  }
}
