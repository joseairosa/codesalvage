/**
 * TransactionService
 *
 * Business logic layer for transaction operations.
 * Handles validation, permissions, and orchestrates transaction workflows.
 *
 * Responsibilities:
 * - Transaction creation with validation
 * - Transaction access control
 * - Payment and escrow status management
 * - Code delivery tracking
 *
 * Architecture:
 * - Depends on TransactionRepository, UserRepository, ProjectRepository
 * - Validates business rules before database operations
 * - Throws typed errors for HTTP status mapping
 */

import type {
  TransactionRepository,
  TransactionWithRelations,
  PaginatedTransactions,
  PaginationOptions,
  CreateTransactionInput,
} from '../repositories/TransactionRepository';
import type { UserRepository } from '../repositories/UserRepository';
import type { ProjectRepository } from '../repositories/ProjectRepository';

/**
 * Transaction validation error
 */
export class TransactionValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = 'TransactionValidationError';
  }
}

/**
 * Transaction permission error
 */
export class TransactionPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransactionPermissionError';
  }
}

/**
 * Transaction not found error
 */
export class TransactionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransactionNotFoundError';
  }
}

/**
 * Request to create a new transaction
 */
export interface CreateTransactionRequest {
  projectId: string;
  stripePaymentIntentId?: string;
  notes?: string;
}

/**
 * TransactionService
 *
 * Handles all transaction business logic.
 */
export class TransactionService {
  constructor(
    private transactionRepository: TransactionRepository,
    private userRepository: UserRepository,
    private projectRepository: ProjectRepository
  ) {
    console.log('[TransactionService] Initialized');
  }

  /**
   * Create a new transaction
   *
   * Validates that:
   * - Buyer exists
   * - Project exists and is active
   * - Buyer is not the seller
   * - Project has not been purchased by this buyer already
   *
   * @param buyerId - Buyer user ID
   * @param data - Transaction creation request
   * @returns Created transaction with relations
   */
  async createTransaction(
    buyerId: string,
    data: CreateTransactionRequest
  ): Promise<TransactionWithRelations> {
    console.log('[TransactionService] Creating transaction:', {
      buyerId,
      projectId: data.projectId,
    });

    // Validate buyer exists
    const buyer = await this.userRepository.findById(buyerId);
    if (!buyer) {
      throw new TransactionValidationError('Buyer not found', 'buyerId');
    }

    // Validate project exists and is active
    const project = await this.projectRepository.findById(data.projectId);
    if (!project) {
      throw new TransactionValidationError('Project not found', 'projectId');
    }

    if (project.status !== 'active') {
      throw new TransactionValidationError(
        'Project is not available for purchase',
        'projectId'
      );
    }

    // Validate buyer is not the seller
    if (project.sellerId === buyerId) {
      throw new TransactionPermissionError('Cannot purchase your own project');
    }

    // Check if buyer has already purchased this project
    const existingTransactions = await this.transactionRepository.findByProjectId(
      data.projectId,
      { page: 1, limit: 100 }
    );

    const alreadyPurchased = existingTransactions.transactions.some(
      (t) => t.buyerId === buyerId && t.paymentStatus === 'succeeded'
    );

    if (alreadyPurchased) {
      throw new TransactionValidationError(
        'You have already purchased this project',
        'projectId'
      );
    }

    // Calculate commission (18% platform fee)
    const commissionRate = 0.18;
    const amountCents = project.priceCents;
    const commissionCents = Math.round(amountCents * commissionRate);
    const sellerReceivesCents = amountCents - commissionCents;

    // Calculate escrow release date (7 days from now)
    const escrowReleaseDate = new Date();
    escrowReleaseDate.setDate(escrowReleaseDate.getDate() + 7);

    // Create transaction
    const transactionInput: CreateTransactionInput = {
      projectId: data.projectId,
      sellerId: project.sellerId,
      buyerId,
      amountCents,
      commissionCents,
      sellerReceivesCents,
      stripePaymentIntentId: data.stripePaymentIntentId,
      escrowReleaseDate,
      notes: data.notes,
    };

    const transaction =
      await this.transactionRepository.create(transactionInput);

    console.log('[TransactionService] Transaction created:', transaction.id);

    return transaction;
  }

  /**
   * Get buyer's transaction history
   *
   * @param buyerId - Buyer user ID
   * @param options - Pagination options
   * @returns Paginated transactions
   */
  async getBuyerTransactions(
    buyerId: string,
    options?: PaginationOptions
  ): Promise<PaginatedTransactions> {
    console.log('[TransactionService] Getting buyer transactions:', buyerId);

    // Validate buyer exists
    const buyer = await this.userRepository.findById(buyerId);
    if (!buyer) {
      throw new TransactionValidationError('Buyer not found', 'buyerId');
    }

    return await this.transactionRepository.findByBuyerId(buyerId, options);
  }

  /**
   * Get seller's transaction history
   *
   * @param sellerId - Seller user ID
   * @param options - Pagination options
   * @returns Paginated transactions
   */
  async getSellerTransactions(
    sellerId: string,
    options?: PaginationOptions
  ): Promise<PaginatedTransactions> {
    console.log('[TransactionService] Getting seller transactions:', sellerId);

    // Validate seller exists
    const seller = await this.userRepository.findById(sellerId);
    if (!seller) {
      throw new TransactionValidationError('Seller not found', 'sellerId');
    }

    return await this.transactionRepository.findBySellerId(sellerId, options);
  }

  /**
   * Get transaction by ID with access validation
   *
   * @param transactionId - Transaction ID
   * @param userId - User requesting access
   * @returns Transaction if user has access
   */
  async getTransactionById(
    transactionId: string,
    userId: string
  ): Promise<TransactionWithRelations> {
    console.log('[TransactionService] Getting transaction by ID:', {
      transactionId,
      userId,
    });

    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new TransactionNotFoundError('Transaction not found');
    }

    // Validate user has access (must be buyer or seller)
    if (transaction.buyerId !== userId && transaction.sellerId !== userId) {
      throw new TransactionPermissionError(
        'You do not have access to this transaction'
      );
    }

    return transaction;
  }

  /**
   * Check if user is buyer or seller of a transaction
   *
   * @param transactionId - Transaction ID
   * @param userId - User ID to check
   * @returns True if user is buyer or seller
   */
  async isUserBuyerOrSeller(
    transactionId: string,
    userId: string
  ): Promise<boolean> {
    console.log('[TransactionService] Checking user access:', {
      transactionId,
      userId,
    });

    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      return false;
    }

    return transaction.buyerId === userId || transaction.sellerId === userId;
  }

  /**
   * Validate that user is the buyer of a transaction
   *
   * Used for operations only buyers can perform (e.g., submitting reviews)
   *
   * @param transactionId - Transaction ID
   * @param userId - User ID to validate
   * @returns True if user is the buyer
   * @throws TransactionNotFoundError if transaction doesn't exist
   * @throws TransactionPermissionError if user is not the buyer
   */
  async validateUserIsBuyer(
    transactionId: string,
    userId: string
  ): Promise<boolean> {
    console.log('[TransactionService] Validating user is buyer:', {
      transactionId,
      userId,
    });

    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new TransactionNotFoundError('Transaction not found');
    }

    if (transaction.buyerId !== userId) {
      throw new TransactionPermissionError(
        'Only the buyer can perform this action'
      );
    }

    return true;
  }

  /**
   * Check if a transaction has payment succeeded
   *
   * @param transactionId - Transaction ID
   * @returns True if payment succeeded
   */
  async hasPaymentSucceeded(transactionId: string): Promise<boolean> {
    console.log('[TransactionService] Checking payment status:', transactionId);

    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new TransactionNotFoundError('Transaction not found');
    }

    return transaction.paymentStatus === 'succeeded';
  }

  /**
   * Get transaction by Stripe Payment Intent ID
   *
   * Used for Stripe webhook handling
   *
   * @param stripePaymentIntentId - Stripe Payment Intent ID
   * @returns Transaction or null
   */
  async getTransactionByStripePaymentIntentId(
    stripePaymentIntentId: string
  ): Promise<TransactionWithRelations | null> {
    console.log(
      '[TransactionService] Getting transaction by Stripe Payment Intent ID:',
      stripePaymentIntentId
    );

    return await this.transactionRepository.findByStripePaymentIntentId(
      stripePaymentIntentId
    );
  }

  /**
   * Update transaction payment status
   *
   * @param transactionId - Transaction ID
   * @param status - New payment status
   */
  async updatePaymentStatus(transactionId: string, status: string): Promise<void> {
    console.log('[TransactionService] Updating payment status:', {
      transactionId,
      status,
    });

    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new TransactionNotFoundError('Transaction not found');
    }

    await this.transactionRepository.updatePaymentStatus(transactionId, status);
  }

  /**
   * Update transaction escrow status
   *
   * @param transactionId - Transaction ID
   * @param status - New escrow status
   */
  async updateEscrowStatus(transactionId: string, status: string): Promise<void> {
    console.log('[TransactionService] Updating escrow status:', {
      transactionId,
      status,
    });

    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new TransactionNotFoundError('Transaction not found');
    }

    await this.transactionRepository.updateEscrowStatus(transactionId, status);
  }

  /**
   * Release escrow to seller
   *
   * @param transactionId - Transaction ID
   */
  async releaseEscrow(transactionId: string): Promise<void> {
    console.log('[TransactionService] Releasing escrow:', transactionId);

    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new TransactionNotFoundError('Transaction not found');
    }

    if (transaction.escrowStatus === 'released') {
      console.warn(
        '[TransactionService] Escrow already released, skipping:',
        transactionId
      );
      return;
    }

    if (transaction.paymentStatus !== 'succeeded') {
      throw new TransactionValidationError(
        'Cannot release escrow for unsuccessful payment',
        'paymentStatus'
      );
    }

    await this.transactionRepository.releaseEscrow(transactionId);
    console.log('[TransactionService] Escrow released:', transactionId);
  }

  /**
   * Mark code as accessed by buyer
   *
   * @param transactionId - Transaction ID
   * @param userId - User accessing the code
   */
  async markCodeAccessed(transactionId: string, userId: string): Promise<void> {
    console.log('[TransactionService] Marking code as accessed:', {
      transactionId,
      userId,
    });

    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new TransactionNotFoundError('Transaction not found');
    }

    // Only buyer can access code
    if (transaction.buyerId !== userId) {
      throw new TransactionPermissionError('Only the buyer can access the code');
    }

    // Code can only be accessed after successful payment
    if (transaction.paymentStatus !== 'succeeded') {
      throw new TransactionValidationError(
        'Code cannot be accessed before successful payment',
        'paymentStatus'
      );
    }

    await this.transactionRepository.markCodeAccessed(transactionId);
    console.log('[TransactionService] Code access marked:', transactionId);
  }
}
