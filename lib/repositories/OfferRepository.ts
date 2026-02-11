/**
 * OfferRepository — Data Access Layer for Offers
 *
 * Responsibilities:
 * - CRUD operations for offers
 * - Query offers by buyer, seller, project with pagination
 * - Status transitions and transaction linking
 * - Expired offer discovery
 *
 * Architecture:
 * - Repository Pattern: Abstracts database operations
 * - Uses ULID for IDs (generated via ulidx)
 * - Constructor injection of PrismaClient
 */

import type { Offer, PrismaClient, Prisma } from '@prisma/client';
import { ulid } from 'ulidx';

// ---------- Input / Output types ----------

export interface CreateOfferInput {
  projectId: string;
  buyerId: string;
  sellerId: string;
  offeredPriceCents: number;
  originalPriceCents: number;
  message?: string;
  expiresAt: Date;
  parentOfferId?: string;
}

export interface OfferQueryOptions {
  page?: number;
  limit?: number;
  status?: string;
}

const offerRelationsInclude = {
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
} as const;

export type OfferWithRelations = Offer & {
  project: {
    id: string;
    title: string;
    priceCents: number;
    thumbnailImageUrl: string | null;
    status: string;
  };
  buyer: {
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    email: string;
  };
  seller: {
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    email: string;
  };
  parentOffer: Offer | null;
  counterOffer: Offer | null;
};

// ---------- Repository ----------

export class OfferRepository {
  constructor(private prisma: PrismaClient) {}

  // ---------- create ----------

  async create(data: CreateOfferInput): Promise<OfferWithRelations> {
    try {
      console.log('[OfferRepository] Creating offer', {
        projectId: data.projectId,
        buyerId: data.buyerId,
        sellerId: data.sellerId,
        offeredPriceCents: data.offeredPriceCents,
      });

      // Build create data conditionally for exactOptionalPropertyTypes
      const createData: Prisma.OfferUncheckedCreateInput = {
        id: ulid(),
        projectId: data.projectId,
        buyerId: data.buyerId,
        sellerId: data.sellerId,
        offeredPriceCents: data.offeredPriceCents,
        originalPriceCents: data.originalPriceCents,
        expiresAt: data.expiresAt,
      };

      if (data.message !== undefined) {
        createData.message = data.message;
      }

      if (data.parentOfferId !== undefined) {
        createData.parentOfferId = data.parentOfferId;
      }

      const offer = await this.prisma.offer.create({
        data: createData,
        include: offerRelationsInclude,
      });

      console.log('[OfferRepository] Offer created', { id: offer.id });

      return offer as OfferWithRelations;
    } catch (error) {
      throw new Error(
        `[OfferRepository] Failed to create offer: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ---------- findById ----------

  async findById(id: string): Promise<OfferWithRelations | null> {
    try {
      console.log('[OfferRepository] Finding offer by id', { id });

      const offer = await this.prisma.offer.findUnique({
        where: { id },
        include: offerRelationsInclude,
      });

      return (offer as OfferWithRelations) ?? null;
    } catch (error) {
      throw new Error(
        `[OfferRepository] Failed to find offer by id: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ---------- findByBuyerAndProject ----------

  async findByBuyerAndProject(
    buyerId: string,
    projectId: string,
    statuses: string[]
  ): Promise<OfferWithRelations[]> {
    try {
      console.log('[OfferRepository] Finding offers by buyer and project', {
        buyerId,
        projectId,
        statuses,
      });

      const offers = await this.prisma.offer.findMany({
        where: {
          buyerId,
          projectId,
          status: { in: statuses },
        },
        include: offerRelationsInclude,
        orderBy: { createdAt: 'desc' },
      });

      return offers as OfferWithRelations[];
    } catch (error) {
      throw new Error(
        `[OfferRepository] Failed to find offers by buyer and project: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ---------- findByBuyerId ----------

  async findByBuyerId(
    buyerId: string,
    options?: OfferQueryOptions
  ): Promise<{ offers: OfferWithRelations[]; total: number }> {
    try {
      const page = options?.page ?? 1;
      const limit = options?.limit ?? 20;
      const skip = (page - 1) * limit;

      console.log('[OfferRepository] Finding offers by buyer id', {
        buyerId,
        page,
        limit,
      });

      const where: Prisma.OfferWhereInput = { buyerId };

      if (options?.status !== undefined) {
        where.status = options.status;
      }

      const [offers, total] = await Promise.all([
        this.prisma.offer.findMany({
          where,
          include: offerRelationsInclude,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.offer.count({ where }),
      ]);

      return { offers: offers as OfferWithRelations[], total };
    } catch (error) {
      throw new Error(
        `[OfferRepository] Failed to find offers by buyer id: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ---------- findBySellerId ----------

  async findBySellerId(
    sellerId: string,
    options?: OfferQueryOptions
  ): Promise<{ offers: OfferWithRelations[]; total: number }> {
    try {
      const page = options?.page ?? 1;
      const limit = options?.limit ?? 20;
      const skip = (page - 1) * limit;

      console.log('[OfferRepository] Finding offers by seller id', {
        sellerId,
        page,
        limit,
      });

      const where: Prisma.OfferWhereInput = { sellerId };

      if (options?.status !== undefined) {
        where.status = options.status;
      }

      const [offers, total] = await Promise.all([
        this.prisma.offer.findMany({
          where,
          include: offerRelationsInclude,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.offer.count({ where }),
      ]);

      return { offers: offers as OfferWithRelations[], total };
    } catch (error) {
      throw new Error(
        `[OfferRepository] Failed to find offers by seller id: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ---------- findByProjectId ----------

  async findByProjectId(
    projectId: string,
    options?: OfferQueryOptions
  ): Promise<{ offers: OfferWithRelations[]; total: number }> {
    try {
      const page = options?.page ?? 1;
      const limit = options?.limit ?? 20;
      const skip = (page - 1) * limit;

      console.log('[OfferRepository] Finding offers by project id', {
        projectId,
        page,
        limit,
      });

      const where: Prisma.OfferWhereInput = { projectId };

      if (options?.status !== undefined) {
        where.status = options.status;
      }

      const [offers, total] = await Promise.all([
        this.prisma.offer.findMany({
          where,
          include: offerRelationsInclude,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.offer.count({ where }),
      ]);

      return { offers: offers as OfferWithRelations[], total };
    } catch (error) {
      throw new Error(
        `[OfferRepository] Failed to find offers by project id: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ---------- updateStatus ----------

  async updateStatus(
    id: string,
    status: string,
    respondedAt?: Date
  ): Promise<OfferWithRelations> {
    try {
      console.log('[OfferRepository] Updating offer status', { id, status });

      const updateData: Prisma.OfferUncheckedUpdateInput = { status };

      if (respondedAt !== undefined) {
        updateData.respondedAt = respondedAt;
      }

      const offer = await this.prisma.offer.update({
        where: { id },
        data: updateData,
        include: offerRelationsInclude,
      });

      console.log('[OfferRepository] Offer status updated', {
        id: offer.id,
        status: offer.status,
      });

      return offer as OfferWithRelations;
    } catch (error) {
      throw new Error(
        `[OfferRepository] Failed to update offer status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ---------- linkTransaction ----------

  async linkTransaction(
    id: string,
    transactionId: string
  ): Promise<OfferWithRelations> {
    try {
      console.log('[OfferRepository] Linking transaction to offer', {
        id,
        transactionId,
      });

      const offer = await this.prisma.offer.update({
        where: { id },
        data: { transactionId },
        include: offerRelationsInclude,
      });

      console.log('[OfferRepository] Transaction linked to offer', {
        id: offer.id,
        transactionId: offer.transactionId,
      });

      return offer as OfferWithRelations;
    } catch (error) {
      throw new Error(
        `[OfferRepository] Failed to link transaction to offer: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ---------- findExpiredOffers ----------

  async findExpiredOffers(): Promise<OfferWithRelations[]> {
    try {
      console.log('[OfferRepository] Finding expired offers');

      const offers = await this.prisma.offer.findMany({
        where: {
          status: { in: ['pending', 'countered'] },
          expiresAt: { lt: new Date() },
        },
        include: offerRelationsInclude,
        orderBy: { expiresAt: 'asc' },
      });

      console.log('[OfferRepository] Found expired offers', {
        count: offers.length,
      });

      return offers as OfferWithRelations[];
    } catch (error) {
      throw new Error(
        `[OfferRepository] Failed to find expired offers: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  // ---------- countActiveByProject ----------

  async countActiveByProject(projectId: string): Promise<number> {
    try {
      console.log('[OfferRepository] Counting active offers for project', {
        projectId,
      });

      const count = await this.prisma.offer.count({
        where: {
          projectId,
          status: { in: ['pending', 'countered'] },
        },
      });

      console.log('[OfferRepository] Active offer count', {
        projectId,
        count,
      });

      return count;
    } catch (error) {
      throw new Error(
        `[OfferRepository] Failed to count active offers: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
