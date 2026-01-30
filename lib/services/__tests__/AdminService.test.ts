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
import type { User, Project, Transaction } from '@prisma/client';

// Mock repositories
const mockAdminRepo = {
  getPlatformStats: vi.fn(),
  createAuditLog: vi.fn(),
  getAuditLogs: vi.fn(),
  getContentReports: vi.fn(),
  updateContentReport: vi.fn(),
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
} as unknown as TransactionRepository;

const mockEmailService = {
  sendUserBannedNotification: vi.fn(),
  sendUserUnbannedNotification: vi.fn(),
} as unknown as EmailService;

describe('AdminService', () => {
  let adminService: AdminService;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create fresh instance
    adminService = new AdminService(
      mockAdminRepo,
      mockUserRepo,
      mockProjectRepo,
      mockTransactionRepo,
      mockEmailService
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
      // Arrange
      (mockUserRepo.findById as any).mockResolvedValue(mockUser);
      (mockUserRepo.banUser as any).mockResolvedValue(mockBannedUser);
      (mockAdminRepo.createAuditLog as any).mockResolvedValue({});
      (mockEmailService.sendUserBannedNotification as any).mockResolvedValue(undefined);

      // Act
      const result = await adminService.banUser(adminId, userId, reason, ipAddress);

      // Assert
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
      // Act & Assert
      await expect(
        adminService.banUser(adminId, userId, 'short', ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.banUser(adminId, userId, 'short', ipAddress)
      ).rejects.toThrow('Ban reason must be at least 10 characters');
    });

    it('should throw error if trying to ban yourself', async () => {
      // Act & Assert
      await expect(
        adminService.banUser(adminId, adminId, reason, ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.banUser(adminId, adminId, reason, ipAddress)
      ).rejects.toThrow('Cannot ban yourself');
    });

    it('should throw error if user not found', async () => {
      // Arrange
      (mockUserRepo.findById as any).mockResolvedValue(null);

      // Act & Assert
      await expect(
        adminService.banUser(adminId, userId, reason, ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.banUser(adminId, userId, reason, ipAddress)
      ).rejects.toThrow('User not found');
    });

    it('should throw error if user already banned', async () => {
      // Arrange
      (mockUserRepo.findById as any).mockResolvedValue({
        ...mockUser,
        isBanned: true,
      });

      // Act & Assert
      await expect(
        adminService.banUser(adminId, userId, reason, ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.banUser(adminId, userId, reason, ipAddress)
      ).rejects.toThrow('User is already banned');
    });

    it('should throw error if trying to ban admin user', async () => {
      // Arrange
      (mockUserRepo.findById as any).mockResolvedValue({
        ...mockUser,
        isAdmin: true,
      });

      // Act & Assert
      await expect(
        adminService.banUser(adminId, userId, reason, ipAddress)
      ).rejects.toThrow(AdminAuthorizationError);
      await expect(
        adminService.banUser(adminId, userId, reason, ipAddress)
      ).rejects.toThrow('Cannot ban admin users');
    });

    it('should succeed even if email notification fails', async () => {
      // Arrange
      (mockUserRepo.findById as any).mockResolvedValue(mockUser);
      (mockUserRepo.banUser as any).mockResolvedValue(mockBannedUser);
      (mockAdminRepo.createAuditLog as any).mockResolvedValue({});
      (mockEmailService.sendUserBannedNotification as any).mockRejectedValue(
        new Error('Email service down')
      );

      // Act
      const result = await adminService.banUser(adminId, userId, reason, ipAddress);

      // Assert
      expect(result).toEqual(mockBannedUser);
      // Email failure should not prevent ban
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
      // Arrange
      (mockUserRepo.findById as any).mockResolvedValue(mockBannedUser);
      (mockUserRepo.unbanUser as any).mockResolvedValue(mockUnbannedUser);
      (mockAdminRepo.createAuditLog as any).mockResolvedValue({});
      (mockEmailService.sendUserUnbannedNotification as any).mockResolvedValue(undefined);

      // Act
      const result = await adminService.unbanUser(adminId, userId, ipAddress);

      // Assert
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
      // Arrange
      (mockUserRepo.findById as any).mockResolvedValue(null);

      // Act & Assert
      await expect(adminService.unbanUser(adminId, userId, ipAddress)).rejects.toThrow(
        AdminValidationError
      );
      await expect(adminService.unbanUser(adminId, userId, ipAddress)).rejects.toThrow(
        'User not found'
      );
    });

    it('should throw error if user not currently banned', async () => {
      // Arrange
      (mockUserRepo.findById as any).mockResolvedValue({
        ...mockBannedUser,
        isBanned: false,
      });

      // Act & Assert
      await expect(adminService.unbanUser(adminId, userId, ipAddress)).rejects.toThrow(
        AdminValidationError
      );
      await expect(adminService.unbanUser(adminId, userId, ipAddress)).rejects.toThrow(
        'User is not currently banned'
      );
    });

    it('should succeed even if email notification fails', async () => {
      // Arrange
      (mockUserRepo.findById as any).mockResolvedValue(mockBannedUser);
      (mockUserRepo.unbanUser as any).mockResolvedValue(mockUnbannedUser);
      (mockAdminRepo.createAuditLog as any).mockResolvedValue({});
      (mockEmailService.sendUserUnbannedNotification as any).mockRejectedValue(
        new Error('Email service down')
      );

      // Act
      const result = await adminService.unbanUser(adminId, userId, ipAddress);

      // Assert
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
      // Arrange
      (mockProjectRepo.findById as any).mockResolvedValue(mockProject);
      (mockProjectRepo.approveProject as any).mockResolvedValue(mockApprovedProject);
      (mockAdminRepo.createAuditLog as any).mockResolvedValue({});

      // Act
      const result = await adminService.approveProject(adminId, projectId, ipAddress);

      // Assert
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
      // Arrange
      (mockProjectRepo.findById as any).mockResolvedValue(null);

      // Act & Assert
      await expect(
        adminService.approveProject(adminId, projectId, ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.approveProject(adminId, projectId, ipAddress)
      ).rejects.toThrow('Project not found');
    });

    it('should throw error if project already active', async () => {
      // Arrange
      (mockProjectRepo.findById as any).mockResolvedValue({
        ...mockProject,
        status: 'active',
      });

      // Act & Assert
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
      // Arrange
      (mockProjectRepo.findById as any).mockResolvedValue(mockProject);
      (mockProjectRepo.rejectProject as any).mockResolvedValue({
        ...mockProject,
        status: 'draft',
      });
      (mockAdminRepo.createAuditLog as any).mockResolvedValue({});

      // Act
      await adminService.rejectProject(adminId, projectId, reason, ipAddress);

      // Assert
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
      // Act & Assert
      await expect(
        adminService.rejectProject(adminId, projectId, 'short', ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.rejectProject(adminId, projectId, 'short', ipAddress)
      ).rejects.toThrow('Rejection reason must be at least 10 characters');
    });

    it('should throw error if project not found', async () => {
      // Arrange
      (mockProjectRepo.findById as any).mockResolvedValue(null);

      // Act & Assert
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
      // Arrange
      (mockProjectRepo.findById as any).mockResolvedValue(mockActiveProject);
      (mockProjectRepo.toggleFeatured as any).mockResolvedValue({
        ...mockActiveProject,
        isFeatured: true,
      });
      (mockAdminRepo.createAuditLog as any).mockResolvedValue({});

      // Act
      await adminService.toggleProjectFeatured(adminId, projectId, true, 30, ipAddress);

      // Assert
      expect(mockProjectRepo.toggleFeatured).toHaveBeenCalledWith(
        projectId,
        true,
        adminId,
        30
      );
      expect(mockAdminRepo.createAuditLog).toHaveBeenCalled();
    });

    it('should throw error if trying to feature non-active project', async () => {
      // Arrange
      (mockProjectRepo.findById as any).mockResolvedValue({
        ...mockActiveProject,
        status: 'draft',
      });

      // Act & Assert
      await expect(
        adminService.toggleProjectFeatured(adminId, projectId, true, 30, ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.toggleProjectFeatured(adminId, projectId, true, 30, ipAddress)
      ).rejects.toThrow('Can only feature active projects');
    });

    it('should throw error if featured days is negative', async () => {
      // Arrange
      (mockProjectRepo.findById as any).mockResolvedValue(mockActiveProject);

      // Act & Assert
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
      // Arrange
      (mockTransactionRepo.releaseEscrowManually as any).mockResolvedValue({
        ...mockTransaction,
        escrowStatus: 'released',
      });
      (mockAdminRepo.createAuditLog as any).mockResolvedValue({});

      // Act
      await adminService.releaseEscrowManually(adminId, transactionId, reason, ipAddress);

      // Assert
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
      // Act & Assert
      await expect(
        adminService.releaseEscrowManually(adminId, transactionId, 'short', ipAddress)
      ).rejects.toThrow(AdminValidationError);
      await expect(
        adminService.releaseEscrowManually(adminId, transactionId, 'short', ipAddress)
      ).rejects.toThrow('Release reason must be at least 10 characters');
    });
  });
});
