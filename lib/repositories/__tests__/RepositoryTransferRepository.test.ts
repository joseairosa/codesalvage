import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RepositoryTransferRepository } from '../RepositoryTransferRepository';
import type { PrismaClient } from '@prisma/client';

// Mock ulidx
vi.mock('ulidx', () => ({
  ulid: vi.fn(() => 'mock-ulid-123'),
}));

// Mock Prisma Client
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(),
}));

const createMockTransfer = (overrides = {}) => ({
  id: 'mock-ulid-123',
  transactionId: 'txn-001',
  githubRepoFullName: 'seller/awesome-project',
  method: 'github_collaborator',
  status: 'pending',
  githubInvitationId: null,
  sellerGithubUsername: 'seller-gh',
  buyerGithubUsername: null,
  initiatedAt: null,
  invitationSentAt: null,
  acceptedAt: null,
  completedAt: null,
  failedAt: null,
  errorMessage: null,
  retryCount: 0,
  createdAt: new Date('2026-02-11T00:00:00Z'),
  updatedAt: new Date('2026-02-11T00:00:00Z'),
  ...overrides,
});

describe('RepositoryTransferRepository', () => {
  let repo: RepositoryTransferRepository;
  let mockPrismaClient: {
    repositoryTransfer: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrismaClient = {
      repositoryTransfer: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    };

    repo = new RepositoryTransferRepository(mockPrismaClient as unknown as PrismaClient);
  });

  describe('create', () => {
    it('should create a repository transfer with ULID id', async () => {
      const mockTransfer = createMockTransfer();
      mockPrismaClient.repositoryTransfer.create.mockResolvedValue(mockTransfer);

      const result = await repo.create({
        transactionId: 'txn-001',
        githubRepoFullName: 'seller/awesome-project',
        sellerGithubUsername: 'seller-gh',
      });

      expect(mockPrismaClient.repositoryTransfer.create).toHaveBeenCalledWith({
        data: {
          id: 'mock-ulid-123',
          transactionId: 'txn-001',
          githubRepoFullName: 'seller/awesome-project',
          sellerGithubUsername: 'seller-gh',
        },
      });
      expect(result).toEqual(mockTransfer);
      expect(result.id).toBe('mock-ulid-123');
    });

    it('should create with optional fields', async () => {
      const initiatedAt = new Date('2026-02-11T12:00:00Z');
      const invitationSentAt = new Date('2026-02-11T12:01:00Z');
      const mockTransfer = createMockTransfer({
        method: 'manual',
        status: 'invitation_sent',
        buyerGithubUsername: 'buyer-gh',
        githubInvitationId: 'inv-123',
        initiatedAt,
        invitationSentAt,
      });
      mockPrismaClient.repositoryTransfer.create.mockResolvedValue(mockTransfer);

      const result = await repo.create({
        transactionId: 'txn-001',
        githubRepoFullName: 'seller/awesome-project',
        sellerGithubUsername: 'seller-gh',
        method: 'manual',
        status: 'invitation_sent',
        buyerGithubUsername: 'buyer-gh',
        githubInvitationId: 'inv-123',
        initiatedAt,
        invitationSentAt,
      });

      expect(mockPrismaClient.repositoryTransfer.create).toHaveBeenCalledWith({
        data: {
          id: 'mock-ulid-123',
          transactionId: 'txn-001',
          githubRepoFullName: 'seller/awesome-project',
          sellerGithubUsername: 'seller-gh',
          method: 'manual',
          status: 'invitation_sent',
          buyerGithubUsername: 'buyer-gh',
          githubInvitationId: 'inv-123',
          initiatedAt,
          invitationSentAt,
        },
      });
      expect(result).toEqual(mockTransfer);
      expect(result.method).toBe('manual');
      expect(result.buyerGithubUsername).toBe('buyer-gh');
    });
  });

  describe('findById', () => {
    it('should find transfer by id with transaction', async () => {
      const mockTransfer = createMockTransfer({
        transaction: {
          id: 'txn-001',
          projectId: 'proj-001',
          status: 'completed',
        },
      });
      mockPrismaClient.repositoryTransfer.findUnique.mockResolvedValue(mockTransfer);

      const result = await repo.findById('mock-ulid-123');

      expect(mockPrismaClient.repositoryTransfer.findUnique).toHaveBeenCalledWith({
        where: { id: 'mock-ulid-123' },
        include: { transaction: true },
      });
      expect(result).toEqual(mockTransfer);
    });

    it('should return null when not found', async () => {
      mockPrismaClient.repositoryTransfer.findUnique.mockResolvedValue(null);

      const result = await repo.findById('nonexistent-id');

      expect(mockPrismaClient.repositoryTransfer.findUnique).toHaveBeenCalledWith({
        where: { id: 'nonexistent-id' },
        include: { transaction: true },
      });
      expect(result).toBeNull();
    });
  });

  describe('findByTransactionId', () => {
    it('should find transfer by transaction id', async () => {
      const mockTransfer = createMockTransfer();
      mockPrismaClient.repositoryTransfer.findFirst.mockResolvedValue(mockTransfer);

      const result = await repo.findByTransactionId('txn-001');

      expect(mockPrismaClient.repositoryTransfer.findFirst).toHaveBeenCalledWith({
        where: { transactionId: 'txn-001' },
      });
      expect(result).toEqual(mockTransfer);
    });

    it('should return null when not found', async () => {
      mockPrismaClient.repositoryTransfer.findFirst.mockResolvedValue(null);

      const result = await repo.findByTransactionId('txn-nonexistent');

      expect(mockPrismaClient.repositoryTransfer.findFirst).toHaveBeenCalledWith({
        where: { transactionId: 'txn-nonexistent' },
      });
      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should update status', async () => {
      const mockTransfer = createMockTransfer({ status: 'invitation_sent' });
      mockPrismaClient.repositoryTransfer.update.mockResolvedValue(mockTransfer);

      const result = await repo.updateStatus('mock-ulid-123', 'invitation_sent');

      expect(mockPrismaClient.repositoryTransfer.update).toHaveBeenCalledWith({
        where: { id: 'mock-ulid-123' },
        data: {
          status: 'invitation_sent',
        },
      });
      expect(result).toEqual(mockTransfer);
      expect(result.status).toBe('invitation_sent');
    });

    it('should update status with extra fields', async () => {
      const completedAt = new Date('2026-02-12T00:00:00Z');
      const mockTransfer = createMockTransfer({
        status: 'completed',
        completedAt,
      });
      mockPrismaClient.repositoryTransfer.update.mockResolvedValue(mockTransfer);

      const result = await repo.updateStatus('mock-ulid-123', 'completed', {
        completedAt,
      } as Partial<Record<string, unknown>>);

      expect(mockPrismaClient.repositoryTransfer.update).toHaveBeenCalledWith({
        where: { id: 'mock-ulid-123' },
        data: {
          status: 'completed',
          completedAt,
        },
      });
      expect(result).toEqual(mockTransfer);
      expect(result.status).toBe('completed');
      expect(result.completedAt).toEqual(completedAt);
    });

    it('should update status with error message on failure', async () => {
      const failedAt = new Date('2026-02-12T00:00:00Z');
      const mockTransfer = createMockTransfer({
        status: 'failed',
        failedAt,
        errorMessage: 'GitHub API rate limited',
      });
      mockPrismaClient.repositoryTransfer.update.mockResolvedValue(mockTransfer);

      const result = await repo.updateStatus('mock-ulid-123', 'failed', {
        failedAt,
        errorMessage: 'GitHub API rate limited',
      } as Partial<Record<string, unknown>>);

      expect(mockPrismaClient.repositoryTransfer.update).toHaveBeenCalledWith({
        where: { id: 'mock-ulid-123' },
        data: {
          status: 'failed',
          failedAt,
          errorMessage: 'GitHub API rate limited',
        },
      });
      expect(result).toEqual(mockTransfer);
      expect(result.errorMessage).toBe('GitHub API rate limited');
    });
  });

  describe('setBuyerGithubUsername', () => {
    it('should set buyer github username', async () => {
      const mockTransfer = createMockTransfer({
        buyerGithubUsername: 'new-buyer-gh',
      });
      mockPrismaClient.repositoryTransfer.update.mockResolvedValue(mockTransfer);

      const result = await repo.setBuyerGithubUsername('mock-ulid-123', 'new-buyer-gh');

      expect(mockPrismaClient.repositoryTransfer.update).toHaveBeenCalledWith({
        where: { id: 'mock-ulid-123' },
        data: { buyerGithubUsername: 'new-buyer-gh' },
      });
      expect(result).toEqual(mockTransfer);
      expect(result.buyerGithubUsername).toBe('new-buyer-gh');
    });
  });

  describe('incrementRetryCount', () => {
    it('should increment retry count', async () => {
      const mockTransfer = createMockTransfer({ retryCount: 1 });
      mockPrismaClient.repositoryTransfer.update.mockResolvedValue(mockTransfer);

      const result = await repo.incrementRetryCount('mock-ulid-123');

      expect(mockPrismaClient.repositoryTransfer.update).toHaveBeenCalledWith({
        where: { id: 'mock-ulid-123' },
        data: {
          retryCount: { increment: 1 },
        },
      });
      expect(result).toEqual(mockTransfer);
      expect(result.retryCount).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should throw wrapped error on create failure', async () => {
      mockPrismaClient.repositoryTransfer.create.mockRejectedValue(
        new Error('DB connection failed')
      );

      await expect(
        repo.create({
          transactionId: 'txn-001',
          githubRepoFullName: 'seller/awesome-project',
          sellerGithubUsername: 'seller-gh',
        })
      ).rejects.toThrow(
        '[RepositoryTransferRepository] Failed to create repository transfer'
      );
    });

    it('should throw wrapped error on findById failure', async () => {
      mockPrismaClient.repositoryTransfer.findUnique.mockRejectedValue(
        new Error('DB connection failed')
      );

      await expect(repo.findById('mock-ulid-123')).rejects.toThrow(
        '[RepositoryTransferRepository] Failed to find repository transfer by id'
      );
    });

    it('should throw wrapped error on findByTransactionId failure', async () => {
      mockPrismaClient.repositoryTransfer.findFirst.mockRejectedValue(
        new Error('DB connection failed')
      );

      await expect(repo.findByTransactionId('txn-001')).rejects.toThrow(
        '[RepositoryTransferRepository] Failed to find repository transfer by transaction id'
      );
    });

    it('should throw wrapped error on updateStatus failure', async () => {
      mockPrismaClient.repositoryTransfer.update.mockRejectedValue(
        new Error('Record not found')
      );

      await expect(repo.updateStatus('mock-ulid-123', 'completed')).rejects.toThrow(
        '[RepositoryTransferRepository] Failed to update repository transfer status'
      );
    });

    it('should throw wrapped error on setBuyerGithubUsername failure', async () => {
      mockPrismaClient.repositoryTransfer.update.mockRejectedValue(
        new Error('Record not found')
      );

      await expect(
        repo.setBuyerGithubUsername('mock-ulid-123', 'buyer-gh')
      ).rejects.toThrow(
        '[RepositoryTransferRepository] Failed to set buyer GitHub username'
      );
    });

    it('should throw wrapped error on incrementRetryCount failure', async () => {
      mockPrismaClient.repositoryTransfer.update.mockRejectedValue(
        new Error('Record not found')
      );

      await expect(repo.incrementRetryCount('mock-ulid-123')).rejects.toThrow(
        '[RepositoryTransferRepository] Failed to increment retry count'
      );
    });
  });
});
