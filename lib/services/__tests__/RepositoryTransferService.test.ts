/**
 * RepositoryTransferService Unit Tests
 *
 * Tests all business logic for the repository transfer lifecycle:
 * initiation, buyer username setup, transfer confirmation, and timeline generation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RepositoryTransferService,
  RepositoryTransferValidationError,
  RepositoryTransferPermissionError,
  RepositoryTransferNotFoundError,
} from '../RepositoryTransferService';
import { GitHubServiceError } from '../GitHubService';
import type { RepositoryTransferRepository } from '@/lib/repositories/RepositoryTransferRepository';
import type { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import type { GitHubService } from '../GitHubService';
import type { NotificationService } from '../NotificationService';

vi.mock('@/lib/encryption', () => ({
  decrypt: vi.fn().mockReturnValue('decrypted-token'),
}));

const mockRepositoryTransferRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findByTransactionId: vi.fn(),
  updateStatus: vi.fn(),
  setBuyerGithubUsername: vi.fn(),
  incrementRetryCount: vi.fn(),
} as unknown as RepositoryTransferRepository;

const mockTransactionRepository = {
  findById: vi.fn(),
  releaseEscrow: vi.fn().mockResolvedValue({}),
  updateEscrowStatus: vi.fn().mockResolvedValue({}),
  findTransactionsForAutoTransfer: vi.fn().mockResolvedValue([]),
  claimForTransferProcessing: vi.fn().mockResolvedValue(1),
  setEscrowReleaseDate: vi.fn().mockResolvedValue({}),
} as unknown as TransactionRepository;

const mockGitHubService = {
  parseGitHubUrl: vi.fn().mockReturnValue({ owner: 'test-owner', repo: 'test-repo' }),
  addCollaborator: vi
    .fn()
    .mockResolvedValue({ invitationId: 'inv-123', alreadyCollaborator: false }),
  transferOwnership: vi.fn().mockResolvedValue({ success: true }),
} as unknown as GitHubService;

const mockNotificationService = {
  createNotification: vi.fn().mockResolvedValue({}),
} as unknown as NotificationService;

const createMockTransaction = (overrides = {}) => ({
  id: 'txn-123',
  projectId: 'project-123',
  sellerId: 'seller-123',
  buyerId: 'buyer-123',
  amountCents: 50000,
  commissionCents: 9000,
  sellerReceivesCents: 41000,
  paymentStatus: 'succeeded',
  escrowStatus: 'held',
  escrowReleaseDate: new Date('2026-02-18T00:00:00Z'),
  releasedToSellerAt: null,
  codeDeliveryStatus: 'pending',
  stripePaymentIntentId: 'pi_test',
  createdAt: new Date('2026-02-11T00:00:00Z'),
  updatedAt: new Date('2026-02-11T00:00:00Z'),
  project: {
    id: 'project-123',
    title: 'Test Project',
    description: 'A test project',
    thumbnailImageUrl: null,
    priceCents: 50000,
    status: 'sold',
    githubUrl: 'https://github.com/test-owner/test-repo',
    githubRepoName: 'test-repo',
  },
  seller: {
    id: 'seller-123',
    username: 'seller',
    fullName: 'Test Seller',
    avatarUrl: null,
    stripeAccountId: 'acct_test',
    email: 'seller@test.com',
    githubUsername: 'seller-gh',
    githubAccessToken: 'encrypted-token',
  },
  buyer: {
    id: 'buyer-123',
    username: 'buyer',
    fullName: 'Test Buyer',
    avatarUrl: null,
    email: 'buyer@test.com',
    githubUsername: 'buyer-gh',
  },
  review: null,
  offer: {
    id: 'offer-123',
    status: 'accepted',
    offeredPriceCents: 45000,
    respondedAt: new Date('2026-02-10T12:00:00Z'),
  },
  repositoryTransfer: null,
  ...overrides,
});

const createMockTransfer = (overrides = {}) => ({
  id: 'transfer-123',
  transactionId: 'txn-123',
  githubRepoFullName: 'test-owner/test-repo',
  method: 'github_collaborator',
  status: 'pending',
  githubInvitationId: null,
  sellerGithubUsername: 'seller-gh',
  buyerGithubUsername: null,
  initiatedAt: new Date('2026-02-11T00:00:00Z'),
  invitationSentAt: null,
  acceptedAt: null,
  completedAt: null,
  failedAt: null,
  errorMessage: null,
  retryCount: 0,
  transferInitiatedAt: null,
  ownershipTransferredAt: null,
  createdAt: new Date('2026-02-11T00:00:00Z'),
  updatedAt: new Date('2026-02-11T00:00:00Z'),
  ...overrides,
});

let service: RepositoryTransferService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new RepositoryTransferService(
    mockRepositoryTransferRepository,
    mockTransactionRepository,
    mockGitHubService,
    mockNotificationService
  );
});

describe('RepositoryTransferService', () => {
  describe('initiateTransfer', () => {
    it('should initiate transfer when buyer has github username (invitation_sent)', async () => {
      const transaction = createMockTransaction();
      const transfer = createMockTransfer({
        status: 'invitation_sent',
        buyerGithubUsername: 'buyer-gh',
        invitationSentAt: new Date(),
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (
        mockRepositoryTransferRepository.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue(transfer);

      const result = await service.initiateTransfer('seller-123', 'txn-123');

      expect(result).toEqual(transfer);
      expect(mockGitHubService.addCollaborator).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        'buyer-gh',
        'decrypted-token'
      );
      expect(mockRepositoryTransferRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: 'txn-123',
          githubRepoFullName: 'test-owner/test-repo',
          sellerGithubUsername: 'seller-gh',
          buyerGithubUsername: 'buyer-gh',
          status: 'invitation_sent',
          initiatedAt: expect.any(Date),
          invitationSentAt: expect.any(Date),
        })
      );
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'buyer-123',
          type: 'repo_transfer_initiated',
        })
      );
    });

    it('should initiate transfer when buyer has no github username (pending)', async () => {
      const transaction = createMockTransaction({
        buyer: {
          id: 'buyer-123',
          username: 'buyer',
          fullName: 'Test Buyer',
          avatarUrl: null,
          email: 'buyer@test.com',
          githubUsername: null,
        },
      });
      const transfer = createMockTransfer({ status: 'pending' });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (
        mockRepositoryTransferRepository.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue(transfer);

      const result = await service.initiateTransfer('seller-123', 'txn-123');

      expect(result).toEqual(transfer);
      expect(mockGitHubService.addCollaborator).not.toHaveBeenCalled();
      expect(mockRepositoryTransferRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          initiatedAt: expect.any(Date),
        })
      );
      expect(mockRepositoryTransferRepository.create).toHaveBeenCalledWith(
        expect.not.objectContaining({
          buyerGithubUsername: expect.any(String),
        })
      );
    });

    it('should throw NotFoundError when transaction not found', async () => {
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      await expect(service.initiateTransfer('seller-123', 'nonexistent')).rejects.toThrow(
        RepositoryTransferNotFoundError
      );
    });

    it('should throw PermissionError when user is not seller', async () => {
      const transaction = createMockTransaction();
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      await expect(service.initiateTransfer('stranger-999', 'txn-123')).rejects.toThrow(
        RepositoryTransferPermissionError
      );
    });

    it('should throw ValidationError when payment not succeeded', async () => {
      const transaction = createMockTransaction({ paymentStatus: 'pending' });
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      await expect(service.initiateTransfer('seller-123', 'txn-123')).rejects.toThrow(
        RepositoryTransferValidationError
      );
      await expect(service.initiateTransfer('seller-123', 'txn-123')).rejects.toThrow(
        'Payment must be completed'
      );
    });

    it('should throw ValidationError when project has no github url', async () => {
      const transaction = createMockTransaction({
        project: {
          id: 'project-123',
          title: 'Test Project',
          description: 'A test project',
          thumbnailImageUrl: null,
          priceCents: 50000,
          status: 'sold',
          githubUrl: null,
          githubRepoName: null,
        },
      });
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      await expect(service.initiateTransfer('seller-123', 'txn-123')).rejects.toThrow(
        RepositoryTransferValidationError
      );
      await expect(service.initiateTransfer('seller-123', 'txn-123')).rejects.toThrow(
        'Project has no GitHub repository'
      );
    });

    it('should throw ValidationError when seller github not connected', async () => {
      const transaction = createMockTransaction({
        seller: {
          id: 'seller-123',
          username: 'seller',
          fullName: 'Test Seller',
          avatarUrl: null,
          stripeAccountId: 'acct_test',
          email: 'seller@test.com',
          githubUsername: 'seller-gh',
          githubAccessToken: null,
        },
      });
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      await expect(service.initiateTransfer('seller-123', 'txn-123')).rejects.toThrow(
        RepositoryTransferValidationError
      );
      await expect(service.initiateTransfer('seller-123', 'txn-123')).rejects.toThrow(
        'Seller GitHub account not connected'
      );
    });

    it('should throw ValidationError when transfer already exists', async () => {
      const transaction = createMockTransaction();
      const existingTransfer = createMockTransfer();

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(existingTransfer);

      await expect(service.initiateTransfer('seller-123', 'txn-123')).rejects.toThrow(
        RepositoryTransferValidationError
      );
      await expect(service.initiateTransfer('seller-123', 'txn-123')).rejects.toThrow(
        'Transfer already initiated'
      );
    });
  });

  describe('setBuyerGithubUsername', () => {
    it('should set buyer github username', async () => {
      const transaction = createMockTransaction();
      const transfer = createMockTransfer({
        status: 'invitation_sent',
        initiatedAt: null,
      });
      const updatedTransfer = createMockTransfer({
        buyerGithubUsername: 'new-buyer-gh',
        status: 'invitation_sent',
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(transfer);
      (
        mockRepositoryTransferRepository.setBuyerGithubUsername as ReturnType<
          typeof vi.fn
        >
      ).mockResolvedValue(updatedTransfer);

      const result = await service.setBuyerGithubUsername(
        'buyer-123',
        'txn-123',
        'new-buyer-gh'
      );

      expect(result).toEqual(updatedTransfer);
      expect(
        mockRepositoryTransferRepository.setBuyerGithubUsername
      ).toHaveBeenCalledWith('transfer-123', 'new-buyer-gh');
    });

    it('should auto-send invitation when transfer is pending and seller initiated', async () => {
      const transaction = createMockTransaction();
      const transfer = createMockTransfer({
        status: 'pending',
        initiatedAt: new Date(),
      });
      const afterUsernameSet = createMockTransfer({
        buyerGithubUsername: 'new-buyer-gh',
        status: 'pending',
      });
      const afterInvitation = createMockTransfer({
        buyerGithubUsername: 'new-buyer-gh',
        status: 'invitation_sent',
        invitationSentAt: new Date(),
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(transfer);
      (
        mockRepositoryTransferRepository.setBuyerGithubUsername as ReturnType<
          typeof vi.fn
        >
      ).mockResolvedValue(afterUsernameSet);
      (
        mockRepositoryTransferRepository.updateStatus as ReturnType<typeof vi.fn>
      ).mockResolvedValue(afterInvitation);

      const result = await service.setBuyerGithubUsername(
        'buyer-123',
        'txn-123',
        'new-buyer-gh'
      );

      expect(result).toEqual(afterInvitation);
      expect(mockGitHubService.addCollaborator).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        'new-buyer-gh',
        'decrypted-token'
      );
      expect(mockRepositoryTransferRepository.updateStatus).toHaveBeenCalledWith(
        'transfer-123',
        'invitation_sent',
        { invitationSentAt: expect.any(Date) }
      );
    });

    it('should throw PermissionError when user is not buyer', async () => {
      const transaction = createMockTransaction();
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      await expect(
        service.setBuyerGithubUsername('stranger-999', 'txn-123', 'username')
      ).rejects.toThrow(RepositoryTransferPermissionError);
    });

    it('should auto-create RepositoryTransfer record when none exists and add collaborator', async () => {
      const transaction = createMockTransaction();
      const createdTransfer = createMockTransfer({ status: 'pending' });
      const withUsername = createMockTransfer({
        buyerGithubUsername: 'new-buyer-gh',
        status: 'pending',
      });
      const withInvitation = createMockTransfer({
        buyerGithubUsername: 'new-buyer-gh',
        status: 'invitation_sent',
        invitationSentAt: new Date(),
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);
      (
        mockRepositoryTransferRepository.create as ReturnType<typeof vi.fn>
      ).mockResolvedValue(createdTransfer);
      (
        mockRepositoryTransferRepository.setBuyerGithubUsername as ReturnType<
          typeof vi.fn
        >
      ).mockResolvedValue(withUsername);
      (
        mockRepositoryTransferRepository.updateStatus as ReturnType<typeof vi.fn>
      ).mockResolvedValue(withInvitation);

      const result = await service.setBuyerGithubUsername(
        'buyer-123',
        'txn-123',
        'new-buyer-gh'
      );

      expect(mockRepositoryTransferRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: 'txn-123',
          githubRepoFullName: 'test-owner/test-repo',
          sellerGithubUsername: 'seller-gh',
          status: 'pending',
          initiatedAt: expect.any(Date),
        })
      );
      expect(mockGitHubService.addCollaborator).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        'new-buyer-gh',
        'decrypted-token'
      );
      expect(mockRepositoryTransferRepository.updateStatus).toHaveBeenCalledWith(
        'transfer-123',
        'invitation_sent',
        { invitationSentAt: expect.any(Date) }
      );
      expect(result).toEqual(withInvitation);
    });

    it('should NOT call addCollaborator when transfer already in invitation_sent state (idempotent)', async () => {
      const transaction = createMockTransaction();
      const transfer = createMockTransfer({ status: 'invitation_sent' });
      const updatedTransfer = createMockTransfer({
        buyerGithubUsername: 'new-buyer-gh',
        status: 'invitation_sent',
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(transfer);
      (
        mockRepositoryTransferRepository.setBuyerGithubUsername as ReturnType<
          typeof vi.fn
        >
      ).mockResolvedValue(updatedTransfer);

      const result = await service.setBuyerGithubUsername(
        'buyer-123',
        'txn-123',
        'new-buyer-gh'
      );

      expect(mockGitHubService.addCollaborator).not.toHaveBeenCalled();
      expect(mockRepositoryTransferRepository.updateStatus).not.toHaveBeenCalled();
      expect(result).toEqual(updatedTransfer);
    });

    it('should save username even when addCollaborator fails', async () => {
      const transaction = createMockTransaction();
      const transfer = createMockTransfer({ status: 'pending' });
      const withUsername = createMockTransfer({
        buyerGithubUsername: 'new-buyer-gh',
        status: 'pending',
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(transfer);
      (
        mockRepositoryTransferRepository.setBuyerGithubUsername as ReturnType<
          typeof vi.fn
        >
      ).mockResolvedValue(withUsername);
      (mockGitHubService.addCollaborator as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('GitHub API error')
      );

      await expect(
        service.setBuyerGithubUsername('buyer-123', 'txn-123', 'new-buyer-gh')
      ).rejects.toThrow('GitHub API error');

      expect(
        mockRepositoryTransferRepository.setBuyerGithubUsername
      ).toHaveBeenCalledWith('transfer-123', 'new-buyer-gh');
    });

    it('should throw ValidationError when payment not succeeded', async () => {
      const transaction = createMockTransaction({ paymentStatus: 'pending' });
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      await expect(
        service.setBuyerGithubUsername('buyer-123', 'txn-123', 'username')
      ).rejects.toThrow(RepositoryTransferValidationError);
      await expect(
        service.setBuyerGithubUsername('buyer-123', 'txn-123', 'username')
      ).rejects.toThrow('Payment must be completed');
    });

    it('should throw ValidationError when project has no GitHub URL', async () => {
      const transaction = createMockTransaction({
        project: {
          id: 'project-123',
          title: 'Test Project',
          description: 'A test project',
          thumbnailImageUrl: null,
          priceCents: 50000,
          status: 'sold',
          githubUrl: null,
          githubRepoName: null,
        },
      });
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      await expect(
        service.setBuyerGithubUsername('buyer-123', 'txn-123', 'username')
      ).rejects.toThrow(RepositoryTransferValidationError);
      await expect(
        service.setBuyerGithubUsername('buyer-123', 'txn-123', 'username')
      ).rejects.toThrow('Project has no GitHub repository');
    });

    it('should throw ValidationError when seller GitHub token is null', async () => {
      const transaction = createMockTransaction({
        seller: {
          id: 'seller-123',
          username: 'seller',
          fullName: 'Test Seller',
          avatarUrl: null,
          stripeAccountId: 'acct_test',
          email: 'seller@test.com',
          githubUsername: 'seller-gh',
          githubAccessToken: null,
        },
      });
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      await expect(
        service.setBuyerGithubUsername('buyer-123', 'txn-123', 'username')
      ).rejects.toThrow(RepositoryTransferValidationError);
      await expect(
        service.setBuyerGithubUsername('buyer-123', 'txn-123', 'username')
      ).rejects.toThrow('Seller GitHub account not connected');
    });
  });

  describe('confirmTransfer', () => {
    it('should confirm transfer and notify seller', async () => {
      const transaction = createMockTransaction();
      const transfer = createMockTransfer({ status: 'invitation_sent' });
      const updatedTransfer = createMockTransfer({
        status: 'completed',
        completedAt: new Date(),
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(transfer);
      (
        mockRepositoryTransferRepository.updateStatus as ReturnType<typeof vi.fn>
      ).mockResolvedValue(updatedTransfer);

      const result = await service.confirmTransfer('buyer-123', 'txn-123');

      expect(result).toEqual(updatedTransfer);
      expect(mockRepositoryTransferRepository.updateStatus).toHaveBeenCalledWith(
        'transfer-123',
        'completed',
        { completedAt: expect.any(Date) }
      );
      expect(mockNotificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'seller-123',
          type: 'repo_transfer_confirmed',
          title: 'Repository Transfer Confirmed',
        })
      );
    });

    it('should throw PermissionError when user is not buyer', async () => {
      const transaction = createMockTransaction();
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      await expect(service.confirmTransfer('stranger-999', 'txn-123')).rejects.toThrow(
        RepositoryTransferPermissionError
      );
    });

    it('should throw NotFoundError when transfer not found', async () => {
      const transaction = createMockTransaction();
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      await expect(service.confirmTransfer('buyer-123', 'txn-123')).rejects.toThrow(
        RepositoryTransferNotFoundError
      );
    });
  });

  describe('getTimelineData', () => {
    it('should return 6 stages for completed transaction', async () => {
      const transaction = createMockTransaction({
        escrowStatus: 'released',
        releasedToSellerAt: new Date('2026-02-18T12:00:00Z'),
        escrowReleaseDate: new Date('2026-02-18T00:00:00Z'),
        repositoryTransfer: {
          id: 'transfer-123',
          githubRepoFullName: 'test-owner/test-repo',
          method: 'github_collaborator',
          status: 'completed',
          githubInvitationId: 'inv-123',
          sellerGithubUsername: 'seller-gh',
          buyerGithubUsername: 'buyer-gh',
          initiatedAt: new Date('2026-02-11T01:00:00Z'),
          invitationSentAt: new Date('2026-02-11T01:00:00Z'),
          acceptedAt: new Date('2026-02-11T02:00:00Z'),
          completedAt: new Date('2026-02-11T03:00:00Z'),
          failedAt: null,
          errorMessage: null,
          retryCount: 0,
          createdAt: new Date('2026-02-11T01:00:00Z'),
        },
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      const stages = await service.getTimelineData('txn-123', 'buyer-123');

      expect(stages).toHaveLength(6);
      expect(stages[0]!.name).toBe('Offer Accepted');
      expect(stages[0]!.status).toBe('completed');
      expect(stages[1]!.name).toBe('Payment Received');
      expect(stages[1]!.status).toBe('completed');
      expect(stages[2]!.name).toBe('Collaborator Access');
      expect(stages[2]!.status).toBe('completed');
      expect(stages[3]!.name).toBe('Project Review');
      expect(stages[4]!.name).toBe('Trade Review');
      expect(stages[5]!.name).toBe('Ownership Transfer');
      expect(stages[5]!.status).toBe('completed');
    });

    it('should show offer accepted for direct purchase (no offer)', async () => {
      const transaction = createMockTransaction({
        offer: null,
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      const stages = await service.getTimelineData('txn-123', 'buyer-123');

      expect(stages[0]!.name).toBe('Offer Accepted');
      expect(stages[0]!.status).toBe('completed');
      expect(stages[0]!.description).toBe('Direct purchase at listing price');
      expect(stages[0]!.completedAt).toEqual(transaction.createdAt);
    });

    it('should show active payment when pending', async () => {
      const transaction = createMockTransaction({
        paymentStatus: 'pending',
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      const stages = await service.getTimelineData('txn-123', 'buyer-123');

      expect(stages[1]!.name).toBe('Payment Received');
      expect(stages[1]!.status).toBe('active');
      expect(stages[1]!.description).toBe('Waiting for payment confirmation');
      expect(stages[1]!.completedAt).toBeNull();
    });

    it('should skip repository transfer when no github url', async () => {
      const transaction = createMockTransaction({
        project: {
          id: 'project-123',
          title: 'Test Project',
          description: 'A test project',
          thumbnailImageUrl: null,
          priceCents: 50000,
          status: 'sold',
          githubUrl: null,
          githubRepoName: null,
        },
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      const stages = await service.getTimelineData('txn-123', 'buyer-123');

      expect(stages[2]!.name).toBe('Collaborator Access');
      expect(stages[2]!.status).toBe('skipped');
      expect(stages[2]!.description).toBe('No GitHub repository linked to this project');
    });

    it('should show active transfer for seller with action', async () => {
      const transaction = createMockTransaction({
        repositoryTransfer: null,
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      const stages = await service.getTimelineData('txn-123', 'seller-123');

      expect(stages[2]!.name).toBe('Collaborator Access');
      expect(stages[2]!.status).toBe('active');
      expect(stages[2]!.actions).toHaveLength(0);
      expect(stages[2]!.description).toBe('Awaiting buyer GitHub username');
    });

    it('should show active transfer for buyer with confirm action', async () => {
      const transaction = createMockTransaction({
        repositoryTransfer: {
          id: 'transfer-123',
          githubRepoFullName: 'test-owner/test-repo',
          method: 'github_collaborator',
          status: 'invitation_sent',
          githubInvitationId: 'inv-123',
          sellerGithubUsername: 'seller-gh',
          buyerGithubUsername: 'buyer-gh',
          initiatedAt: new Date(),
          invitationSentAt: new Date(),
          acceptedAt: null,
          completedAt: null,
          failedAt: null,
          errorMessage: null,
          retryCount: 0,
          createdAt: new Date(),
        },
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      const stages = await service.getTimelineData('txn-123', 'buyer-123');

      expect(stages[2]!.name).toBe('Collaborator Access');
      expect(stages[2]!.status).toBe('completed');
      expect(stages[2]!.actions).toHaveLength(0);
      expect(stages[2]!.description).toBe(
        'Collaborator access granted — buyer has been added to the repository'
      );
    });

    it('should show connect github action for buyer when no transfer record', async () => {
      const transaction = createMockTransaction({ repositoryTransfer: null });
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      const stages = await service.getTimelineData('txn-123', 'buyer-123');

      expect(stages[2]!.status).toBe('active');
      expect(stages[2]!.actions).toHaveLength(1);
      expect(stages[2]!.actions[0]!.label).toBe('Connect GitHub Account');
      expect(stages[2]!.actions[0]!.url).toBe('/checkout/success?transactionId=txn-123');
    });

    it('should show connect github action for buyer when transfer is pending', async () => {
      const transaction = createMockTransaction({
        repositoryTransfer: {
          id: 'transfer-123',
          githubRepoFullName: 'test-owner/test-repo',
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
          createdAt: new Date(),
        },
      });
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      const stages = await service.getTimelineData('txn-123', 'buyer-123');

      expect(stages[2]!.status).toBe('active');
      expect(stages[2]!.actions).toHaveLength(1);
      expect(stages[2]!.actions[0]!.label).toBe('Connect GitHub Account');
      expect(stages[2]!.actions[0]!.url).toBe('/checkout/success?transactionId=txn-123');
    });

    it('should show active review period with days remaining', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const transaction = createMockTransaction({
        escrowReleaseDate: futureDate,
        repositoryTransfer: {
          id: 'transfer-123',
          githubRepoFullName: 'test-owner/test-repo',
          method: 'github_collaborator',
          status: 'completed',
          githubInvitationId: null,
          sellerGithubUsername: 'seller-gh',
          buyerGithubUsername: 'buyer-gh',
          initiatedAt: new Date(),
          invitationSentAt: new Date(),
          acceptedAt: new Date(),
          completedAt: new Date(),
          failedAt: null,
          errorMessage: null,
          retryCount: 0,
          createdAt: new Date(),
        },
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      const stages = await service.getTimelineData('txn-123', 'buyer-123');

      expect(stages[3]!.name).toBe('Project Review');
      expect(stages[3]!.status).toBe('active');
      expect(stages[3]!.description).toMatch(/\d+ days? remaining to review/);
      expect(stages[3]!.metadata).toBeDefined();
      expect(stages[3]!.metadata!['daysRemaining']).toBeGreaterThan(0);
      expect(stages[3]!.actions).toHaveLength(0);
      expect(stages[4]!.name).toBe('Trade Review');
      expect(stages[4]!.status).toBe('active');
      expect(stages[4]!.actions).toHaveLength(1);
      expect(stages[4]!.actions[0]).toEqual({
        label: 'Leave Review',
        type: 'link',
        url: '/transactions/txn-123/review',
      });
    });

    it('should show completed escrow', async () => {
      const pastDate = new Date('2026-01-01T00:00:00Z');
      const transaction = createMockTransaction({
        escrowStatus: 'released',
        escrowReleaseDate: pastDate,
        releasedToSellerAt: new Date('2026-01-08T00:00:00Z'),
        repositoryTransfer: {
          id: 'transfer-123',
          githubRepoFullName: 'test-owner/test-repo',
          method: 'github_collaborator',
          status: 'completed',
          githubInvitationId: null,
          sellerGithubUsername: 'seller-gh',
          buyerGithubUsername: 'buyer-gh',
          initiatedAt: new Date(),
          invitationSentAt: new Date(),
          acceptedAt: new Date(),
          completedAt: new Date(),
          failedAt: null,
          errorMessage: null,
          retryCount: 0,
          createdAt: new Date(),
        },
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      const stages = await service.getTimelineData('txn-123', 'seller-123');

      expect(stages[5]!.name).toBe('Ownership Transfer');
      expect(stages[5]!.status).toBe('completed');
      expect(stages[5]!.completedAt).toEqual(new Date('2026-01-08T00:00:00Z'));
      expect(stages[5]!.description).toBe(
        'Ownership transferred — funds have been released to the seller'
      );
    });

    it('should throw PermissionError when user is not buyer or seller', async () => {
      const transaction = createMockTransaction();
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      await expect(service.getTimelineData('txn-123', 'stranger-999')).rejects.toThrow(
        RepositoryTransferPermissionError
      );
    });

    it('should name stage 3 "Collaborator Access" not "Repository Transfer"', async () => {
      const transaction = createMockTransaction({ repositoryTransfer: null });
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      const stages = await service.getTimelineData('txn-123', 'buyer-123');

      expect(stages[2]!.name).toBe('Collaborator Access');
    });

    it('should mark Collaborator Access completed when invitation_sent', async () => {
      const transaction = createMockTransaction({
        repositoryTransfer: {
          id: 'transfer-123',
          githubRepoFullName: 'test-owner/test-repo',
          method: 'github_collaborator',
          status: 'invitation_sent',
          githubInvitationId: 'inv-123',
          sellerGithubUsername: 'seller-gh',
          buyerGithubUsername: 'buyer-gh',
          initiatedAt: new Date(),
          invitationSentAt: new Date(),
          acceptedAt: null,
          completedAt: null,
          failedAt: null,
          errorMessage: null,
          retryCount: 0,
          createdAt: new Date(),
        },
      });
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      const stages = await service.getTimelineData('txn-123', 'buyer-123');

      expect(stages[2]!.name).toBe('Collaborator Access');
      expect(stages[2]!.status).toBe('completed');
    });

    it('should show review period active immediately after payment (no stage 3 dependency)', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const transaction = createMockTransaction({
        escrowReleaseDate: futureDate,
        repositoryTransfer: null,
      });
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      const stages = await service.getTimelineData('txn-123', 'buyer-123');

      expect(stages[3]!.name).toBe('Project Review');
      expect(stages[3]!.status).toBe('active');
    });

    it('should name stage 6 "Ownership Transfer" not "Escrow Released"', async () => {
      const transaction = createMockTransaction();
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      const stages = await service.getTimelineData('txn-123', 'buyer-123');

      expect(stages[5]!.name).toBe('Ownership Transfer');
    });

    it('should show "Transfer Now" button for seller when review period has passed', async () => {
      const pastDate = new Date('2026-02-01T00:00:00Z');
      const transaction = createMockTransaction({
        escrowReleaseDate: pastDate,
        repositoryTransfer: {
          id: 'transfer-123',
          githubRepoFullName: 'test-owner/test-repo',
          method: 'github_collaborator',
          status: 'invitation_sent',
          githubInvitationId: 'inv-123',
          sellerGithubUsername: 'seller-gh',
          buyerGithubUsername: 'buyer-gh',
          initiatedAt: new Date(),
          invitationSentAt: new Date(),
          acceptedAt: null,
          completedAt: null,
          failedAt: null,
          errorMessage: null,
          retryCount: 0,
          createdAt: new Date(),
        },
      });
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      const stages = await service.getTimelineData('txn-123', 'seller-123');

      const ownershipStage = stages[5]!;
      expect(ownershipStage.name).toBe('Ownership Transfer');
      expect(ownershipStage.actions).toHaveLength(1);
      expect(ownershipStage.actions[0]!.label).toBe('Transfer Now');
      expect(ownershipStage.actions[0]!.apiEndpoint).toBe(
        '/api/transactions/txn-123/transfer-ownership'
      );
      expect(ownershipStage.actions[0]!.apiMethod).toBe('POST');
    });

    it('should show no actions for ownership transfer during review period', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const transaction = createMockTransaction({
        escrowReleaseDate: futureDate,
        repositoryTransfer: {
          id: 'transfer-123',
          githubRepoFullName: 'test-owner/test-repo',
          method: 'github_collaborator',
          status: 'invitation_sent',
          githubInvitationId: null,
          sellerGithubUsername: 'seller-gh',
          buyerGithubUsername: 'buyer-gh',
          initiatedAt: new Date(),
          invitationSentAt: new Date(),
          acceptedAt: null,
          completedAt: null,
          failedAt: null,
          errorMessage: null,
          retryCount: 0,
          createdAt: new Date(),
        },
      });
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      const stages = await service.getTimelineData('txn-123', 'seller-123');

      const ownershipStage = stages[5]!;
      expect(ownershipStage.name).toBe('Ownership Transfer');
      expect(ownershipStage.status).toBe('upcoming');
      expect(ownershipStage.actions).toHaveLength(0);
    });

    it('should show transfer in progress description when transfer_initiated in stage 5', async () => {
      const transaction = createMockTransaction({
        repositoryTransfer: {
          id: 'transfer-123',
          githubRepoFullName: 'test-owner/test-repo',
          method: 'github_collaborator',
          status: 'transfer_initiated',
          githubInvitationId: null,
          sellerGithubUsername: 'seller-gh',
          buyerGithubUsername: 'buyer-gh',
          initiatedAt: new Date(),
          invitationSentAt: new Date(),
          acceptedAt: null,
          completedAt: null,
          transferInitiatedAt: new Date(),
          failedAt: null,
          errorMessage: null,
          retryCount: 0,
          createdAt: new Date(),
        },
      });
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );

      const stages = await service.getTimelineData('txn-123', 'buyer-123');

      const ownershipStage = stages[5]!;
      expect(ownershipStage.name).toBe('Ownership Transfer');
      expect(ownershipStage.status).toBe('active');
      expect(ownershipStage.description).toContain('progress');
    });
  });

  describe('transferOwnership', () => {
    it('should call GitHub transfer API and release escrow when review period has passed', async () => {
      const pastDate = new Date('2026-02-01T00:00:00Z');
      const transaction = createMockTransaction({ escrowReleaseDate: pastDate });
      const transfer = createMockTransfer({
        status: 'invitation_sent',
        buyerGithubUsername: 'buyer-gh',
      });
      const updatedTransfer = createMockTransfer({
        status: 'transfer_initiated',
        transferInitiatedAt: new Date(),
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(transfer);
      (
        mockTransactionRepository.claimForTransferProcessing as ReturnType<typeof vi.fn>
      ).mockResolvedValue(1);
      (mockGitHubService.transferOwnership as ReturnType<typeof vi.fn>).mockResolvedValue(
        { success: true }
      );
      (
        mockRepositoryTransferRepository.updateStatus as ReturnType<typeof vi.fn>
      ).mockResolvedValue(updatedTransfer);

      const result = await service.transferOwnership('txn-123');

      expect(result.success).toBe(true);
      expect(mockGitHubService.transferOwnership).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        'buyer-gh',
        'decrypted-token'
      );
      expect(mockRepositoryTransferRepository.updateStatus).toHaveBeenCalledWith(
        'transfer-123',
        'transfer_initiated',
        { transferInitiatedAt: expect.any(Date) }
      );
      expect(mockTransactionRepository.releaseEscrow).toHaveBeenCalledWith('txn-123');
    });

    it('should accept invitation_sent status (not just completed)', async () => {
      const pastDate = new Date('2026-02-01T00:00:00Z');
      const transaction = createMockTransaction({ escrowReleaseDate: pastDate });
      const transfer = createMockTransfer({
        status: 'invitation_sent',
        buyerGithubUsername: 'buyer-gh',
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(transfer);
      (
        mockTransactionRepository.claimForTransferProcessing as ReturnType<typeof vi.fn>
      ).mockResolvedValue(1);
      (mockGitHubService.transferOwnership as ReturnType<typeof vi.fn>).mockResolvedValue(
        { success: true }
      );
      (
        mockRepositoryTransferRepository.updateStatus as ReturnType<typeof vi.fn>
      ).mockResolvedValue(createMockTransfer({ status: 'transfer_initiated' }));

      const result = await service.transferOwnership('txn-123');

      expect(result.success).toBe(true);
      expect(mockGitHubService.transferOwnership).toHaveBeenCalled();
    });

    it('should skip when no RepositoryTransfer record exists', async () => {
      const transaction = createMockTransaction();

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      const result = await service.transferOwnership('txn-123');

      expect(result.success).toBe(false);
      expect((result as any).skipped).toBe(true);
      expect(mockGitHubService.transferOwnership).not.toHaveBeenCalled();
    });

    it('should skip when transfer is in pending status without incrementing retry count', async () => {
      const transaction = createMockTransaction();
      const transfer = createMockTransfer({
        status: 'pending',
        buyerGithubUsername: null,
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(transfer);

      const result = await service.transferOwnership('txn-123');

      expect(result.success).toBe(false);
      expect((result as any).skipped).toBe(true);
      expect(mockGitHubService.transferOwnership).not.toHaveBeenCalled();
      expect(mockRepositoryTransferRepository.incrementRetryCount).not.toHaveBeenCalled();
    });

    it('should skip when buyer GitHub username is not set', async () => {
      const transaction = createMockTransaction();
      const transfer = createMockTransfer({
        status: 'completed',
        buyerGithubUsername: null,
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(transfer);

      const result = await service.transferOwnership('txn-123');

      expect(result.success).toBe(false);
      expect((result as any).skipped).toBe(true);
      expect(mockGitHubService.transferOwnership).not.toHaveBeenCalled();
    });

    it('should skip when retry count exceeds 3 without calling GitHub API', async () => {
      const transaction = createMockTransaction();
      const transfer = createMockTransfer({
        status: 'failed',
        buyerGithubUsername: 'buyer-gh',
        retryCount: 4,
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(transfer);

      const result = await service.transferOwnership('txn-123');

      expect(result.success).toBe(false);
      expect((result as any).skipped).toBe(true);
      expect(mockGitHubService.transferOwnership).not.toHaveBeenCalled();
      expect(mockRepositoryTransferRepository.incrementRetryCount).not.toHaveBeenCalled();
    });

    it('should skip when concurrency guard fails (already claimed by another worker)', async () => {
      const transaction = createMockTransaction();
      const transfer = createMockTransfer({
        status: 'completed',
        buyerGithubUsername: 'buyer-gh',
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(transfer);
      (
        mockTransactionRepository.claimForTransferProcessing as ReturnType<typeof vi.fn>
      ).mockResolvedValue(0);

      const result = await service.transferOwnership('txn-123');

      expect(result.success).toBe(false);
      expect((result as any).skipped).toBe(true);
      expect(mockGitHubService.transferOwnership).not.toHaveBeenCalled();
    });

    it('should NOT release escrow for early transfer when review period has not ended', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const transaction = createMockTransaction({ escrowReleaseDate: futureDate });
      const transfer = createMockTransfer({
        status: 'completed',
        buyerGithubUsername: 'buyer-gh',
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(transfer);
      (
        mockTransactionRepository.claimForTransferProcessing as ReturnType<typeof vi.fn>
      ).mockResolvedValue(1);
      (mockGitHubService.transferOwnership as ReturnType<typeof vi.fn>).mockResolvedValue(
        { success: true }
      );
      (
        mockRepositoryTransferRepository.updateStatus as ReturnType<typeof vi.fn>
      ).mockResolvedValue(createMockTransfer({ status: 'transfer_initiated' }));

      const result = await service.transferOwnership('txn-123');

      expect(result.success).toBe(true);
      expect(mockGitHubService.transferOwnership).toHaveBeenCalled();
      expect(mockTransactionRepository.releaseEscrow).not.toHaveBeenCalled();
      expect(mockTransactionRepository.updateEscrowStatus).toHaveBeenCalledWith(
        'txn-123',
        'held'
      );
    });

    it('should increment retry count on retryable GitHub API failure', async () => {
      const pastDate = new Date('2026-02-01T00:00:00Z');
      const transaction = createMockTransaction({ escrowReleaseDate: pastDate });
      const transfer = createMockTransfer({
        status: 'completed',
        buyerGithubUsername: 'buyer-gh',
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(transfer);
      (
        mockTransactionRepository.claimForTransferProcessing as ReturnType<typeof vi.fn>
      ).mockResolvedValue(1);
      (mockGitHubService.transferOwnership as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('GitHub API error')
      );
      (
        mockRepositoryTransferRepository.updateStatus as ReturnType<typeof vi.fn>
      ).mockResolvedValue(createMockTransfer({ status: 'failed' }));
      (
        mockRepositoryTransferRepository.incrementRetryCount as ReturnType<typeof vi.fn>
      ).mockResolvedValue(createMockTransfer({ retryCount: 1 }));

      const result = await service.transferOwnership('txn-123');

      expect(result.success).toBe(false);
      expect(mockRepositoryTransferRepository.incrementRetryCount).toHaveBeenCalledWith(
        'transfer-123'
      );
      expect(mockRepositoryTransferRepository.updateStatus).toHaveBeenCalledWith(
        'transfer-123',
        'failed',
        expect.objectContaining({
          errorMessage: 'GitHub API error',
          failedAt: expect.any(Date),
        })
      );
      expect(mockTransactionRepository.updateEscrowStatus).toHaveBeenCalledWith(
        'txn-123',
        'held'
      );
    });

    it('should not increment retry count on 401 (token expired, non-retryable) and flag admin', async () => {
      const pastDate = new Date('2026-02-01T00:00:00Z');
      const transaction = createMockTransaction({ escrowReleaseDate: pastDate });
      const transfer = createMockTransfer({
        status: 'completed',
        buyerGithubUsername: 'buyer-gh',
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(transfer);
      (
        mockTransactionRepository.claimForTransferProcessing as ReturnType<typeof vi.fn>
      ).mockResolvedValue(1);
      (mockGitHubService.transferOwnership as ReturnType<typeof vi.fn>).mockRejectedValue(
        new GitHubServiceError('Token expired or revoked', 401)
      );
      (
        mockRepositoryTransferRepository.updateStatus as ReturnType<typeof vi.fn>
      ).mockResolvedValue(createMockTransfer({ status: 'failed' }));

      const consoleErrorSpy = vi.spyOn(console, 'error');

      const result = await service.transferOwnership('txn-123');

      expect(result.success).toBe(false);
      expect(mockRepositoryTransferRepository.incrementRetryCount).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ADMIN_ACTION_REQUIRED]')
      );
      expect(mockRepositoryTransferRepository.updateStatus).toHaveBeenCalledWith(
        'transfer-123',
        'failed',
        expect.objectContaining({
          errorMessage: expect.stringContaining('Token expired'),
        })
      );
      expect(mockTransactionRepository.updateEscrowStatus).toHaveBeenCalledWith(
        'txn-123',
        'held'
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('processAutoTransfers', () => {
    const buildEligibleTxn = (
      transferOverrides: Record<string, unknown> = {},
      txnOverrides: Record<string, unknown> = {}
    ) => ({
      id: 'txn-123',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      escrowReleaseDate: new Date('2026-02-01T00:00:00Z'),
      repositoryTransfer: {
        id: 'transfer-123',
        status: 'invitation_sent',
        buyerGithubUsername: 'buyer-gh',
        retryCount: 0,
        ...transferOverrides,
      },
      ...txnOverrides,
    });

    it('should call findTransactionsForAutoTransfer with current date', async () => {
      (
        mockTransactionRepository.findTransactionsForAutoTransfer as ReturnType<
          typeof vi.fn
        >
      ).mockResolvedValue([]);

      await service.processAutoTransfers();

      expect(
        mockTransactionRepository.findTransactionsForAutoTransfer
      ).toHaveBeenCalledWith(expect.any(Date));
    });

    it('should process eligible transactions and return processed count', async () => {
      (
        mockTransactionRepository.findTransactionsForAutoTransfer as ReturnType<
          typeof vi.fn
        >
      ).mockResolvedValue([buildEligibleTxn()]);

      const pastDate = new Date('2026-02-01T00:00:00Z');
      const transaction = createMockTransaction({ escrowReleaseDate: pastDate });
      const transfer = createMockTransfer({
        status: 'invitation_sent',
        buyerGithubUsername: 'buyer-gh',
      });

      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(transfer);
      (
        mockTransactionRepository.claimForTransferProcessing as ReturnType<typeof vi.fn>
      ).mockResolvedValue(1);
      (mockGitHubService.transferOwnership as ReturnType<typeof vi.fn>).mockResolvedValue(
        { success: true }
      );
      (
        mockRepositoryTransferRepository.updateStatus as ReturnType<typeof vi.fn>
      ).mockResolvedValue(createMockTransfer({ status: 'transfer_initiated' }));

      const result = await service.processAutoTransfers();

      expect(result).toEqual({ processed: 1 });
      expect(mockGitHubService.transferOwnership).toHaveBeenCalledTimes(1);
    });

    it('should skip pending transfers without incrementing retry count', async () => {
      (
        mockTransactionRepository.findTransactionsForAutoTransfer as ReturnType<
          typeof vi.fn
        >
      ).mockResolvedValue([
        buildEligibleTxn({ status: 'pending', buyerGithubUsername: null }),
      ]);

      const result = await service.processAutoTransfers();

      expect(result).toEqual({ processed: 0 });
      expect(mockRepositoryTransferRepository.incrementRetryCount).not.toHaveBeenCalled();
      expect(mockGitHubService.transferOwnership).not.toHaveBeenCalled();
    });

    it('should apply 14-day fallback when retries exhausted and 14+ days old', async () => {
      const veryOldDate = new Date();
      veryOldDate.setDate(veryOldDate.getDate() - 15);

      (
        mockTransactionRepository.findTransactionsForAutoTransfer as ReturnType<
          typeof vi.fn
        >
      ).mockResolvedValue([
        buildEligibleTxn({ status: 'failed', retryCount: 4 }, { createdAt: veryOldDate }),
      ]);

      const result = await service.processAutoTransfers();

      expect(result).toEqual({ processed: 1 });
      expect(mockTransactionRepository.releaseEscrow).toHaveBeenCalledWith('txn-123');
      expect(mockGitHubService.transferOwnership).not.toHaveBeenCalled();
    });

    it('should not apply 14-day fallback when retries exhausted but within 14 days', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 5);

      (
        mockTransactionRepository.findTransactionsForAutoTransfer as ReturnType<
          typeof vi.fn
        >
      ).mockResolvedValue([
        buildEligibleTxn({ status: 'failed', retryCount: 4 }, { createdAt: recentDate }),
      ]);

      const result = await service.processAutoTransfers();

      expect(result).toEqual({ processed: 0 });
      expect(mockTransactionRepository.releaseEscrow).not.toHaveBeenCalled();
      expect(mockGitHubService.transferOwnership).not.toHaveBeenCalled();
    });
  });
});
