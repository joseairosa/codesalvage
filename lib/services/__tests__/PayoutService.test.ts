import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecute = vi.fn();
const mockRequestBody = vi.fn();

vi.mock('@/lib/paypal', () => ({
  getPayPalClient: vi.fn(() => ({ execute: mockExecute })),
  paypal: {
    payouts: {
      PayoutsPostRequest: vi.fn().mockImplementation(() => ({
        requestBody: mockRequestBody,
      })),
    },
  },
}));

import { PayoutService, PayoutValidationError, PayoutNotFoundError } from '../PayoutService';

const mockPayoutDetailsRepo = {
  create: vi.fn(),
  findByUserId: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
} as any;

const mockPayoutRequestRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findPending: vi.fn(),
  updateStatus: vi.fn(),
  findByBatchId: vi.fn(),
  listWithFilters: vi.fn(),
} as any;

const mockUserRepo = {
  findById: vi.fn(),
  updateUserRoles: vi.fn(),
} as any;

const mockTransactionRepo = {
  findById: vi.fn(),
} as any;

const mockEmailService = {
  sendPayoutCompletedNotification: vi.fn(),
  sendPayoutFailedNotification: vi.fn(),
} as any;

describe('PayoutService', () => {
  let service: PayoutService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PayoutService(
      mockPayoutDetailsRepo,
      mockPayoutRequestRepo,
      mockUserRepo,
      mockTransactionRepo,
      mockEmailService
    );
  });

  describe('submitPayoutDetails', () => {
    it('should create payout details and set user as verified seller', async () => {
      mockPayoutDetailsRepo.findByUserId.mockResolvedValue(null);
      mockPayoutDetailsRepo.create.mockResolvedValue({
        id: 'ulid-1',
        userId: 'user-1',
        payoutMethod: 'paypal',
        payoutEmail: 'seller@paypal.com',
        isActive: true,
      });
      mockUserRepo.updateUserRoles.mockResolvedValue({});

      const result = await service.submitPayoutDetails('user-1', {
        payoutMethod: 'paypal',
        payoutEmail: 'seller@paypal.com',
      });

      expect(mockPayoutDetailsRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        payoutMethod: 'paypal',
        payoutEmail: 'seller@paypal.com',
      });
      expect(mockUserRepo.updateUserRoles).toHaveBeenCalledWith('user-1', {
        isSeller: true,
        isVerifiedSeller: true,
      });
      expect(result.payoutEmail).toBe('seller@paypal.com');
    });

    it('should update existing payout details instead of creating new', async () => {
      mockPayoutDetailsRepo.findByUserId.mockResolvedValue({
        id: 'ulid-1',
        userId: 'user-1',
        payoutMethod: 'paypal',
        payoutEmail: 'old@paypal.com',
        isActive: true,
      });
      mockPayoutDetailsRepo.update.mockResolvedValue({
        id: 'ulid-1',
        userId: 'user-1',
        payoutMethod: 'paypal',
        payoutEmail: 'new@paypal.com',
        isActive: true,
      });
      mockUserRepo.updateUserRoles.mockResolvedValue({});

      const result = await service.submitPayoutDetails('user-1', {
        payoutMethod: 'paypal',
        payoutEmail: 'new@paypal.com',
      });

      expect(mockPayoutDetailsRepo.update).toHaveBeenCalledWith('user-1', {
        payoutMethod: 'paypal',
        payoutEmail: 'new@paypal.com',
        isActive: true,
      });
      expect(result.payoutEmail).toBe('new@paypal.com');
    });

    it('should throw validation error for invalid email', async () => {
      await expect(
        service.submitPayoutDetails('user-1', {
          payoutMethod: 'paypal',
          payoutEmail: 'not-an-email',
        })
      ).rejects.toThrow(PayoutValidationError);
    });

    it('should throw validation error for empty email', async () => {
      await expect(
        service.submitPayoutDetails('user-1', {
          payoutMethod: 'paypal',
          payoutEmail: '',
        })
      ).rejects.toThrow(PayoutValidationError);
    });
  });

  describe('createPayoutRequest', () => {
    it('should create payout request using transaction sellerReceivesCents', async () => {
      const transaction = {
        id: 'txn-1',
        sellerId: 'user-1',
        sellerReceivesCents: 82000,
        commissionCents: 18000,
        seller: { id: 'user-1' },
      };

      const payoutDetails = {
        id: 'pd-1',
        userId: 'user-1',
        payoutMethod: 'paypal',
        payoutEmail: 'seller@paypal.com',
        isActive: true,
      };

      mockTransactionRepo.findById.mockResolvedValue(transaction);
      mockPayoutDetailsRepo.findByUserId.mockResolvedValue(payoutDetails);
      mockPayoutRequestRepo.create.mockResolvedValue({
        id: 'pr-1',
        transactionId: 'txn-1',
        sellerId: 'user-1',
        amountCents: 82000,
        commissionCents: 18000,
        payoutMethod: 'paypal',
        payoutEmail: 'seller@paypal.com',
        status: 'pending',
      });

      const result = await service.createPayoutRequest('txn-1');

      expect(mockPayoutRequestRepo.create).toHaveBeenCalledWith({
        transactionId: 'txn-1',
        sellerId: 'user-1',
        amountCents: 82000,
        commissionCents: 18000,
        payoutMethod: 'paypal',
        payoutEmail: 'seller@paypal.com',
      });
      // Critical: amountCents must equal transaction.sellerReceivesCents
      expect(result.amountCents).toBe(82000);
    });

    it('should throw not found error when transaction does not exist', async () => {
      mockTransactionRepo.findById.mockResolvedValue(null);

      await expect(service.createPayoutRequest('txn-nonexistent')).rejects.toThrow(
        PayoutNotFoundError
      );
    });

    it('should throw validation error when seller has no payout details', async () => {
      mockTransactionRepo.findById.mockResolvedValue({
        id: 'txn-1',
        sellerId: 'user-1',
        sellerReceivesCents: 82000,
        commissionCents: 18000,
      });
      mockPayoutDetailsRepo.findByUserId.mockResolvedValue(null);

      await expect(service.createPayoutRequest('txn-1')).rejects.toThrow(
        PayoutValidationError
      );
    });
  });

  describe('markCompleted', () => {
    it('should mark payout as completed with admin reference', async () => {
      mockPayoutRequestRepo.findById.mockResolvedValue({
        id: 'pr-1',
        status: 'pending',
        sellerId: 'user-1',
        amountCents: 82000,
        seller: { id: 'user-1', email: 'seller@test.com', fullName: 'Seller', username: 'seller1' },
        transaction: { id: 'txn-1', projectId: 'proj-1', project: { title: 'Test Project' } },
      });
      mockPayoutRequestRepo.updateStatus.mockResolvedValue({});
      mockEmailService.sendPayoutCompletedNotification.mockResolvedValue(undefined);

      await service.markCompleted('pr-1', 'admin-1', 'PP-REF-123');

      expect(mockPayoutRequestRepo.updateStatus).toHaveBeenCalledWith('pr-1', {
        status: 'completed',
        processedAt: expect.any(Date),
        processedBy: 'admin-1',
        externalReference: 'PP-REF-123',
      });
    });

    it('should throw not found when payout request does not exist', async () => {
      mockPayoutRequestRepo.findById.mockResolvedValue(null);

      await expect(service.markCompleted('pr-nonexistent', 'admin-1', 'ref')).rejects.toThrow(
        PayoutNotFoundError
      );
    });
  });

  describe('retryFailed', () => {
    it('should reset failed payout to pending', async () => {
      mockPayoutRequestRepo.findById.mockResolvedValue({
        id: 'pr-1',
        status: 'failed',
        failedReason: 'Invalid email',
      });
      mockPayoutRequestRepo.updateStatus.mockResolvedValue({});

      await service.retryFailed('pr-1');

      expect(mockPayoutRequestRepo.updateStatus).toHaveBeenCalledWith('pr-1', {
        status: 'pending',
        failedReason: null,
        processedAt: null,
        processedBy: null,
        externalReference: null,
        batchId: null,
      });
    });

    it('should throw validation error when payout is not in failed status', async () => {
      mockPayoutRequestRepo.findById.mockResolvedValue({
        id: 'pr-1',
        status: 'completed',
      });

      await expect(service.retryFailed('pr-1')).rejects.toThrow(PayoutValidationError);
    });
  });

  describe('processBatch', () => {
    const pendingRequests = [
      {
        id: 'pr-1',
        transactionId: 'txn-1',
        sellerId: 'user-1',
        amountCents: 82000,
        payoutMethod: 'paypal',
        payoutEmail: 'seller1@paypal.com',
        status: 'pending',
        seller: { id: 'user-1', email: 'seller1@test.com', fullName: 'Seller One', username: 'seller1' },
        transaction: { id: 'txn-1', projectId: 'proj-1', project: { title: 'Project One' } },
      },
      {
        id: 'pr-2',
        transactionId: 'txn-2',
        sellerId: 'user-2',
        amountCents: 50000,
        payoutMethod: 'paypal',
        payoutEmail: 'seller2@paypal.com',
        status: 'pending',
        seller: { id: 'user-2', email: 'seller2@test.com', fullName: 'Seller Two', username: 'seller2' },
        transaction: { id: 'txn-2', projectId: 'proj-2', project: { title: 'Project Two' } },
      },
    ];

    it('should process batch successfully via PayPal', async () => {
      mockPayoutRequestRepo.findPending.mockResolvedValue(pendingRequests);
      mockPayoutRequestRepo.updateStatus.mockResolvedValue({});
      mockExecute.mockResolvedValue({
        result: {
          batch_header: {
            payout_batch_id: 'PP-BATCH-123',
            batch_status: 'PENDING',
          },
        },
      });
      mockEmailService.sendPayoutCompletedNotification.mockResolvedValue(undefined);

      const result = await service.processBatch();

      expect(result.processed).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.batchId).toMatch(/^CS-/);
      // All items marked as processing first, then completed
      expect(mockPayoutRequestRepo.updateStatus).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalledOnce();
    });

    it('should return zeros when no pending requests', async () => {
      mockPayoutRequestRepo.findPending.mockResolvedValue([]);

      const result = await service.processBatch();

      expect(result.processed).toBe(0);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it('should mark all as failed when PayPal API errors', async () => {
      mockPayoutRequestRepo.findPending.mockResolvedValue(pendingRequests);
      mockPayoutRequestRepo.updateStatus.mockResolvedValue({});
      mockExecute.mockRejectedValue(new Error('PayPal API unavailable'));
      mockEmailService.sendPayoutFailedNotification.mockResolvedValue(undefined);

      const result = await service.processBatch();

      expect(result.processed).toBe(2);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(2);
    });
  });
});
