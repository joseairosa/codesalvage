import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SellerPayoutDetailsRepository } from '../SellerPayoutDetailsRepository';

const mockPrisma = {
  sellerPayoutDetails: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
} as any;

describe('SellerPayoutDetailsRepository', () => {
  let repo: SellerPayoutDetailsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new SellerPayoutDetailsRepository(mockPrisma);
  });

  describe('create', () => {
    it('should create payout details with ULID ID', async () => {
      const input = {
        userId: 'user-1',
        payoutMethod: 'paypal',
        payoutEmail: 'seller@paypal.com',
      };

      mockPrisma.sellerPayoutDetails.create.mockResolvedValue({
        id: 'some-ulid',
        ...input,
        isActive: true,
        payoutDetails: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await repo.create(input);

      expect(mockPrisma.sellerPayoutDetails.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: expect.any(String),
          userId: 'user-1',
          payoutMethod: 'paypal',
          payoutEmail: 'seller@paypal.com',
        }),
      });
      expect(result.userId).toBe('user-1');
    });
  });

  describe('findByUserId', () => {
    it('should find active payout details by user ID', async () => {
      const details = {
        id: 'ulid-1',
        userId: 'user-1',
        payoutMethod: 'paypal',
        payoutEmail: 'seller@paypal.com',
        isActive: true,
      };

      mockPrisma.sellerPayoutDetails.findUnique.mockResolvedValue(details);

      const result = await repo.findByUserId('user-1');

      expect(mockPrisma.sellerPayoutDetails.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result).toEqual(details);
    });

    it('should return null when no payout details exist', async () => {
      mockPrisma.sellerPayoutDetails.findUnique.mockResolvedValue(null);

      const result = await repo.findByUserId('user-nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update payout details', async () => {
      const updated = {
        id: 'ulid-1',
        userId: 'user-1',
        payoutMethod: 'paypal',
        payoutEmail: 'new@paypal.com',
        isActive: true,
      };

      mockPrisma.sellerPayoutDetails.update.mockResolvedValue(updated);

      const result = await repo.update('user-1', { payoutEmail: 'new@paypal.com' });

      expect(mockPrisma.sellerPayoutDetails.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { payoutEmail: 'new@paypal.com' },
      });
      expect(result.payoutEmail).toBe('new@paypal.com');
    });
  });

  describe('deactivate', () => {
    it('should set isActive to false', async () => {
      mockPrisma.sellerPayoutDetails.update.mockResolvedValue({
        id: 'ulid-1',
        userId: 'user-1',
        isActive: false,
      });

      const result = await repo.deactivate('user-1');

      expect(mockPrisma.sellerPayoutDetails.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { isActive: false },
      });
      expect(result.isActive).toBe(false);
    });
  });
});
