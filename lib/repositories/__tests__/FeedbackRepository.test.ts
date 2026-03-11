import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedbackRepository } from '../FeedbackRepository';
import type { PrismaClient } from '@prisma/client';

const mockFeedback = {
  create: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockPrisma = {
  feedback: mockFeedback,
} as unknown as PrismaClient;

describe('FeedbackRepository', () => {
  let repo: FeedbackRepository;

  beforeEach(() => {
    repo = new FeedbackRepository(mockPrisma);
    vi.clearAllMocks();
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create feedback with generated ULID', async () => {
      const input = {
        type: 'bug' as const,
        title: 'Something broke',
        content: 'Detailed description',
        email: 'user@example.com',
      };
      mockFeedback.create.mockResolvedValue({ id: 'ulid-123', ...input });

      const result = await repo.create(input);

      expect(mockFeedback.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'bug',
            title: 'Something broke',
            status: 'new',
            priority: 'medium',
          }),
        })
      );
      expect(result).toMatchObject({ type: 'bug', title: 'Something broke' });
    });

    it('should truncate title to 200 characters', async () => {
      const longTitle = 'a'.repeat(250);
      mockFeedback.create.mockResolvedValue({
        id: 'ulid-1',
        title: longTitle.slice(0, 200),
      });

      await repo.create({
        type: 'general',
        title: longTitle,
        content: 'body',
        email: 'a@b.com',
      });

      const callData = mockFeedback.create.mock.calls[0]?.[0]?.data as { title: string };
      expect(callData.title.length).toBe(200);
    });
  });

  // ─── findById ─────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('should return entry when found', async () => {
      mockFeedback.findUnique.mockResolvedValue({ id: 'fb-1', title: 'Test' });

      const result = await repo.findById('fb-1');

      expect(mockFeedback.findUnique).toHaveBeenCalledWith({ where: { id: 'fb-1' } });
      expect(result).toMatchObject({ id: 'fb-1' });
    });

    it('should return null when not found', async () => {
      mockFeedback.findUnique.mockResolvedValue(null);

      const result = await repo.findById('missing');

      expect(result).toBeNull();
    });
  });

  // ─── findMany ─────────────────────────────────────────────────────────────

  describe('findMany', () => {
    it('should return paginated results with total', async () => {
      mockFeedback.findMany.mockResolvedValue([{ id: 'fb-1' }, { id: 'fb-2' }]);
      mockFeedback.count.mockResolvedValue(10);

      const result = await repo.findMany({ limit: 2, offset: 0 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(10);
    });

    it('should apply status filter', async () => {
      mockFeedback.findMany.mockResolvedValue([]);
      mockFeedback.count.mockResolvedValue(0);

      await repo.findMany({ status: 'new' });

      expect(mockFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'new' }) })
      );
    });

    it('should apply search filter across title, content, and email', async () => {
      mockFeedback.findMany.mockResolvedValue([]);
      mockFeedback.count.mockResolvedValue(0);

      await repo.findMany({ search: 'crash' });

      const callWhere = mockFeedback.findMany.mock.calls[0]?.[0]?.where as {
        OR: unknown[];
      };
      expect(callWhere.OR).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: expect.objectContaining({ contains: 'crash' }),
          }),
        ])
      );
    });
  });

  // ─── countByUserToday ─────────────────────────────────────────────────────

  describe('countByUserToday', () => {
    it('should count submissions since start of today', async () => {
      mockFeedback.count.mockResolvedValue(3);

      const result = await repo.countByUserToday('user-abc');

      expect(result).toBe(3);
      expect(mockFeedback.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-abc',
            createdAt: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        })
      );
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update only provided fields', async () => {
      mockFeedback.update.mockResolvedValue({ id: 'fb-1', status: 'resolved' });

      await repo.update('fb-1', { status: 'resolved' });

      expect(mockFeedback.update).toHaveBeenCalledWith({
        where: { id: 'fb-1' },
        data: expect.objectContaining({ status: 'resolved' }),
      });
    });
  });

  // ─── delete ───────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should call prisma delete with the id', async () => {
      mockFeedback.delete.mockResolvedValue({ id: 'fb-1' });

      await repo.delete('fb-1');

      expect(mockFeedback.delete).toHaveBeenCalledWith({ where: { id: 'fb-1' } });
    });
  });
});
