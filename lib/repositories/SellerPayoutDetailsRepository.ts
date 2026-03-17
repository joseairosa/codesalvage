/**
 * SellerPayoutDetailsRepository
 *
 * Data access layer for seller payout details (PayPal email, etc.).
 */

import type { PrismaClient, SellerPayoutDetails, Prisma } from '@prisma/client';
import { monotonicFactory } from 'ulidx';

const generateUlid = monotonicFactory();

export interface CreatePayoutDetailsInput {
  userId: string;
  payoutMethod: string;
  payoutEmail: string;
  payoutDetails?: Prisma.InputJsonValue;
}

export interface UpdatePayoutDetailsInput {
  payoutMethod?: string;
  payoutEmail?: string;
  payoutDetails?: Prisma.InputJsonValue;
  isActive?: boolean;
}

export class SellerPayoutDetailsRepository {
  constructor(private prisma: PrismaClient) {}

  async create(input: CreatePayoutDetailsInput): Promise<SellerPayoutDetails> {
    return this.prisma.sellerPayoutDetails.create({
      data: {
        id: generateUlid(),
        userId: input.userId,
        payoutMethod: input.payoutMethod,
        payoutEmail: input.payoutEmail,
        ...(input.payoutDetails !== undefined && { payoutDetails: input.payoutDetails }),
      },
    });
  }

  async findByUserId(userId: string): Promise<SellerPayoutDetails | null> {
    return this.prisma.sellerPayoutDetails.findUnique({
      where: { userId },
    });
  }

  async update(userId: string, data: UpdatePayoutDetailsInput): Promise<SellerPayoutDetails> {
    return this.prisma.sellerPayoutDetails.update({
      where: { userId },
      data,
    });
  }

  async deactivate(userId: string): Promise<SellerPayoutDetails> {
    return this.prisma.sellerPayoutDetails.update({
      where: { userId },
      data: { isActive: false },
    });
  }
}
