import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FeedbackService,
  FeedbackValidationError,
  FeedbackNotFoundError,
} from '../FeedbackService';
import type { FeedbackRepository } from '@/lib/repositories/FeedbackRepository';

const makeMockRepo = (): FeedbackRepository =>
  ({
    create: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    countByUserToday: vi.fn(),
    getStats: vi.fn(),
  }) as unknown as FeedbackRepository;

const BASE_INPUT = {
  type: 'general' as const,
  title: 'Test title',
  content: 'Test content body',
  email: 'user@example.com',
};

describe('FeedbackService', () => {
  let repo: FeedbackRepository;
  let service: FeedbackService;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new FeedbackService(repo);
    vi.clearAllMocks();
  });

  // ─── submit ──────────────────────────────────────────────────────────────

  describe('submit', () => {
    it('should create feedback for anonymous user', async () => {
      vi.mocked(repo.create).mockResolvedValue({ id: 'abc', ...BASE_INPUT } as never);

      await service.submit(BASE_INPUT);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Test title', content: 'Test content body' })
      );
      expect(repo.countByUserToday).not.toHaveBeenCalled();
    });

    it('should check rate limit for authenticated user', async () => {
      vi.mocked(repo.countByUserToday).mockResolvedValue(2);
      vi.mocked(repo.create).mockResolvedValue({ id: 'abc', ...BASE_INPUT } as never);

      await service.submit(BASE_INPUT, 'user-123');

      expect(repo.countByUserToday).toHaveBeenCalledWith('user-123');
    });

    it('should throw when authenticated user exceeds daily limit', async () => {
      vi.mocked(repo.countByUserToday).mockResolvedValue(5);

      await expect(service.submit(BASE_INPUT, 'user-123')).rejects.toThrow(
        FeedbackValidationError
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('should throw when title is empty', async () => {
      await expect(service.submit({ ...BASE_INPUT, title: '' })).rejects.toThrow(
        FeedbackValidationError
      );
    });

    it('should throw when title exceeds 200 characters', async () => {
      await expect(
        service.submit({ ...BASE_INPUT, title: 'a'.repeat(201) })
      ).rejects.toThrow(FeedbackValidationError);
    });

    it('should throw when content is empty', async () => {
      await expect(service.submit({ ...BASE_INPUT, content: '' })).rejects.toThrow(
        FeedbackValidationError
      );
    });

    it('should throw when content exceeds 5000 characters', async () => {
      await expect(
        service.submit({ ...BASE_INPUT, content: 'a'.repeat(5001) })
      ).rejects.toThrow(FeedbackValidationError);
    });

    it('should throw when email is missing for anonymous user', async () => {
      await expect(service.submit({ ...BASE_INPUT, email: '' })).rejects.toThrow(
        FeedbackValidationError
      );
    });

    it('should trim whitespace from title and content', async () => {
      vi.mocked(repo.create).mockResolvedValue({ id: 'abc', ...BASE_INPUT } as never);

      await service.submit({ ...BASE_INPUT, title: '  trimmed  ', content: '  body  ' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'trimmed', content: 'body' })
      );
    });
  });

  // ─── checkRateLimit ───────────────────────────────────────────────────────

  describe('checkRateLimit', () => {
    it('should return allowed=true when under limit', async () => {
      vi.mocked(repo.countByUserToday).mockResolvedValue(3);

      const result = await service.checkRateLimit('user-123');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should return allowed=false when at limit', async () => {
      vi.mocked(repo.countByUserToday).mockResolvedValue(5);

      const result = await service.checkRateLimit('user-123');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  // ─── updateStatus ─────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('should set resolvedAt and resolvedBy when status is resolved', async () => {
      vi.mocked(repo.findById).mockResolvedValue({ id: 'fb-1', status: 'new' } as never);
      vi.mocked(repo.update).mockResolvedValue({
        id: 'fb-1',
        status: 'resolved',
      } as never);

      await service.updateStatus('fb-1', 'resolved', 'admin-99');

      expect(repo.update).toHaveBeenCalledWith(
        'fb-1',
        expect.objectContaining({
          status: 'resolved',
          resolvedBy: 'admin-99',
          resolvedAt: expect.any(Date),
        })
      );
    });

    it('should clear resolvedAt when status changes away from resolved', async () => {
      vi.mocked(repo.findById).mockResolvedValue({
        id: 'fb-1',
        status: 'resolved',
      } as never);
      vi.mocked(repo.update).mockResolvedValue({ id: 'fb-1', status: 'closed' } as never);

      await service.updateStatus('fb-1', 'closed', 'admin-99');

      expect(repo.update).toHaveBeenCalledWith(
        'fb-1',
        expect.objectContaining({ resolvedAt: null, resolvedBy: null })
      );
    });

    it('should throw FeedbackNotFoundError when entry does not exist', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(
        service.updateStatus('missing', 'resolved', 'admin-99')
      ).rejects.toThrow(FeedbackNotFoundError);
    });
  });

  // ─── updatePriority ───────────────────────────────────────────────────────

  describe('updatePriority', () => {
    it('should update priority', async () => {
      vi.mocked(repo.findById).mockResolvedValue({ id: 'fb-1' } as never);
      vi.mocked(repo.update).mockResolvedValue({ id: 'fb-1', priority: 'high' } as never);

      await service.updatePriority('fb-1', 'high');

      expect(repo.update).toHaveBeenCalledWith('fb-1', { priority: 'high' });
    });

    it('should throw FeedbackNotFoundError for unknown id', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(service.updatePriority('missing', 'high')).rejects.toThrow(
        FeedbackNotFoundError
      );
    });
  });

  // ─── delete ───────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete existing feedback', async () => {
      vi.mocked(repo.findById).mockResolvedValue({ id: 'fb-1' } as never);
      vi.mocked(repo.delete).mockResolvedValue({ id: 'fb-1' } as never);

      await service.delete('fb-1');

      expect(repo.delete).toHaveBeenCalledWith('fb-1');
    });

    it('should throw FeedbackNotFoundError for unknown id', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);

      await expect(service.delete('missing')).rejects.toThrow(FeedbackNotFoundError);
    });
  });
});
