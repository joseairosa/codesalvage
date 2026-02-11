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
import type { RepositoryTransferRepository } from '@/lib/repositories/RepositoryTransferRepository';
import type { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import type { GitHubService } from '../GitHubService';
import type { NotificationService } from '../NotificationService';

// Mock encryption module
vi.mock('@/lib/encryption', () => ({
  decrypt: vi.fn().mockReturnValue('decrypted-token'),
}));

// ---------- Mock repositories and services ----------

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
} as unknown as TransactionRepository;

const mockGitHubService = {
  parseGitHubUrl: vi.fn().mockReturnValue({ owner: 'test-owner', repo: 'test-repo' }),
  addCollaborator: vi
    .fn()
    .mockResolvedValue({ invitationId: 'inv-123', alreadyCollaborator: false }),
} as unknown as GitHubService;

const mockNotificationService = {
  createNotification: vi.fn().mockResolvedValue({}),
} as unknown as NotificationService;

// ---------- Mock data factories ----------

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
  createdAt: new Date('2026-02-11T00:00:00Z'),
  updatedAt: new Date('2026-02-11T00:00:00Z'),
  ...overrides,
});

// ---------- Tests ----------

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
  // ---------- initiateTransfer ----------

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
      // Should NOT have buyerGithubUsername set
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

  // ---------- setBuyerGithubUsername ----------

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

    it('should throw NotFoundError when transfer not found', async () => {
      const transaction = createMockTransaction();
      (mockTransactionRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        transaction
      );
      (
        mockRepositoryTransferRepository.findByTransactionId as ReturnType<typeof vi.fn>
      ).mockResolvedValue(null);

      await expect(
        service.setBuyerGithubUsername('buyer-123', 'txn-123', 'username')
      ).rejects.toThrow(RepositoryTransferNotFoundError);
    });
  });

  // ---------- confirmTransfer ----------

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

  // ---------- getTimelineData ----------

  describe('getTimelineData', () => {
    it('should return 5 stages for completed transaction', async () => {
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

      expect(stages).toHaveLength(5);
      expect(stages[0]!.name).toBe('Offer Accepted');
      expect(stages[0]!.status).toBe('completed');
      expect(stages[1]!.name).toBe('Payment Received');
      expect(stages[1]!.status).toBe('completed');
      expect(stages[2]!.name).toBe('Repository Transfer');
      expect(stages[2]!.status).toBe('completed');
      expect(stages[3]!.name).toBe('Review Period');
      expect(stages[4]!.name).toBe('Escrow Released');
      expect(stages[4]!.status).toBe('completed');
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

      expect(stages[2]!.name).toBe('Repository Transfer');
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

      expect(stages[2]!.name).toBe('Repository Transfer');
      expect(stages[2]!.status).toBe('active');
      expect(stages[2]!.actions).toHaveLength(1);
      expect(stages[2]!.actions[0]).toEqual({
        label: 'Transfer Repository',
        type: 'primary',
        apiEndpoint: '/api/transactions/txn-123/repository-transfer',
        apiMethod: 'POST',
      });
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

      expect(stages[2]!.name).toBe('Repository Transfer');
      expect(stages[2]!.status).toBe('active');
      expect(stages[2]!.actions).toHaveLength(1);
      expect(stages[2]!.actions[0]).toEqual({
        label: 'Confirm Access',
        type: 'primary',
        apiEndpoint: '/api/transactions/txn-123/confirm-transfer',
        apiMethod: 'POST',
      });
    });

    it('should show active review period with days remaining', async () => {
      // Set escrow release date to future so review period is active
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

      expect(stages[3]!.name).toBe('Review Period');
      expect(stages[3]!.status).toBe('active');
      expect(stages[3]!.description).toBe('Review period is active');
      expect(stages[3]!.metadata).toBeDefined();
      expect(stages[3]!.metadata!['daysRemaining']).toBeGreaterThan(0);
      // Buyer should have Leave Review action
      expect(stages[3]!.actions).toHaveLength(1);
      expect(stages[3]!.actions[0]).toEqual({
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

      expect(stages[4]!.name).toBe('Escrow Released');
      expect(stages[4]!.status).toBe('completed');
      expect(stages[4]!.completedAt).toEqual(new Date('2026-01-08T00:00:00Z'));
      expect(stages[4]!.description).toBe('Funds have been released to the seller');
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
  });
});
