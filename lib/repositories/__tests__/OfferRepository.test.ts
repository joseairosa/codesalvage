import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OfferRepository } from '../OfferRepository';
import type { PrismaClient } from '@prisma/client';

// Mock ulidx
vi.mock('ulidx', () => ({
  ulid: vi.fn(() => 'mock-ulid-123'),
}));

// Mock Prisma Client
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(),
}));

const createMockOffer = (overrides = {}) => ({
  id: 'mock-ulid-123',
  projectId: 'project123',
  buyerId: 'buyer123',
  sellerId: 'seller123',
  offeredPriceCents: 50000,
  originalPriceCents: 100000,
  message: 'Interested in this project',
  status: 'pending',
  respondedAt: null,
  expiresAt: new Date('2026-02-18T00:00:00Z'),
  transactionId: null,
  parentOfferId: null,
  createdAt: new Date('2026-02-11T00:00:00Z'),
  updatedAt: new Date('2026-02-11T00:00:00Z'),
  project: {
    id: 'project123',
    title: 'Test Project',
    priceCents: 100000,
    thumbnailImageUrl: null,
    status: 'active',
  },
  buyer: {
    id: 'buyer123',
    username: 'buyer',
    fullName: 'Test Buyer',
    avatarUrl: null,
    email: 'buyer@test.com',
  },
  seller: {
    id: 'seller123',
    username: 'seller',
    fullName: 'Test Seller',
    avatarUrl: null,
    email: 'seller@test.com',
  },
  parentOffer: null,
  counterOffer: null,
  ...overrides,
});

const expectedInclude = {
  project: {
    select: {
      id: true,
      title: true,
      priceCents: true,
      thumbnailImageUrl: true,
      status: true,
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
  seller: {
    select: {
      id: true,
      username: true,
      fullName: true,
      avatarUrl: true,
      email: true,
    },
  },
  parentOffer: true,
  counterOffer: true,
};

describe('OfferRepository', () => {
  let offerRepository: OfferRepository;
  let mockPrismaClient: {
    offer: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrismaClient = {
      offer: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
    };

    offerRepository = new OfferRepository(
      mockPrismaClient as unknown as PrismaClient
    );
  });

  describe('create', () => {
    it('should create an offer with ULID and return it with relations', async () => {
      const mockOffer = createMockOffer();
      mockPrismaClient.offer.create.mockResolvedValue(mockOffer);

      const result = await offerRepository.create({
        projectId: 'project123',
        buyerId: 'buyer123',
        sellerId: 'seller123',
        offeredPriceCents: 50000,
        originalPriceCents: 100000,
        message: 'Interested in this project',
        expiresAt: new Date('2026-02-18T00:00:00Z'),
      });

      expect(mockPrismaClient.offer.create).toHaveBeenCalledWith({
        data: {
          id: 'mock-ulid-123',
          projectId: 'project123',
          buyerId: 'buyer123',
          sellerId: 'seller123',
          offeredPriceCents: 50000,
          originalPriceCents: 100000,
          message: 'Interested in this project',
          expiresAt: new Date('2026-02-18T00:00:00Z'),
        },
        include: expectedInclude,
      });
      expect(result).toEqual(mockOffer);
    });

    it('should create an offer without optional message', async () => {
      const mockOffer = createMockOffer({ message: null });
      mockPrismaClient.offer.create.mockResolvedValue(mockOffer);

      const result = await offerRepository.create({
        projectId: 'project123',
        buyerId: 'buyer123',
        sellerId: 'seller123',
        offeredPriceCents: 50000,
        originalPriceCents: 100000,
        expiresAt: new Date('2026-02-18T00:00:00Z'),
      });

      expect(mockPrismaClient.offer.create).toHaveBeenCalledWith({
        data: {
          id: 'mock-ulid-123',
          projectId: 'project123',
          buyerId: 'buyer123',
          sellerId: 'seller123',
          offeredPriceCents: 50000,
          originalPriceCents: 100000,
          expiresAt: new Date('2026-02-18T00:00:00Z'),
        },
        include: expectedInclude,
      });
      expect(result).toEqual(mockOffer);
    });

    it('should create a counter-offer with parentOfferId', async () => {
      const mockOffer = createMockOffer({
        parentOfferId: 'parent-offer-123',
        parentOffer: { id: 'parent-offer-123', status: 'countered' },
      });
      mockPrismaClient.offer.create.mockResolvedValue(mockOffer);

      const result = await offerRepository.create({
        projectId: 'project123',
        buyerId: 'buyer123',
        sellerId: 'seller123',
        offeredPriceCents: 75000,
        originalPriceCents: 100000,
        message: 'Counter offer',
        expiresAt: new Date('2026-02-18T00:00:00Z'),
        parentOfferId: 'parent-offer-123',
      });

      expect(mockPrismaClient.offer.create).toHaveBeenCalledWith({
        data: {
          id: 'mock-ulid-123',
          projectId: 'project123',
          buyerId: 'buyer123',
          sellerId: 'seller123',
          offeredPriceCents: 75000,
          originalPriceCents: 100000,
          message: 'Counter offer',
          expiresAt: new Date('2026-02-18T00:00:00Z'),
          parentOfferId: 'parent-offer-123',
        },
        include: expectedInclude,
      });
      expect(result).toEqual(mockOffer);
      expect(result.parentOfferId).toBe('parent-offer-123');
    });

    it('should throw on database error', async () => {
      mockPrismaClient.offer.create.mockRejectedValue(
        new Error('DB connection failed')
      );

      await expect(
        offerRepository.create({
          projectId: 'project123',
          buyerId: 'buyer123',
          sellerId: 'seller123',
          offeredPriceCents: 50000,
          originalPriceCents: 100000,
          expiresAt: new Date('2026-02-18T00:00:00Z'),
        })
      ).rejects.toThrow('[OfferRepository] Failed to create offer');
    });
  });

  describe('findById', () => {
    it('should find an offer by ID with relations', async () => {
      const mockOffer = createMockOffer();
      mockPrismaClient.offer.findUnique.mockResolvedValue(mockOffer);

      const result = await offerRepository.findById('mock-ulid-123');

      expect(mockPrismaClient.offer.findUnique).toHaveBeenCalledWith({
        where: { id: 'mock-ulid-123' },
        include: expectedInclude,
      });
      expect(result).toEqual(mockOffer);
    });

    it('should return null when offer not found', async () => {
      mockPrismaClient.offer.findUnique.mockResolvedValue(null);

      const result = await offerRepository.findById('nonexistent-id');

      expect(mockPrismaClient.offer.findUnique).toHaveBeenCalledWith({
        where: { id: 'nonexistent-id' },
        include: expectedInclude,
      });
      expect(result).toBeNull();
    });
  });

  describe('findByBuyerAndProject', () => {
    it('should find active offers for buyer on project', async () => {
      const mockOffers = [createMockOffer()];
      mockPrismaClient.offer.findMany.mockResolvedValue(mockOffers);

      const result = await offerRepository.findByBuyerAndProject(
        'buyer123',
        'project123',
        ['pending', 'countered']
      );

      expect(mockPrismaClient.offer.findMany).toHaveBeenCalledWith({
        where: {
          buyerId: 'buyer123',
          projectId: 'project123',
          status: { in: ['pending', 'countered'] },
        },
        include: expectedInclude,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockOffers);
    });

    it('should return empty array when no matching offers exist', async () => {
      mockPrismaClient.offer.findMany.mockResolvedValue([]);

      const result = await offerRepository.findByBuyerAndProject(
        'buyer456',
        'project789',
        ['pending', 'countered']
      );

      expect(mockPrismaClient.offer.findMany).toHaveBeenCalledWith({
        where: {
          buyerId: 'buyer456',
          projectId: 'project789',
          status: { in: ['pending', 'countered'] },
        },
        include: expectedInclude,
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([]);
    });
  });

  describe('findByBuyerId', () => {
    it('should return paginated offers for buyer with total', async () => {
      const mockOffers = [
        createMockOffer(),
        createMockOffer({
          id: 'mock-ulid-456',
          offeredPriceCents: 60000,
        }),
      ];
      mockPrismaClient.offer.findMany.mockResolvedValue(mockOffers);
      mockPrismaClient.offer.count.mockResolvedValue(2);

      const result = await offerRepository.findByBuyerId('buyer123', {
        page: 1,
        limit: 10,
      });

      expect(mockPrismaClient.offer.findMany).toHaveBeenCalledWith({
        where: { buyerId: 'buyer123' },
        include: expectedInclude,
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(mockPrismaClient.offer.count).toHaveBeenCalledWith({
        where: { buyerId: 'buyer123' },
      });
      expect(result.offers).toEqual(mockOffers);
      expect(result.total).toBe(2);
    });

    it('should filter by status when provided', async () => {
      const mockOffers = [createMockOffer()];
      mockPrismaClient.offer.findMany.mockResolvedValue(mockOffers);
      mockPrismaClient.offer.count.mockResolvedValue(1);

      const result = await offerRepository.findByBuyerId('buyer123', {
        page: 1,
        limit: 10,
        status: 'pending',
      });

      expect(mockPrismaClient.offer.findMany).toHaveBeenCalledWith({
        where: { buyerId: 'buyer123', status: 'pending' },
        include: expectedInclude,
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(result.offers).toEqual(mockOffers);
      expect(result.total).toBe(1);
    });

    it('should use defaults when no options provided', async () => {
      mockPrismaClient.offer.findMany.mockResolvedValue([]);
      mockPrismaClient.offer.count.mockResolvedValue(0);

      const result = await offerRepository.findByBuyerId('buyer123');

      expect(mockPrismaClient.offer.findMany).toHaveBeenCalledWith({
        where: { buyerId: 'buyer123' },
        include: expectedInclude,
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result.offers).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('findBySellerId', () => {
    it('should return paginated offers for seller with total', async () => {
      const mockOffers = [
        createMockOffer(),
        createMockOffer({
          id: 'mock-ulid-789',
          buyerId: 'buyer456',
          offeredPriceCents: 70000,
        }),
      ];
      mockPrismaClient.offer.findMany.mockResolvedValue(mockOffers);
      mockPrismaClient.offer.count.mockResolvedValue(2);

      const result = await offerRepository.findBySellerId('seller123', {
        page: 1,
        limit: 20,
      });

      expect(mockPrismaClient.offer.findMany).toHaveBeenCalledWith({
        where: { sellerId: 'seller123' },
        include: expectedInclude,
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result.offers).toEqual(mockOffers);
      expect(result.total).toBe(2);
    });
  });

  describe('findByProjectId', () => {
    it('should return all offers for a project with pagination', async () => {
      const mockOffers = [
        createMockOffer(),
        createMockOffer({
          id: 'mock-ulid-999',
          buyerId: 'buyer999',
          offeredPriceCents: 80000,
          status: 'accepted',
        }),
      ];
      mockPrismaClient.offer.findMany.mockResolvedValue(mockOffers);
      mockPrismaClient.offer.count.mockResolvedValue(2);

      const result = await offerRepository.findByProjectId('project123');

      expect(mockPrismaClient.offer.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project123' },
        include: expectedInclude,
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(result.offers).toEqual(mockOffers);
      expect(result.total).toBe(2);
    });
  });

  describe('updateStatus', () => {
    it('should update status and respondedAt', async () => {
      const respondedAt = new Date('2026-02-12T00:00:00Z');
      const mockOffer = createMockOffer({
        status: 'accepted',
        respondedAt,
      });
      mockPrismaClient.offer.update.mockResolvedValue(mockOffer);

      const result = await offerRepository.updateStatus(
        'mock-ulid-123',
        'accepted',
        respondedAt
      );

      expect(mockPrismaClient.offer.update).toHaveBeenCalledWith({
        where: { id: 'mock-ulid-123' },
        data: {
          status: 'accepted',
          respondedAt,
        },
        include: expectedInclude,
      });
      expect(result).toEqual(mockOffer);
      expect(result.status).toBe('accepted');
      expect(result.respondedAt).toEqual(respondedAt);
    });

    it('should update status without respondedAt', async () => {
      const mockOffer = createMockOffer({ status: 'expired' });
      mockPrismaClient.offer.update.mockResolvedValue(mockOffer);

      const result = await offerRepository.updateStatus(
        'mock-ulid-123',
        'expired'
      );

      expect(mockPrismaClient.offer.update).toHaveBeenCalledWith({
        where: { id: 'mock-ulid-123' },
        data: {
          status: 'expired',
        },
        include: expectedInclude,
      });
      expect(result).toEqual(mockOffer);
      expect(result.status).toBe('expired');
    });
  });

  describe('linkTransaction', () => {
    it('should set transactionId on offer', async () => {
      const mockOffer = createMockOffer({
        transactionId: 'transaction-456',
      });
      mockPrismaClient.offer.update.mockResolvedValue(mockOffer);

      const result = await offerRepository.linkTransaction(
        'mock-ulid-123',
        'transaction-456'
      );

      expect(mockPrismaClient.offer.update).toHaveBeenCalledWith({
        where: { id: 'mock-ulid-123' },
        data: {
          transactionId: 'transaction-456',
        },
        include: expectedInclude,
      });
      expect(result).toEqual(mockOffer);
      expect(result.transactionId).toBe('transaction-456');
    });
  });

  describe('findExpiredOffers', () => {
    it('should find pending/countered offers past expiry date', async () => {
      const expiredOffer1 = createMockOffer({
        id: 'expired-1',
        status: 'pending',
        expiresAt: new Date('2026-02-10T00:00:00Z'),
      });
      const expiredOffer2 = createMockOffer({
        id: 'expired-2',
        status: 'countered',
        expiresAt: new Date('2026-02-09T00:00:00Z'),
      });
      mockPrismaClient.offer.findMany.mockResolvedValue([
        expiredOffer1,
        expiredOffer2,
      ]);

      const result = await offerRepository.findExpiredOffers();

      expect(mockPrismaClient.offer.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['pending', 'countered'] },
          expiresAt: { lt: expect.any(Date) },
        },
        include: expectedInclude,
        orderBy: { expiresAt: 'asc' },
      });
      expect(result).toEqual([expiredOffer1, expiredOffer2]);
      expect(result).toHaveLength(2);
    });
  });

  describe('countActiveByProject', () => {
    it('should count pending and countered offers for a project', async () => {
      mockPrismaClient.offer.count.mockResolvedValue(3);

      const result =
        await offerRepository.countActiveByProject('project123');

      expect(mockPrismaClient.offer.count).toHaveBeenCalledWith({
        where: {
          projectId: 'project123',
          status: { in: ['pending', 'countered'] },
        },
      });
      expect(result).toBe(3);
    });
  });
});
