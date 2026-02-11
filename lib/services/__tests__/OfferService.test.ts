/**
 * OfferService Unit Tests
 *
 * Tests all business logic for the offer/negotiation system including
 * creation, counter-offers, accept/reject/withdraw, access control, and expiry.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OfferService,
  OfferValidationError,
  OfferPermissionError,
  OfferNotFoundError,
} from '../OfferService';
import type { OfferRepository } from '@/lib/repositories/OfferRepository';
import type { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import type { NotificationService } from '../NotificationService';
import type { EmailService } from '../EmailService';

// Mock repositories and services
const mockOfferRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByBuyerAndProject: vi.fn(),
  findByBuyerId: vi.fn(),
  findBySellerId: vi.fn(),
  findByProjectId: vi.fn(),
  updateStatus: vi.fn(),
  linkTransaction: vi.fn(),
  findExpiredOffers: vi.fn(),
  countActiveByProject: vi.fn(),
} as unknown as OfferRepository;

const mockProjectRepository = {
  findById: vi.fn(),
} as unknown as ProjectRepository;

const mockNotificationService = {
  createNotification: vi.fn().mockResolvedValue({}),
} as unknown as NotificationService;

const mockEmailService = {
  sendNewOfferNotification: vi.fn().mockResolvedValue(undefined),
  sendOfferAcceptedNotification: vi.fn().mockResolvedValue(undefined),
  sendOfferRejectedNotification: vi.fn().mockResolvedValue(undefined),
  sendOfferCounteredNotification: vi.fn().mockResolvedValue(undefined),
} as unknown as EmailService;

// Mock data helpers
const createMockOffer = (overrides = {}) => ({
  id: 'offer-123',
  projectId: 'project-123',
  buyerId: 'buyer-123',
  sellerId: 'seller-123',
  offeredPriceCents: 50000,
  originalPriceCents: 100000,
  message: 'Interested',
  status: 'pending',
  respondedAt: null,
  expiresAt: new Date('2026-02-18T00:00:00Z'),
  transactionId: null,
  parentOfferId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  project: {
    id: 'project-123',
    title: 'Test Project',
    priceCents: 100000,
    thumbnailImageUrl: null,
    status: 'active',
  },
  buyer: {
    id: 'buyer-123',
    username: 'buyer',
    fullName: 'Test Buyer',
    avatarUrl: null,
    email: 'buyer@test.com',
  },
  seller: {
    id: 'seller-123',
    username: 'seller',
    fullName: 'Test Seller',
    avatarUrl: null,
    email: 'seller@test.com',
  },
  parentOffer: null,
  counterOffer: null,
  ...overrides,
});

const createMockProject = (overrides = {}) => ({
  id: 'project-123',
  title: 'Test Project',
  sellerId: 'seller-123',
  priceCents: 100000,
  status: 'active',
  minimumOfferCents: null,
  ...overrides,
});

let service: OfferService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new OfferService(
    mockOfferRepository,
    mockProjectRepository,
    mockNotificationService,
    mockEmailService
  );
});

// ---------- createOffer ----------

describe('OfferService', () => {
  describe('createOffer', () => {
    it('should create offer successfully with correct args', async () => {
      const project = createMockProject();
      const offer = createMockOffer();

      (mockProjectRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        project
      );
      (
        mockOfferRepository.findByBuyerAndProject as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);
      (mockOfferRepository.create as ReturnType<typeof vi.fn>).mockResolvedValue(offer);

      const result = await service.createOffer('buyer-123', {
        projectId: 'project-123',
        offeredPriceCents: 50000,
        message: 'Interested',
      });

      expect(result).toEqual(offer);
      expect(mockOfferRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-123',
          buyerId: 'buyer-123',
          sellerId: 'seller-123',
          offeredPriceCents: 50000,
          originalPriceCents: 100000,
          message: 'Interested',
          expiresAt: expect.any(Date),
        })
      );
    });

    it('should reject when project not found', async () => {
      (mockProjectRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      await expect(
        service.createOffer('buyer-123', {
          projectId: 'nonexistent',
          offeredPriceCents: 50000,
        })
      ).rejects.toThrow(OfferValidationError);
    });

    it('should reject when project is not active', async () => {
      const project = createMockProject({ status: 'sold' });
      (mockProjectRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        project
      );

      await expect(
        service.createOffer('buyer-123', {
          projectId: 'project-123',
          offeredPriceCents: 50000,
        })
      ).rejects.toThrow(OfferValidationError);
    });

    it('should reject self-offer (buyer === seller)', async () => {
      const project = createMockProject({ sellerId: 'buyer-123' });
      (mockProjectRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        project
      );

      await expect(
        service.createOffer('buyer-123', {
          projectId: 'project-123',
          offeredPriceCents: 50000,
        })
      ).rejects.toThrow(OfferPermissionError);
    });

    it('should reject offer below MINIMUM_OFFER_CENTS ($10 = 1000 cents)', async () => {
      const project = createMockProject();
      (mockProjectRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        project
      );

      await expect(
        service.createOffer('buyer-123', {
          projectId: 'project-123',
          offeredPriceCents: 500,
        })
      ).rejects.toThrow(OfferValidationError);
    });

    it('should reject offer below project.minimumOfferCents', async () => {
      const project = createMockProject({ minimumOfferCents: 30000 });
      (mockProjectRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        project
      );

      await expect(
        service.createOffer('buyer-123', {
          projectId: 'project-123',
          offeredPriceCents: 20000,
        })
      ).rejects.toThrow(OfferValidationError);
    });

    it('should reject offer >= listing price', async () => {
      const project = createMockProject();
      (mockProjectRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        project
      );

      await expect(
        service.createOffer('buyer-123', {
          projectId: 'project-123',
          offeredPriceCents: 100000,
        })
      ).rejects.toThrow(OfferValidationError);
    });

    it('should reject when buyer has existing active offer on project', async () => {
      const project = createMockProject();
      const existingOffer = createMockOffer();

      (mockProjectRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        project
      );
      (
        mockOfferRepository.findByBuyerAndProject as ReturnType<typeof vi.fn>
      ).mockResolvedValue([existingOffer]);

      await expect(
        service.createOffer('buyer-123', {
          projectId: 'project-123',
          offeredPriceCents: 50000,
        })
      ).rejects.toThrow(OfferValidationError);
    });
  });

  // ---------- counterOffer ----------

  describe('counterOffer', () => {
    it('should mark original as countered and create child offer with parentOfferId', async () => {
      const originalOffer = createMockOffer();
      const counterOffer = createMockOffer({
        id: 'counter-456',
        offeredPriceCents: 75000,
        parentOfferId: 'offer-123',
      });

      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        originalOffer
      );
      (mockOfferRepository.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
        createMockOffer({ status: 'countered' })
      );
      (mockOfferRepository.create as ReturnType<typeof vi.fn>).mockResolvedValue(
        counterOffer
      );

      const result = await service.counterOffer('seller-123', 'offer-123', {
        counterPriceCents: 75000,
        message: 'How about this?',
      });

      expect(result).toEqual(counterOffer);
      expect(mockOfferRepository.updateStatus).toHaveBeenCalledWith(
        'offer-123',
        'countered',
        expect.any(Date)
      );
      expect(mockOfferRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parentOfferId: 'offer-123',
          offeredPriceCents: 75000,
          buyerId: 'buyer-123',
          sellerId: 'seller-123',
        })
      );
    });

    it('should reject when offer not found', async () => {
      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        service.counterOffer('seller-123', 'nonexistent', { counterPriceCents: 75000 })
      ).rejects.toThrow(OfferNotFoundError);
    });

    it('should reject when user is not the seller of the offer', async () => {
      const offer = createMockOffer();
      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(offer);

      await expect(
        service.counterOffer('stranger-999', 'offer-123', { counterPriceCents: 75000 })
      ).rejects.toThrow(OfferPermissionError);
    });

    it('should reject when original offer is not pending', async () => {
      const offer = createMockOffer({ status: 'rejected' });
      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(offer);

      await expect(
        service.counterOffer('seller-123', 'offer-123', { counterPriceCents: 75000 })
      ).rejects.toThrow(OfferValidationError);
    });

    it('should reject counter price >= original listing price', async () => {
      const offer = createMockOffer({ originalPriceCents: 100000 });
      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(offer);

      await expect(
        service.counterOffer('seller-123', 'offer-123', { counterPriceCents: 100000 })
      ).rejects.toThrow(OfferValidationError);
    });
  });

  // ---------- acceptOffer ----------

  describe('acceptOffer', () => {
    it('should allow seller to accept a buyer initial offer (no parentOfferId)', async () => {
      const offer = createMockOffer({ parentOfferId: null });
      const accepted = createMockOffer({ status: 'accepted' });

      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(offer);
      (mockOfferRepository.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
        accepted
      );

      const result = await service.acceptOffer('seller-123', 'offer-123');

      expect(result).toEqual(accepted);
      expect(mockOfferRepository.updateStatus).toHaveBeenCalledWith(
        'offer-123',
        'accepted',
        expect.any(Date)
      );
    });

    it('should allow buyer to accept a seller counter-offer (has parentOfferId)', async () => {
      const counterOffer = createMockOffer({
        id: 'counter-456',
        parentOfferId: 'offer-123',
      });
      const accepted = createMockOffer({
        id: 'counter-456',
        parentOfferId: 'offer-123',
        status: 'accepted',
      });

      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        counterOffer
      );
      (mockOfferRepository.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
        accepted
      );

      const result = await service.acceptOffer('buyer-123', 'counter-456');

      expect(result).toEqual(accepted);
      expect(mockOfferRepository.updateStatus).toHaveBeenCalledWith(
        'counter-456',
        'accepted',
        expect.any(Date)
      );
    });

    it('should reject when offer not found', async () => {
      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.acceptOffer('seller-123', 'nonexistent')).rejects.toThrow(
        OfferNotFoundError
      );
    });

    it('should reject when offer is not pending', async () => {
      const offer = createMockOffer({ status: 'expired' });
      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(offer);

      await expect(service.acceptOffer('seller-123', 'offer-123')).rejects.toThrow(
        OfferValidationError
      );
    });

    it('should reject when wrong user tries to accept (buyer tries to accept own initial offer)', async () => {
      const offer = createMockOffer({ parentOfferId: null });
      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(offer);

      // buyer-123 is the buyer, but for an initial offer the seller should accept
      await expect(service.acceptOffer('buyer-123', 'offer-123')).rejects.toThrow(
        OfferPermissionError
      );
    });
  });

  // ---------- rejectOffer ----------

  describe('rejectOffer', () => {
    it('should allow seller to reject a buyer offer', async () => {
      const offer = createMockOffer({ parentOfferId: null });
      const rejected = createMockOffer({ status: 'rejected' });

      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(offer);
      (mockOfferRepository.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
        rejected
      );

      const result = await service.rejectOffer('seller-123', 'offer-123');

      expect(result).toEqual(rejected);
      expect(mockOfferRepository.updateStatus).toHaveBeenCalledWith(
        'offer-123',
        'rejected',
        expect.any(Date)
      );
    });

    it('should reject when offer not found', async () => {
      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.rejectOffer('seller-123', 'nonexistent')).rejects.toThrow(
        OfferNotFoundError
      );
    });

    it('should reject when offer is not pending', async () => {
      const offer = createMockOffer({ status: 'accepted' });
      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(offer);

      await expect(service.rejectOffer('seller-123', 'offer-123')).rejects.toThrow(
        OfferValidationError
      );
    });

    it('should reject when wrong user tries to reject', async () => {
      const offer = createMockOffer({ parentOfferId: null });
      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(offer);

      // buyer tries to reject their own initial offer (should use withdraw instead)
      await expect(service.rejectOffer('buyer-123', 'offer-123')).rejects.toThrow(
        OfferPermissionError
      );
    });
  });

  // ---------- withdrawOffer ----------

  describe('withdrawOffer', () => {
    it('should allow buyer to withdraw own initial offer', async () => {
      const offer = createMockOffer({ parentOfferId: null });
      const withdrawn = createMockOffer({ status: 'withdrawn' });

      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(offer);
      (mockOfferRepository.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
        withdrawn
      );

      const result = await service.withdrawOffer('buyer-123', 'offer-123');

      expect(result).toEqual(withdrawn);
      expect(mockOfferRepository.updateStatus).toHaveBeenCalledWith(
        'offer-123',
        'withdrawn',
        expect.any(Date)
      );
    });

    it('should reject when offer not found', async () => {
      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.withdrawOffer('buyer-123', 'nonexistent')).rejects.toThrow(
        OfferNotFoundError
      );
    });

    it('should reject when offer is not pending', async () => {
      const offer = createMockOffer({ status: 'accepted' });
      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(offer);

      await expect(service.withdrawOffer('buyer-123', 'offer-123')).rejects.toThrow(
        OfferValidationError
      );
    });

    it('should reject when user is not the original offerer (seller tries to withdraw buyer offer)', async () => {
      const offer = createMockOffer({ parentOfferId: null });
      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(offer);

      // seller-123 is not the offerer of an initial offer (buyer-123 is)
      await expect(service.withdrawOffer('seller-123', 'offer-123')).rejects.toThrow(
        OfferPermissionError
      );
    });
  });

  // ---------- getOfferById ----------

  describe('getOfferById', () => {
    it('should return offer when user is buyer', async () => {
      const offer = createMockOffer();
      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(offer);

      const result = await service.getOfferById('offer-123', 'buyer-123');
      expect(result).toEqual(offer);
    });

    it('should return offer when user is seller', async () => {
      const offer = createMockOffer();
      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(offer);

      const result = await service.getOfferById('offer-123', 'seller-123');
      expect(result).toEqual(offer);
    });

    it('should reject when user is neither buyer nor seller', async () => {
      const offer = createMockOffer();
      (mockOfferRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(offer);

      await expect(service.getOfferById('offer-123', 'stranger-999')).rejects.toThrow(
        OfferPermissionError
      );
    });
  });

  // ---------- getBuyerOffers ----------

  describe('getBuyerOffers', () => {
    it('should delegate to repository.findByBuyerId', async () => {
      const expected = { offers: [createMockOffer()], total: 1 };
      (mockOfferRepository.findByBuyerId as ReturnType<typeof vi.fn>).mockResolvedValue(
        expected
      );

      const result = await service.getBuyerOffers('buyer-123', { page: 1, limit: 10 });

      expect(result).toEqual(expected);
      expect(mockOfferRepository.findByBuyerId).toHaveBeenCalledWith('buyer-123', {
        page: 1,
        limit: 10,
      });
    });
  });

  // ---------- getSellerOffers ----------

  describe('getSellerOffers', () => {
    it('should delegate to repository.findBySellerId', async () => {
      const expected = { offers: [createMockOffer()], total: 1 };
      (mockOfferRepository.findBySellerId as ReturnType<typeof vi.fn>).mockResolvedValue(
        expected
      );

      const result = await service.getSellerOffers('seller-123', { page: 1, limit: 10 });

      expect(result).toEqual(expected);
      expect(mockOfferRepository.findBySellerId).toHaveBeenCalledWith('seller-123', {
        page: 1,
        limit: 10,
      });
    });
  });

  // ---------- getProjectOffers ----------

  describe('getProjectOffers', () => {
    it('should return offers when user is project seller', async () => {
      const project = createMockProject();
      const expected = { offers: [createMockOffer()], total: 1 };

      (mockProjectRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        project
      );
      (mockOfferRepository.findByProjectId as ReturnType<typeof vi.fn>).mockResolvedValue(
        expected
      );

      const result = await service.getProjectOffers('project-123', 'seller-123');

      expect(result).toEqual(expected);
      expect(mockOfferRepository.findByProjectId).toHaveBeenCalledWith(
        'project-123',
        undefined
      );
    });

    it('should reject when project not found', async () => {
      (mockProjectRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      await expect(service.getProjectOffers('nonexistent', 'seller-123')).rejects.toThrow(
        OfferValidationError
      );
    });

    it('should reject when user is not project seller', async () => {
      const project = createMockProject();
      (mockProjectRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        project
      );

      await expect(
        service.getProjectOffers('project-123', 'stranger-999')
      ).rejects.toThrow(OfferPermissionError);
    });
  });

  // ---------- expireOffers ----------

  describe('expireOffers', () => {
    it('should expire multiple offers and call updateStatus for each', async () => {
      const expired1 = createMockOffer({ id: 'offer-1' });
      const expired2 = createMockOffer({ id: 'offer-2' });
      const expired3 = createMockOffer({ id: 'offer-3' });

      (
        mockOfferRepository.findExpiredOffers as ReturnType<typeof vi.fn>
      ).mockResolvedValue([expired1, expired2, expired3]);
      (mockOfferRepository.updateStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
        {}
      );

      const result = await service.expireOffers();

      expect(result).toBe(3);
      expect(mockOfferRepository.updateStatus).toHaveBeenCalledTimes(3);
      expect(mockOfferRepository.updateStatus).toHaveBeenCalledWith('offer-1', 'expired');
      expect(mockOfferRepository.updateStatus).toHaveBeenCalledWith('offer-2', 'expired');
      expect(mockOfferRepository.updateStatus).toHaveBeenCalledWith('offer-3', 'expired');
    });

    it('should return 0 when no expired offers found', async () => {
      (
        mockOfferRepository.findExpiredOffers as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);

      const result = await service.expireOffers();

      expect(result).toBe(0);
      expect(mockOfferRepository.updateStatus).not.toHaveBeenCalled();
    });
  });
});
