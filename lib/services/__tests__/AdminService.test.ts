/**
 * AdminService Tests
 *
 * Comprehensive test suite for AdminService business logic.
 *
 * Test Coverage:
 * - banUser() - validation, audit logging, email notifications
 * - unbanUser() - validation, audit logging, email notifications
 * - approveProject() - validation, audit logging
 * - rejectProject() - validation, audit logging
 * - toggleProjectFeatured() - validation, audit logging
 * - resolveContentReport() - validation, audit logging
 * - releaseEscrowManually() - validation, audit logging
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AdminService,
  AdminValidationError,
  AdminAuthorizationError,
} from '../AdminService';
import type { AdminRepository } from '@/lib/repositories/AdminRepository';
import type { UserRepository } from '@/lib/repositories/UserRepository';
import type { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import type { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import type { EmailService } from '@/lib/services/EmailService';
import type { StripeService } from '@/lib/services/StripeService';
import type { User, Project, Transaction } from '@prisma/client';

const mockAdminRepo = {
  getPlatformStats: vi.fn(),
  createAuditLog: vi.fn(),
  getAuditLogs: vi.fn(),
  getContentReports: vi.fn(),
  updateContentReport: vi.fn(),
  getEscrowAnalytics: vi.fn(),
} as unknown as AdminRepository;

const mockUserRepo = {
  findById: vi.fn(),
  banUser: vi.fn(),
  unbanUser: vi.fn(),
  getAllUsers: vi.fn(),
} as unknown as UserRepository;

const mockProjectRepo = {
  findById: vi.fn(),
  approveProject: vi.fn(),
  rejectProject: vi.fn(),
  toggleFeatured: vi.fn(),
  getAllProjects: vi.fn(),
} as unknown as ProjectRepository;

const mockTransactionRepo = {
  releaseEscrowManually: vi.fn(),
  getAllTransactions: vi.fn(),
  findById: vi.fn(),
  markRefunded: vi.fn(),
} as unknown as TransactionRepository;

const mockEmailService = {
  sendUserBannedNotification: vi.fn(),
  sendUserUnbannedNotification: vi.fn(),
  sendRefundNotification: vi.fn(),
} as unknown as EmailService;

const mockStripeService = {
  refundPayment: vi.fn(),
} as unknown as StripeService;

describe('AdminService', () => {
  let adminService: AdminService;

  beforeEach(() => {
    vi.clearAllMocks();

    adminService = new AdminService(
      mockAdminRepo,
      mockUserRepo,
      mockProjectRepo,
      mockTransactionRepo,
      mockEmailService,
      mockStripeService
    );
  });

  describe('banUser()', () => {
    const adminId = 'admin123';
    const userId = 'user456';
    const reason = 'Repeated spam violations after multiple warnings';
    const ipAddress = '192.168.1.1';

    const mockUser: Partial<User> = {
      id: userId,
      email: 'user@test.com',
      username: 'testuser',
      fullName: 'Test User',
      isBanned: false,
      isAdmin: false,
      isSeller: true,
    };

    const mockBannedUser: Partial<User> = {
      ...mockUser,
      isBanned: true,
      bannedAt: new Date(),
      bannedBy: adminId,
      bannedReason: reason,
    };

    it('should ban user with audit log and email notification', async () => {
      (mockUserRepo.findById as any).mockResolvedValue(mockUser);
      (mockUserRepo.banUser as any).mockResolvedValue(mockBannedUser);
      (mockAdminRepo.createAuditLog as any).mockResolvedValue({});
      (mockEmailService.sendUserBannedNotification as any).mockResolvedValue(undefined);

      const result = await adminService.banUser(adminId, userId, reason, ipAddress);

      expect(result).toEqual(mockBannedUser);
      expect(mockUserRepo.findById).toHaveBeenCalledWith(userId);
      expect(mockUserRepo.banUser).toHaveBeenCalledWith(userId, adminId, reason);
      expect(mockAdminRepo.createAuditLog).toHaveBeenCalledWith({
        adminId,
        action: 'user.ban',
        targetType: 'user',
        targetId: userId,
        reason,
        metadata: {
          username: mockUser.username,
          email: mockUser.email,
          isSeller: mockUser.isSeller,
        },
        ipAddress,
      });
      expect(mockEmailService.sendUserBannedNotification).toHaveBeenCalled();
    });

    it('should throw error if reason is too short', async () => {
      await expect(
        adminService.banUser(adminId, userId, 'short', ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.banUser(adminId, userId, 'short', ipAddress)
      ).rejects.toThrow('Ban reason must be at least 10 characters');
    });

    it('should throw error if trying to ban yourself', async () => {
      await expect(
        adminService.banUser(adminId, adminId, reason, ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.banUser(adminId, adminId, reason, ipAddress)
      ).rejects.toThrow('Cannot ban yourself');
    });

    it('should throw error if user not found', async () => {
      (mockUserRepo.findById as any).mockResolvedValue(null);

      await expect(
        adminService.banUser(adminId, userId, reason, ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.banUser(adminId, userId, reason, ipAddress)
      ).rejects.toThrow('User not found');
    });

    it('should throw error if user already banned', async () => {
      (mockUserRepo.findById as any).mockResolvedValue({
        ...mockUser,
        isBanned: true,
      });

      await expect(
        adminService.banUser(adminId, userId, reason, ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.banUser(adminId, userId, reason, ipAddress)
      ).rejects.toThrow('User is already banned');
    });

    it('should throw error if trying to ban admin user', async () => {
      (mockUserRepo.findById as any).mockResolvedValue({
        ...mockUser,
        isAdmin: true,
      });

      await expect(
        adminService.banUser(adminId, userId, reason, ipAddress)
      ).rejects.toThrow(AdminAuthorizationError);
      await expect(
        adminService.banUser(adminId, userId, reason, ipAddress)
      ).rejects.toThrow('Cannot ban admin users');
    });

    it('should succeed even if email notification fails', async () => {
      (mockUserRepo.findById as any).mockResolvedValue(mockUser);
      (mockUserRepo.banUser as any).mockResolvedValue(mockBannedUser);
      (mockAdminRepo.createAuditLog as any).mockResolvedValue({});
      (mockEmailService.sendUserBannedNotification as any).mockRejectedValue(
        new Error('Email service down')
      );

      const result = await adminService.banUser(adminId, userId, reason, ipAddress);

      expect(result).toEqual(mockBannedUser);
    });
  });

  describe('unbanUser()', () => {
    const adminId = 'admin123';
    const userId = 'user456';
    const ipAddress = '192.168.1.1';

    const mockBannedUser: Partial<User> = {
      id: userId,
      email: 'user@test.com',
      username: 'testuser',
      fullName: 'Test User',
      isBanned: true,
      bannedAt: new Date(),
      bannedReason: 'Spam',
      bannedBy: 'admin789',
    };

    const mockUnbannedUser: Partial<User> = {
      ...mockBannedUser,
      isBanned: false,
      bannedAt: null,
      bannedReason: null,
      bannedBy: null,
    };

    it('should unban user with audit log and email notification', async () => {
      (mockUserRepo.findById as any).mockResolvedValue(mockBannedUser);
      (mockUserRepo.unbanUser as any).mockResolvedValue(mockUnbannedUser);
      (mockAdminRepo.createAuditLog as any).mockResolvedValue({});
      (mockEmailService.sendUserUnbannedNotification as any).mockResolvedValue(undefined);

      const result = await adminService.unbanUser(adminId, userId, ipAddress);

      expect(result).toEqual(mockUnbannedUser);
      expect(mockUserRepo.findById).toHaveBeenCalledWith(userId);
      expect(mockUserRepo.unbanUser).toHaveBeenCalledWith(userId);
      expect(mockAdminRepo.createAuditLog).toHaveBeenCalledWith({
        adminId,
        action: 'user.unban',
        targetType: 'user',
        targetId: userId,
        metadata: {
          username: mockBannedUser.username,
          email: mockBannedUser.email,
          previousBanReason: mockBannedUser.bannedReason,
          bannedBy: mockBannedUser.bannedBy,
        },
        ipAddress,
      });
      expect(mockEmailService.sendUserUnbannedNotification).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      (mockUserRepo.findById as any).mockResolvedValue(null);

      await expect(adminService.unbanUser(adminId, userId, ipAddress)).rejects.toThrow(
        AdminValidationError
      );
      await expect(adminService.unbanUser(adminId, userId, ipAddress)).rejects.toThrow(
        'User not found'
      );
    });

    it('should throw error if user not currently banned', async () => {
      (mockUserRepo.findById as any).mockResolvedValue({
        ...mockBannedUser,
        isBanned: false,
      });

      await expect(adminService.unbanUser(adminId, userId, ipAddress)).rejects.toThrow(
        AdminValidationError
      );
      await expect(adminService.unbanUser(adminId, userId, ipAddress)).rejects.toThrow(
        'User is not currently banned'
      );
    });

    it('should succeed even if email notification fails', async () => {
      (mockUserRepo.findById as any).mockResolvedValue(mockBannedUser);
      (mockUserRepo.unbanUser as any).mockResolvedValue(mockUnbannedUser);
      (mockAdminRepo.createAuditLog as any).mockResolvedValue({});
      (mockEmailService.sendUserUnbannedNotification as any).mockRejectedValue(
        new Error('Email service down')
      );

      const result = await adminService.unbanUser(adminId, userId, ipAddress);

      expect(result).toEqual(mockUnbannedUser);
    });
  });

  describe('approveProject()', () => {
    const adminId = 'admin123';
    const projectId = 'proj456';
    const ipAddress = '192.168.1.1';

    const mockProject: Partial<Project> = {
      id: projectId,
      title: 'Test Project',
      sellerId: 'seller789',
      status: 'draft',
    };

    const mockApprovedProject: Partial<Project> = {
      ...mockProject,
      status: 'active',
      approvedBy: adminId,
      approvedAt: new Date(),
    };

    it('should approve project with audit log', async () => {
      (mockProjectRepo.findById as any).mockResolvedValue(mockProject);
      (mockProjectRepo.approveProject as any).mockResolvedValue(mockApprovedProject);
      (mockAdminRepo.createAuditLog as any).mockResolvedValue({});

      const result = await adminService.approveProject(adminId, projectId, ipAddress);

      expect(result).toEqual(mockApprovedProject);
      expect(mockProjectRepo.findById).toHaveBeenCalledWith(projectId, true);
      expect(mockProjectRepo.approveProject).toHaveBeenCalledWith(projectId, adminId);
      expect(mockAdminRepo.createAuditLog).toHaveBeenCalledWith({
        adminId,
        action: 'project.approve',
        targetType: 'project',
        targetId: projectId,
        metadata: {
          title: mockProject.title,
          sellerId: mockProject.sellerId,
          previousStatus: mockProject.status,
        },
        ipAddress,
      });
    });

    it('should throw error if project not found', async () => {
      (mockProjectRepo.findById as any).mockResolvedValue(null);

      await expect(
        adminService.approveProject(adminId, projectId, ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.approveProject(adminId, projectId, ipAddress)
      ).rejects.toThrow('Project not found');
    });

    it('should throw error if project already active', async () => {
      (mockProjectRepo.findById as any).mockResolvedValue({
        ...mockProject,
        status: 'active',
      });

      await expect(
        adminService.approveProject(adminId, projectId, ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.approveProject(adminId, projectId, ipAddress)
      ).rejects.toThrow('Project is already active');
    });
  });

  describe('rejectProject()', () => {
    const adminId = 'admin123';
    const projectId = 'proj456';
    const reason = 'Violates content policy - contains malicious code';
    const ipAddress = '192.168.1.1';

    const mockProject: Partial<Project> = {
      id: projectId,
      title: 'Test Project',
      sellerId: 'seller789',
      status: 'active',
    };

    it('should reject project with audit log', async () => {
      (mockProjectRepo.findById as any).mockResolvedValue(mockProject);
      (mockProjectRepo.rejectProject as any).mockResolvedValue({
        ...mockProject,
        status: 'draft',
      });
      (mockAdminRepo.createAuditLog as any).mockResolvedValue({});

      await adminService.rejectProject(adminId, projectId, reason, ipAddress);

      expect(mockProjectRepo.rejectProject).toHaveBeenCalledWith(projectId, reason);
      expect(mockAdminRepo.createAuditLog).toHaveBeenCalledWith({
        adminId,
        action: 'project.reject',
        targetType: 'project',
        targetId: projectId,
        reason,
        metadata: expect.objectContaining({
          title: mockProject.title,
          sellerId: mockProject.sellerId,
        }),
        ipAddress,
      });
    });

    it('should throw error if reason too short', async () => {
      await expect(
        adminService.rejectProject(adminId, projectId, 'short', ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.rejectProject(adminId, projectId, 'short', ipAddress)
      ).rejects.toThrow('Rejection reason must be at least 10 characters');
    });

    it('should throw error if project not found', async () => {
      (mockProjectRepo.findById as any).mockResolvedValue(null);

      await expect(
        adminService.rejectProject(adminId, projectId, reason, ipAddress)
      ).rejects.toThrow(AdminValidationError);
    });
  });

  describe('toggleProjectFeatured()', () => {
    const adminId = 'admin123';
    const projectId = 'proj456';
    const ipAddress = '192.168.1.1';

    const mockActiveProject: Partial<Project> = {
      id: projectId,
      title: 'Test Project',
      sellerId: 'seller789',
      status: 'active',
      isFeatured: false,
    };

    it('should feature active project with audit log', async () => {
      (mockProjectRepo.findById as any).mockResolvedValue(mockActiveProject);
      (mockProjectRepo.toggleFeatured as any).mockResolvedValue({
        ...mockActiveProject,
        isFeatured: true,
      });
      (mockAdminRepo.createAuditLog as any).mockResolvedValue({});

      await adminService.toggleProjectFeatured(adminId, projectId, true, 30, ipAddress);

      expect(mockProjectRepo.toggleFeatured).toHaveBeenCalledWith(
        projectId,
        true,
        adminId,
        30
      );
      expect(mockAdminRepo.createAuditLog).toHaveBeenCalled();
    });

    it('should throw error if trying to feature non-active project', async () => {
      (mockProjectRepo.findById as any).mockResolvedValue({
        ...mockActiveProject,
        status: 'draft',
      });

      await expect(
        adminService.toggleProjectFeatured(adminId, projectId, true, 30, ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.toggleProjectFeatured(adminId, projectId, true, 30, ipAddress)
      ).rejects.toThrow('Can only feature active projects');
    });

    it('should throw error if featured days is negative', async () => {
      (mockProjectRepo.findById as any).mockResolvedValue(mockActiveProject);

      await expect(
        adminService.toggleProjectFeatured(adminId, projectId, true, -5, ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.toggleProjectFeatured(adminId, projectId, true, 0, ipAddress)
      ).rejects.toThrow('Featured days must be positive');
    });
  });

  describe('releaseEscrowManually()', () => {
    const adminId = 'admin123';
    const transactionId = 'tx456';
    const reason = 'Resolved dispute in favor of seller after investigation';
    const ipAddress = '192.168.1.1';

    const mockTransaction: Partial<Transaction> = {
      id: transactionId,
      amountCents: 50000,
      sellerId: 'seller789',
      buyerId: 'buyer123',
      projectId: 'proj456',
      escrowStatus: 'held',
    };

    it('should release escrow manually with audit log', async () => {
      (mockTransactionRepo.releaseEscrowManually as any).mockResolvedValue({
        ...mockTransaction,
        escrowStatus: 'released',
      });
      (mockAdminRepo.createAuditLog as any).mockResolvedValue({});

      await adminService.releaseEscrowManually(adminId, transactionId, reason, ipAddress);

      expect(mockTransactionRepo.releaseEscrowManually).toHaveBeenCalledWith(
        transactionId
      );
      expect(mockAdminRepo.createAuditLog).toHaveBeenCalledWith({
        adminId,
        action: 'transaction.escrow_release',
        targetType: 'transaction',
        targetId: transactionId,
        reason,
        metadata: expect.objectContaining({
          amountCents: mockTransaction.amountCents,
          sellerId: mockTransaction.sellerId,
          buyerId: mockTransaction.buyerId,
        }),
        ipAddress,
      });
    });

    it('should throw error if reason too short', async () => {
      await expect(
        adminService.releaseEscrowManually(adminId, transactionId, 'short', ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.releaseEscrowManually(adminId, transactionId, 'short', ipAddress)
      ).rejects.toThrow('Release reason must be at least 10 characters');
    });
  });

  describe('refundTransaction()', () => {
    const adminId = 'admin123';
    const transactionId = 'txn789';
    const reason = 'Buyer never received access, seller unresponsive';
    const ipAddress = '192.168.1.1';

    const mockTransaction: Partial<Transaction> = {
      id: transactionId,
      amountCents: 50000,
      sellerId: 'seller789',
      buyerId: 'buyer123',
      projectId: 'proj456',
      paymentStatus: 'succeeded',
      escrowStatus: 'held',
      stripePaymentIntentId: 'pi_test_12345',
      codeDeliveryStatus: 'pending',
      githubAccessGrantedAt: null,
    };

    it('should refund transaction with audit log and buyer email', async () => {
      (mockTransactionRepo.findById as any).mockResolvedValue({
        ...mockTransaction,
        buyer: {
          id: 'buyer123',
          email: 'buyer@test.com',
          username: 'buyeruser',
          fullName: 'Buyer User',
          githubUsername: null,
          avatarUrl: null,
        },
        project: {
          id: 'proj456',
          title: 'Test Project',
          description: '',
          priceCents: 50000,
          status: 'sold',
          thumbnailImageUrl: null,
          githubUrl: null,
          githubRepoName: null,
        },
      });
      (mockStripeService.refundPayment as any).mockResolvedValue({ id: 'ref_test_123' });
      (mockTransactionRepo.markRefunded as any).mockResolvedValue({
        ...mockTransaction,
        paymentStatus: 'refunded',
        escrowStatus: 'released',
      });
      (mockAdminRepo.createAuditLog as any).mockResolvedValue({});
      (mockEmailService.sendRefundNotification as any).mockResolvedValue(undefined);

      const result = await adminService.refundTransaction(
        adminId,
        transactionId,
        reason,
        ipAddress
      );

      expect(mockTransactionRepo.findById).toHaveBeenCalledWith(transactionId);
      expect(mockStripeService.refundPayment).toHaveBeenCalledWith(
        mockTransaction.stripePaymentIntentId,
        reason
      );
      expect(mockTransactionRepo.markRefunded).toHaveBeenCalledWith(transactionId);
      expect(mockAdminRepo.createAuditLog).toHaveBeenCalledWith({
        adminId,
        action: 'transaction.refund',
        targetType: 'transaction',
        targetId: transactionId,
        reason,
        metadata: expect.objectContaining({
          amountCents: mockTransaction.amountCents,
          sellerId: mockTransaction.sellerId,
          buyerId: mockTransaction.buyerId,
          stripePaymentIntentId: mockTransaction.stripePaymentIntentId,
        }),
        ipAddress,
      });
      expect(mockEmailService.sendRefundNotification).toHaveBeenCalled();
      expect(result.transaction.paymentStatus).toBe('refunded');
      expect(result.transaction.escrowStatus).toBe('released');
    });

    it('should throw AdminValidationError if reason is too short', async () => {
      await expect(
        adminService.refundTransaction(adminId, transactionId, 'too short', ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.refundTransaction(adminId, transactionId, 'too short', ipAddress)
      ).rejects.toThrow('Refund reason must be at least 10 characters');
    });

    it('should throw AdminValidationError if transaction not found', async () => {
      (mockTransactionRepo.findById as any).mockResolvedValue(null);

      await expect(
        adminService.refundTransaction(adminId, transactionId, reason, ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.refundTransaction(adminId, transactionId, reason, ipAddress)
      ).rejects.toThrow('Transaction not found');
    });

    it('should throw AdminValidationError if payment status is not succeeded', async () => {
      (mockTransactionRepo.findById as any).mockResolvedValue({
        ...mockTransaction,
        paymentStatus: 'refunded',
      });

      await expect(
        adminService.refundTransaction(adminId, transactionId, reason, ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.refundTransaction(adminId, transactionId, reason, ipAddress)
      ).rejects.toThrow('Transaction payment status must be succeeded to refund');
    });

    it('should throw AdminValidationError if escrow already released', async () => {
      (mockTransactionRepo.findById as any).mockResolvedValue({
        ...mockTransaction,
        escrowStatus: 'released',
      });

      await expect(
        adminService.refundTransaction(adminId, transactionId, reason, ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.refundTransaction(adminId, transactionId, reason, ipAddress)
      ).rejects.toThrow('Transaction escrow has already been released');
    });

    it('should throw AdminValidationError if no stripePaymentIntentId', async () => {
      (mockTransactionRepo.findById as any).mockResolvedValue({
        ...mockTransaction,
        stripePaymentIntentId: null,
      });

      await expect(
        adminService.refundTransaction(adminId, transactionId, reason, ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.refundTransaction(adminId, transactionId, reason, ipAddress)
      ).rejects.toThrow('Transaction has no Stripe payment intent ID');
    });

    it('should include warning if buyer already received code access', async () => {
      (mockTransactionRepo.findById as any).mockResolvedValue({
        ...mockTransaction,
        codeDeliveryStatus: 'accessed',
      });
      (mockStripeService.refundPayment as any).mockResolvedValue({ id: 'ref_test_123' });
      (mockTransactionRepo.markRefunded as any).mockResolvedValue({
        ...mockTransaction,
        paymentStatus: 'refunded',
        escrowStatus: 'released',
      });
      (mockAdminRepo.createAuditLog as any).mockResolvedValue({});
      (mockEmailService.sendRefundNotification as any).mockResolvedValue(undefined);

      const result = await adminService.refundTransaction(
        adminId,
        transactionId,
        reason,
        ipAddress
      );

      expect(result.warning).toBe('Buyer has already received code access');
    });

    it('should proceed with refund even if email notification fails', async () => {
      (mockTransactionRepo.findById as any).mockResolvedValue(mockTransaction);
      (mockStripeService.refundPayment as any).mockResolvedValue({ id: 'ref_test_123' });
      (mockTransactionRepo.markRefunded as any).mockResolvedValue({
        ...mockTransaction,
        paymentStatus: 'refunded',
        escrowStatus: 'released',
      });
      (mockAdminRepo.createAuditLog as any).mockResolvedValue({});
      (mockEmailService.sendRefundNotification as any).mockRejectedValue(
        new Error('Email service down')
      );

      const result = await adminService.refundTransaction(
        adminId,
        transactionId,
        reason,
        ipAddress
      );

      expect(result.transaction.paymentStatus).toBe('refunded');
    });

    it('should not update DB status when Stripe refund fails', async () => {
      (mockTransactionRepo.findById as any).mockResolvedValue(mockTransaction);
      (mockStripeService.refundPayment as any).mockRejectedValue(
        new Error('Stripe refund failed')
      );

      await expect(
        adminService.refundTransaction(adminId, transactionId, reason, ipAddress)
      ).rejects.toThrow('Stripe refund failed');

      expect(mockTransactionRepo.markRefunded).not.toHaveBeenCalled();
      expect(mockAdminRepo.createAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('getEscrowAnalytics()', () => {
    const mockEscrowAnalytics = {
      totalHeldCents: 150000,
      totalHeldCount: 3,
      totalReleasedCount: 10,
      totalPendingCount: 1,
      totalDisputedCount: 0,
      overdueCount: 1,
      overdueAmountCents: 50000,
    };

    it('should return escrow analytics from repository', async () => {
      (mockAdminRepo.getEscrowAnalytics as any).mockResolvedValue(mockEscrowAnalytics);

      const result = await adminService.getEscrowAnalytics();

      expect(result).toEqual(mockEscrowAnalytics);
      expect(mockAdminRepo.getEscrowAnalytics).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from repository', async () => {
      (mockAdminRepo.getEscrowAnalytics as any).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(adminService.getEscrowAnalytics()).rejects.toThrow(
        'Database connection failed'
      );
    });
  });
});
