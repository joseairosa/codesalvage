/**
 * PayoutRequestRepository
 *
 * Data access layer for payout requests (tracking seller payouts).
 */

import type { PrismaClient, PayoutRequest } from '@prisma/client';
import { monotonicFactory } from 'ulidx';

const generateUlid = monotonicFactory();

export interface CreatePayoutRequestInput {
  transactionId: string;
  sellerId: string;
  amountCents: number;
  commissionCents: number;
  payoutMethod: string;
  payoutEmail: string;
}

export interface UpdatePayoutRequestStatusInput {
  status: string;
  externalReference?: string | null;
  batchId?: string | null;
  processedAt?: Date | null;
  processedBy?: string | null;
  failedReason?: string | null;
}

export interface PayoutRequestFilters {
  status?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export interface PayoutRequestWithRelations extends PayoutRequest {
  seller: {
    id: string;
    email: string | null;
    fullName: string | null;
    username: string;
  };
  transaction: {
    id: string;
    projectId: string;
    project: { title: string };
  };
}

export interface PaginatedPayoutRequests {
  payoutRequests: PayoutRequestWithRelations[];
  total: number;
  page: number;
  limit: number;
}

const SELLER_SELECT = {
  select: { id: true, email: true, fullName: true, username: true },
} as const;

const TRANSACTION_SELECT = {
  select: { id: true, projectId: true, project: { select: { title: true } } },
} as const;

export class PayoutRequestRepository {
  constructor(private prisma: PrismaClient) {}

  async create(input: CreatePayoutRequestInput): Promise<PayoutRequest> {
    return this.prisma.payoutRequest.create({
      data: {
        id: generateUlid(),
        transactionId: input.transactionId,
        sellerId: input.sellerId,
        amountCents: input.amountCents,
        commissionCents: input.commissionCents,
        payoutMethod: input.payoutMethod,
        payoutEmail: input.payoutEmail,
      },
    });
  }

  async findById(id: string): Promise<PayoutRequestWithRelations | null> {
    return this.prisma.payoutRequest.findUnique({
      where: { id },
      include: {
        seller: SELLER_SELECT,
        transaction: TRANSACTION_SELECT,
      },
    }) as Promise<PayoutRequestWithRelations | null>;
  }

  async findPending(limit: number = 50): Promise<PayoutRequestWithRelations[]> {
    return this.prisma.payoutRequest.findMany({
      where: { status: 'pending' },
      include: {
        seller: SELLER_SELECT,
        transaction: TRANSACTION_SELECT,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    }) as Promise<PayoutRequestWithRelations[]>;
  }

  async findByBatchId(batchId: string): Promise<PayoutRequestWithRelations[]> {
    return this.prisma.payoutRequest.findMany({
      where: { batchId },
      include: {
        seller: SELLER_SELECT,
        transaction: TRANSACTION_SELECT,
      },
    }) as Promise<PayoutRequestWithRelations[]>;
  }

  async updateStatus(
    id: string,
    data: UpdatePayoutRequestStatusInput
  ): Promise<PayoutRequest> {
    return this.prisma.payoutRequest.update({
      where: { id },
      data,
    });
  }

  async listWithFilters(filters: PayoutRequestFilters): Promise<PaginatedPayoutRequests> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const where = filters.status ? { status: filters.status } : {};

    const [payoutRequests, total] = await Promise.all([
      this.prisma.payoutRequest.findMany({
        where,
        include: {
          seller: SELLER_SELECT,
          transaction: TRANSACTION_SELECT,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payoutRequest.count({ where }),
    ]);

    return {
      payoutRequests: payoutRequests as PayoutRequestWithRelations[],
      total,
      page,
      limit,
    };
  }
}
