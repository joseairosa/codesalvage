/**
 * FeedbackRepository
 *
 * Data access layer for user feedback submissions.
 */

import type { PrismaClient } from '@prisma/client';
import { monotonicFactory } from 'ulidx';

const generateUlid = monotonicFactory();

export type FeedbackType = 'general' | 'feature' | 'bug' | 'support';
export type FeedbackStatus = 'new' | 'in_progress' | 'resolved' | 'closed';
export type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical';

export interface CreateFeedbackInput {
  type: FeedbackType;
  title: string;
  content: string;
  email: string;
  userId?: string;
  userAgent?: string;
}

export interface UpdateFeedbackInput {
  status?: FeedbackStatus;
  priority?: FeedbackPriority;
  adminNotes?: string;
  resolvedAt?: Date | null;
  resolvedBy?: string | null;
}

export interface FeedbackFilters {
  type?: FeedbackType;
  status?: FeedbackStatus;
  priority?: FeedbackPriority;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface FeedbackStats {
  total: number;
  byStatus: Record<FeedbackStatus, number>;
  byType: Record<FeedbackType, number>;
  byPriority: Record<FeedbackPriority, number>;
}

export class FeedbackRepository {
  constructor(private prisma: PrismaClient) {}

  async create(input: CreateFeedbackInput) {
    return this.prisma.feedback.create({
      data: {
        id: generateUlid(),
        type: input.type,
        title: input.title.slice(0, 200),
        content: input.content,
        email: input.email,
        ...(input.userId !== undefined && { userId: input.userId }),
        ...(input.userAgent !== undefined && { userAgent: input.userAgent }),
        status: 'new',
        priority: 'medium',
      },
    });
  }

  async findById(id: string) {
    return this.prisma.feedback.findUnique({ where: { id } });
  }

  async findMany(filters: FeedbackFilters) {
    const where: Record<string, unknown> = {};

    if (filters.type) where['type'] = filters.type;
    if (filters.status) where['status'] = filters.status;
    if (filters.priority) where['priority'] = filters.priority;

    if (filters.search) {
      where['OR'] = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { content: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: filters.limit ?? 20,
        skip: filters.offset ?? 0,
      }),
      this.prisma.feedback.count({ where }),
    ]);

    return { items, total };
  }

  async update(id: string, data: UpdateFeedbackInput) {
    return this.prisma.feedback.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.adminNotes !== undefined && { adminNotes: data.adminNotes }),
        ...(data.resolvedAt !== undefined && { resolvedAt: data.resolvedAt }),
        ...(data.resolvedBy !== undefined && { resolvedBy: data.resolvedBy }),
      },
    });
  }

  async delete(id: string) {
    return this.prisma.feedback.delete({ where: { id } });
  }

  async countByUserToday(userId: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return this.prisma.feedback.count({
      where: {
        userId,
        createdAt: { gte: startOfDay },
      },
    });
  }

  async getStats(): Promise<FeedbackStats> {
    const statuses: FeedbackStatus[] = ['new', 'in_progress', 'resolved', 'closed'];
    const types: FeedbackType[] = ['general', 'feature', 'bug', 'support'];
    const priorities: FeedbackPriority[] = ['low', 'medium', 'high', 'critical'];

    const [total, statusCounts, typeCounts, priorityCounts] = await Promise.all([
      this.prisma.feedback.count(),
      Promise.all(
        statuses.map(async (s) => ({
          status: s,
          count: await this.prisma.feedback.count({ where: { status: s } }),
        }))
      ),
      Promise.all(
        types.map(async (t) => ({
          type: t,
          count: await this.prisma.feedback.count({ where: { type: t } }),
        }))
      ),
      Promise.all(
        priorities.map(async (p) => ({
          priority: p,
          count: await this.prisma.feedback.count({ where: { priority: p } }),
        }))
      ),
    ]);

    const byStatus = Object.fromEntries(
      statusCounts.map(({ status, count }: { status: FeedbackStatus; count: number }) => [
        status,
        count,
      ])
    ) as Record<FeedbackStatus, number>;

    const byType = Object.fromEntries(
      typeCounts.map(({ type, count }: { type: FeedbackType; count: number }) => [
        type,
        count,
      ])
    ) as Record<FeedbackType, number>;

    const byPriority = Object.fromEntries(
      priorityCounts.map(
        ({ priority, count }: { priority: FeedbackPriority; count: number }) => [
          priority,
          count,
        ]
      )
    ) as Record<FeedbackPriority, number>;

    return { total, byStatus, byType, byPriority };
  }
}
