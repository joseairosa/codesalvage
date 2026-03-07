/**
 * DisputeRepository
 *
 * Data access layer for buyer disputes.
 */

import type { PrismaClient } from '@prisma/client';
import { monotonicFactory } from 'ulidx';

const generateUlid = monotonicFactory();

export interface CreateDisputeInput {
  transactionId: string;
  buyerId: string;
  reason: string;
  description: string;
}

export class DisputeRepository {
  constructor(private prisma: PrismaClient) {}

  async create(input: CreateDisputeInput) {
    return this.prisma.dispute.create({
      data: {
        id: generateUlid(),
        transactionId: input.transactionId,
        buyerId: input.buyerId,
        reason: input.reason,
        description: input.description,
        status: 'pending',
      },
    });
  }

  async findByTransactionId(transactionId: string) {
    return this.prisma.dispute.findUnique({
      where: { transactionId },
    });
  }

  async findAll(status?: string) {
    return this.prisma.dispute.findMany({
      ...(status ? { where: { status } } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        buyer: { select: { id: true, username: true, fullName: true, email: true } },
        transaction: {
          select: {
            id: true,
            amountCents: true,
            project: { select: { id: true, title: true } },
          },
        },
      },
    });
  }

  async updateStatus(
    id: string,
    status: string,
    resolution?: string,
    resolvedBy?: string
  ) {
    return this.prisma.dispute.update({
      where: { id },
      data: {
        status,
        ...(resolution !== undefined && { resolution }),
        ...(resolvedBy !== undefined && { resolvedBy }),
        ...(status.startsWith('resolved') && { resolvedAt: new Date() }),
      },
    });
  }
}
