/**
 * DisputeService Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DisputeService,
  DisputeValidationError,
  DisputePermissionError,
} from '../DisputeService';

const mockDisputeRepo = {
  create: vi.fn(),
  findByTransactionId: vi.fn(),
  findAll: vi.fn(),
  updateStatus: vi.fn(),
};

const mockTransactionRepo = {
  findById: vi.fn(),
  updateEscrowStatus: vi.fn(),
};

const mockTransaction = {
  id: 'tx1',
  buyerId: 'buyer1',
  sellerId: 'seller1',
  escrowStatus: 'held',
  escrowReleaseDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
  paymentStatus: 'succeeded',
};

describe('DisputeService', () => {
  let service: DisputeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DisputeService(mockDisputeRepo as any, mockTransactionRepo as any);
  });

  describe('openDispute', () => {
    it('should create dispute and mark escrow as disputed', async () => {
      mockTransactionRepo.findById.mockResolvedValue(mockTransaction);
      mockDisputeRepo.findByTransactionId.mockResolvedValue(null);
      mockDisputeRepo.create.mockResolvedValue({
        id: 'dispute1',
        transactionId: 'tx1',
        buyerId: 'buyer1',
        reason: 'description_mismatch',
        status: 'pending',
      });

      const result = await service.openDispute(
        'buyer1',
        'tx1',
        'description_mismatch',
        'The project is described as a full e-commerce platform but only has a login page.'
      );

      expect(result.id).toBe('dispute1');
      expect(mockTransactionRepo.updateEscrowStatus).toHaveBeenCalledWith(
        'tx1',
        'disputed'
      );
    });

    it('should throw DisputePermissionError if caller is not the buyer', async () => {
      mockTransactionRepo.findById.mockResolvedValue(mockTransaction);

      await expect(
        service.openDispute(
          'seller1',
          'tx1',
          'description_mismatch',
          'This is a long enough description here.'
        )
      ).rejects.toThrow(DisputePermissionError);
    });

    it('should throw DisputeValidationError if escrow is not held', async () => {
      mockTransactionRepo.findById.mockResolvedValue({
        ...mockTransaction,
        escrowStatus: 'released',
      });

      await expect(
        service.openDispute(
          'buyer1',
          'tx1',
          'description_mismatch',
          'This is a long enough description here.'
        )
      ).rejects.toThrow(DisputeValidationError);
    });

    it('should throw DisputeValidationError if release date has passed', async () => {
      mockTransactionRepo.findById.mockResolvedValue({
        ...mockTransaction,
        escrowReleaseDate: new Date(Date.now() - 1000), // 1 second ago
      });

      await expect(
        service.openDispute(
          'buyer1',
          'tx1',
          'description_mismatch',
          'This is a long enough description here.'
        )
      ).rejects.toThrow(DisputeValidationError);
    });

    it('should throw DisputeValidationError if dispute already exists', async () => {
      mockTransactionRepo.findById.mockResolvedValue(mockTransaction);
      mockDisputeRepo.findByTransactionId.mockResolvedValue({ id: 'existing-dispute' });

      await expect(
        service.openDispute(
          'buyer1',
          'tx1',
          'description_mismatch',
          'This is a long enough description here.'
        )
      ).rejects.toThrow(DisputeValidationError);
    });

    it('should throw DisputeValidationError for invalid reason', async () => {
      mockTransactionRepo.findById.mockResolvedValue(mockTransaction);
      mockDisputeRepo.findByTransactionId.mockResolvedValue(null);

      await expect(
        service.openDispute(
          'buyer1',
          'tx1',
          'invalid_reason',
          'This is a long enough description here.'
        )
      ).rejects.toThrow(DisputeValidationError);
    });

    it('should throw DisputeValidationError if description is too short', async () => {
      mockTransactionRepo.findById.mockResolvedValue(mockTransaction);
      mockDisputeRepo.findByTransactionId.mockResolvedValue(null);

      await expect(
        service.openDispute('buyer1', 'tx1', 'description_mismatch', 'Too short')
      ).rejects.toThrow(DisputeValidationError);
    });
  });

  describe('getDisputeForTransaction', () => {
    it('should return dispute for buyer', async () => {
      mockTransactionRepo.findById.mockResolvedValue(mockTransaction);
      mockDisputeRepo.findByTransactionId.mockResolvedValue({
        id: 'dispute1',
        status: 'pending',
      });

      const result = await service.getDisputeForTransaction('buyer1', 'tx1');
      expect(result?.id).toBe('dispute1');
    });

    it('should return dispute for seller too', async () => {
      mockTransactionRepo.findById.mockResolvedValue(mockTransaction);
      mockDisputeRepo.findByTransactionId.mockResolvedValue({
        id: 'dispute1',
        status: 'pending',
      });

      const result = await service.getDisputeForTransaction('seller1', 'tx1');
      expect(result?.id).toBe('dispute1');
    });

    it('should throw DisputePermissionError for unrelated user', async () => {
      mockTransactionRepo.findById.mockResolvedValue(mockTransaction);

      await expect(
        service.getDisputeForTransaction('random-user', 'tx1')
      ).rejects.toThrow(DisputePermissionError);
    });
  });
});
