/**
 * AdminRepository Tests
 *
 * Comprehensive test suite for AdminRepository following TDD principles.
 *
 * Test Coverage:
 * - getPlatformStats()
 * - createAuditLog()
 * - getAuditLogs()
 * - getAuditLogsByAdmin()
 * - getAuditLogsByTarget()
 * - createContentReport()
 * - getContentReports()
 * - updateContentReport()
 * - countContentReports()
 * - countAuditLogs()
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { AdminRepository } from '../AdminRepository';
import type { CreateAuditLogInput, CreateContentReportInput } from '../AdminRepository';

// Mock Prisma Client
const mockPrisma = {
  user: {
    count: vi.fn(),
  },
  project: {
    count: vi.fn(),
  },
  transaction: {
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  contentReport: {
    count: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  adminAuditLog: {
    count: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn(),
} as unknown as PrismaClient;

describe('AdminRepository', () => {
  let adminRepo: AdminRepository;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create fresh instance
    adminRepo = new AdminRepository(mockPrisma);
  });

  describe('getPlatformStats()', () => {
    it('should return comprehensive platform statistics', async () => {
      // Arrange
      const mockStats = [
        100, // totalUsers
        25, // totalSellers
        15, // totalVerifiedSellers
        5, // totalBannedUsers
        50, // totalProjects
        40, // totalActiveProjects
        8, // totalSoldProjects
        2, // totalDraftProjects
        20, // totalTransactions
        { _sum: { amountCents: 500000 } }, // revenueAggregation
        3, // totalPendingReports
        10, // totalResolvedReports
        2, // totalDismissedReports
      ];

      (mockPrisma.$transaction as any).mockResolvedValue(mockStats);

      // Act
      const stats = await adminRepo.getPlatformStats();

      // Assert
      expect(stats).toEqual({
        totalUsers: 100,
        totalSellers: 25,
        totalVerifiedSellers: 15,
        totalBannedUsers: 5,
        totalProjects: 50,
        totalActiveProjects: 40,
        totalSoldProjects: 8,
        totalDraftProjects: 2,
        totalTransactions: 20,
        totalRevenueCents: 500000,
        totalPendingReports: 3,
        totalResolvedReports: 10,
        totalDismissedReports: 2,
      });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should handle zero revenue correctly', async () => {
      // Arrange
      const mockStats = [
        10, 5, 3, 0, 5, 4, 1, 0, 0,
        { _sum: { amountCents: null } }, // No revenue
        0, 0, 0,
      ];

      (mockPrisma.$transaction as any).mockResolvedValue(mockStats);

      // Act
      const stats = await adminRepo.getPlatformStats();

      // Assert
      expect(stats.totalRevenueCents).toBe(0);
      expect(stats.totalTransactions).toBe(0);
    });

    it('should throw error if database query fails', async () => {
      // Arrange
      (mockPrisma.$transaction as any).mockRejectedValue(
        new Error('Database connection error')
      );

      // Act & Assert
      await expect(adminRepo.getPlatformStats()).rejects.toThrow(
        'Failed to get platform stats: Database connection error'
      );
    });
  });

  describe('createAuditLog()', () => {
    it('should create an audit log entry', async () => {
      // Arrange
      const input: CreateAuditLogInput = {
        adminId: 'admin123',
        action: 'user.ban',
        targetType: 'user',
        targetId: 'user456',
        reason: 'Spam violation',
        metadata: { previousWarnings: 3 },
        ipAddress: '192.168.1.1',
      };

      const mockAuditLog = {
        id: 'log123',
        ...input,
        createdAt: new Date(),
      };

      (mockPrisma.adminAuditLog.create as any).mockResolvedValue(mockAuditLog);

      // Act
      const result = await adminRepo.createAuditLog(input);

      // Assert
      expect(result).toEqual(mockAuditLog);
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: {
          adminId: input.adminId,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          reason: input.reason,
          metadata: input.metadata,
          ipAddress: input.ipAddress,
        },
      });
    });

    it('should create audit log without optional fields', async () => {
      // Arrange
      const input: CreateAuditLogInput = {
        adminId: 'admin123',
        action: 'project.approve',
        targetType: 'project',
        targetId: 'proj789',
      };

      const mockAuditLog = {
        id: 'log456',
        ...input,
        reason: null,
        metadata: null,
        ipAddress: null,
        createdAt: new Date(),
      };

      (mockPrisma.adminAuditLog.create as any).mockResolvedValue(mockAuditLog);

      // Act
      const result = await adminRepo.createAuditLog(input);

      // Assert
      expect(result).toEqual(mockAuditLog);
    });

    it('should throw error if audit log creation fails', async () => {
      // Arrange
      const input: CreateAuditLogInput = {
        adminId: 'invalid',
        action: 'user.ban',
        targetType: 'user',
        targetId: 'user123',
      };

      (mockPrisma.adminAuditLog.create as any).mockRejectedValue(
        new Error('Foreign key constraint failed')
      );

      // Act & Assert
      await expect(adminRepo.createAuditLog(input)).rejects.toThrow(
        'Failed to create audit log: Foreign key constraint failed'
      );
    });
  });

  describe('getAuditLogs()', () => {
    it('should return audit logs with default pagination', async () => {
      // Arrange
      const mockLogs = [
        {
          id: 'log1',
          adminId: 'admin1',
          action: 'user.ban',
          targetType: 'user',
          targetId: 'user1',
          createdAt: new Date(),
          admin: { id: 'admin1', username: 'admin_user', email: 'admin@test.com' },
        },
        {
          id: 'log2',
          adminId: 'admin1',
          action: 'project.approve',
          targetType: 'project',
          targetId: 'proj1',
          createdAt: new Date(),
          admin: { id: 'admin1', username: 'admin_user', email: 'admin@test.com' },
        },
      ];

      (mockPrisma.adminAuditLog.findMany as any).mockResolvedValue(mockLogs);

      // Act
      const result = await adminRepo.getAuditLogs();

      // Assert
      expect(result).toEqual(mockLogs);
      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith({
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      });
    });

    it('should return audit logs with custom pagination', async () => {
      // Arrange
      const mockLogs = [];
      (mockPrisma.adminAuditLog.findMany as any).mockResolvedValue(mockLogs);

      // Act
      const result = await adminRepo.getAuditLogs({
        limit: 20,
        offset: 40,
        sortBy: 'action',
        sortOrder: 'asc',
      });

      // Assert
      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith({
        take: 20,
        skip: 40,
        orderBy: { action: 'asc' },
        include: expect.any(Object),
      });
    });

    it('should throw error if query fails', async () => {
      // Arrange
      (mockPrisma.adminAuditLog.findMany as any).mockRejectedValue(
        new Error('Query timeout')
      );

      // Act & Assert
      await expect(adminRepo.getAuditLogs()).rejects.toThrow(
        'Failed to get audit logs: Query timeout'
      );
    });
  });

  describe('getAuditLogsByAdmin()', () => {
    it('should return audit logs filtered by admin ID', async () => {
      // Arrange
      const adminId = 'admin123';
      const mockLogs = [
        {
          id: 'log1',
          adminId,
          action: 'user.ban',
          targetType: 'user',
          targetId: 'user1',
          createdAt: new Date(),
          admin: { id: adminId, username: 'admin_user', email: 'admin@test.com' },
        },
      ];

      (mockPrisma.adminAuditLog.findMany as any).mockResolvedValue(mockLogs);

      // Act
      const result = await adminRepo.getAuditLogsByAdmin(adminId);

      // Assert
      expect(result).toEqual(mockLogs);
      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith({
        where: { adminId },
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should return empty array if admin has no logs', async () => {
      // Arrange
      (mockPrisma.adminAuditLog.findMany as any).mockResolvedValue([]);

      // Act
      const result = await adminRepo.getAuditLogsByAdmin('admin999');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getAuditLogsByTarget()', () => {
    it('should return audit logs filtered by target type and ID', async () => {
      // Arrange
      const targetType = 'user';
      const targetId = 'user123';
      const mockLogs = [
        {
          id: 'log1',
          adminId: 'admin1',
          action: 'user.ban',
          targetType,
          targetId,
          createdAt: new Date(),
          admin: { id: 'admin1', username: 'admin_user', email: 'admin@test.com' },
        },
        {
          id: 'log2',
          adminId: 'admin2',
          action: 'user.unban',
          targetType,
          targetId,
          createdAt: new Date(),
          admin: { id: 'admin2', username: 'admin2_user', email: 'admin2@test.com' },
        },
      ];

      (mockPrisma.adminAuditLog.findMany as any).mockResolvedValue(mockLogs);

      // Act
      const result = await adminRepo.getAuditLogsByTarget(targetType, targetId);

      // Assert
      expect(result).toEqual(mockLogs);
      expect(mockPrisma.adminAuditLog.findMany).toHaveBeenCalledWith({
        where: { targetType, targetId },
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });

    it('should return empty array if target has no logs', async () => {
      // Arrange
      (mockPrisma.adminAuditLog.findMany as any).mockResolvedValue([]);

      // Act
      const result = await adminRepo.getAuditLogsByTarget('project', 'proj999');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('createContentReport()', () => {
    it('should create a content report with pending status', async () => {
      // Arrange
      const input: CreateContentReportInput = {
        reporterId: 'user123',
        contentType: 'project',
        contentId: 'proj456',
        reason: 'spam',
        description: 'This project is clearly spam',
      };

      const mockReport = {
        id: 'report123',
        ...input,
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        resolution: null,
        createdAt: new Date(),
      };

      (mockPrisma.contentReport.create as any).mockResolvedValue(mockReport);

      // Act
      const result = await adminRepo.createContentReport(input);

      // Assert
      expect(result).toEqual(mockReport);
      expect(mockPrisma.contentReport.create).toHaveBeenCalledWith({
        data: {
          reporterId: input.reporterId,
          contentType: input.contentType,
          contentId: input.contentId,
          reason: input.reason,
          description: input.description,
          status: 'pending',
        },
      });
    });

    it('should throw error if report creation fails', async () => {
      // Arrange
      const input: CreateContentReportInput = {
        reporterId: 'invalid',
        contentType: 'project',
        contentId: 'proj123',
        reason: 'spam',
        description: 'Spam content',
      };

      (mockPrisma.contentReport.create as any).mockRejectedValue(
        new Error('Foreign key constraint failed')
      );

      // Act & Assert
      await expect(adminRepo.createContentReport(input)).rejects.toThrow(
        'Failed to create content report: Foreign key constraint failed'
      );
    });
  });

  describe('getContentReports()', () => {
    it('should return all content reports with default pagination', async () => {
      // Arrange
      const mockReports = [
        {
          id: 'report1',
          reporterId: 'user1',
          contentType: 'project',
          contentId: 'proj1',
          reason: 'spam',
          description: 'Spam project',
          status: 'pending',
          createdAt: new Date(),
          reporter: { id: 'user1', username: 'user1', email: 'user1@test.com' },
        },
      ];

      (mockPrisma.contentReport.findMany as any).mockResolvedValue(mockReports);

      // Act
      const result = await adminRepo.getContentReports();

      // Assert
      expect(result).toEqual(mockReports);
      expect(mockPrisma.contentReport.findMany).toHaveBeenCalledWith({
        where: {},
        take: 50,
        skip: 0,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        },
      });
    });

    it('should filter reports by status', async () => {
      // Arrange
      const mockReports = [];
      (mockPrisma.contentReport.findMany as any).mockResolvedValue(mockReports);

      // Act
      const result = await adminRepo.getContentReports({}, 'pending');

      // Assert
      expect(mockPrisma.contentReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'pending' },
        })
      );
    });

    it('should filter reports by content type', async () => {
      // Arrange
      const mockReports = [];
      (mockPrisma.contentReport.findMany as any).mockResolvedValue(mockReports);

      // Act
      const result = await adminRepo.getContentReports({}, undefined, 'project');

      // Assert
      expect(mockPrisma.contentReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { contentType: 'project' },
        })
      );
    });

    it('should filter reports by both status and content type', async () => {
      // Arrange
      const mockReports = [];
      (mockPrisma.contentReport.findMany as any).mockResolvedValue(mockReports);

      // Act
      const result = await adminRepo.getContentReports({}, 'resolved', 'user');

      // Assert
      expect(mockPrisma.contentReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'resolved', contentType: 'user' },
        })
      );
    });

    it('should throw error if query fails', async () => {
      // Arrange
      (mockPrisma.contentReport.findMany as any).mockRejectedValue(
        new Error('Query error')
      );

      // Act & Assert
      await expect(adminRepo.getContentReports()).rejects.toThrow(
        'Failed to get content reports: Query error'
      );
    });
  });

  describe('updateContentReport()', () => {
    it('should update content report status and set reviewedAt', async () => {
      // Arrange
      const reportId = 'report123';
      const updateData = {
        status: 'resolved',
        reviewedBy: 'admin456',
        resolution: 'Content removed and user warned',
      };

      const mockUpdatedReport = {
        id: reportId,
        reporterId: 'user1',
        contentType: 'project',
        contentId: 'proj1',
        reason: 'spam',
        description: 'Spam project',
        ...updateData,
        reviewedAt: expect.any(Date),
        createdAt: new Date(),
      };

      (mockPrisma.contentReport.update as any).mockResolvedValue(mockUpdatedReport);

      // Act
      const result = await adminRepo.updateContentReport(reportId, updateData);

      // Assert
      expect(result).toEqual(mockUpdatedReport);
      expect(mockPrisma.contentReport.update).toHaveBeenCalledWith({
        where: { id: reportId },
        data: {
          status: updateData.status,
          reviewedBy: updateData.reviewedBy,
          reviewedAt: expect.any(Date),
          resolution: updateData.resolution,
        },
      });
    });

    it('should update report without resolution', async () => {
      // Arrange
      const reportId = 'report123';
      const updateData = {
        status: 'dismissed',
        reviewedBy: 'admin456',
      };

      const mockUpdatedReport = {
        id: reportId,
        status: 'dismissed',
        reviewedBy: 'admin456',
        reviewedAt: new Date(),
      };

      (mockPrisma.contentReport.update as any).mockResolvedValue(mockUpdatedReport);

      // Act
      const result = await adminRepo.updateContentReport(reportId, updateData);

      // Assert
      expect(result).toEqual(mockUpdatedReport);
    });

    it('should throw error if report not found', async () => {
      // Arrange
      const reportId = 'invalid';
      const updateData = {
        status: 'resolved',
        reviewedBy: 'admin123',
      };

      (mockPrisma.contentReport.update as any).mockRejectedValue(
        new Error('Record not found')
      );

      // Act & Assert
      await expect(adminRepo.updateContentReport(reportId, updateData)).rejects.toThrow(
        'Failed to update content report: Record not found'
      );
    });
  });

  describe('countContentReports()', () => {
    it('should count all content reports when no status provided', async () => {
      // Arrange
      (mockPrisma.contentReport.count as any).mockResolvedValue(42);

      // Act
      const result = await adminRepo.countContentReports();

      // Assert
      expect(result).toBe(42);
      expect(mockPrisma.contentReport.count).toHaveBeenCalledWith({
        where: undefined,
      });
    });

    it('should count content reports filtered by status', async () => {
      // Arrange
      (mockPrisma.contentReport.count as any).mockResolvedValue(7);

      // Act
      const result = await adminRepo.countContentReports('pending');

      // Assert
      expect(result).toBe(7);
      expect(mockPrisma.contentReport.count).toHaveBeenCalledWith({
        where: { status: 'pending' },
      });
    });

    it('should return zero when no reports exist', async () => {
      // Arrange
      (mockPrisma.contentReport.count as any).mockResolvedValue(0);

      // Act
      const result = await adminRepo.countContentReports('resolved');

      // Assert
      expect(result).toBe(0);
    });

    it('should throw error if count fails', async () => {
      // Arrange
      (mockPrisma.contentReport.count as any).mockRejectedValue(
        new Error('Database error')
      );

      // Act & Assert
      await expect(adminRepo.countContentReports()).rejects.toThrow(
        'Failed to count content reports: Database error'
      );
    });
  });

  describe('countAuditLogs()', () => {
    it('should count all audit logs when no admin ID provided', async () => {
      // Arrange
      (mockPrisma.adminAuditLog.count as any).mockResolvedValue(150);

      // Act
      const result = await adminRepo.countAuditLogs();

      // Assert
      expect(result).toBe(150);
      expect(mockPrisma.adminAuditLog.count).toHaveBeenCalledWith({
        where: undefined,
      });
    });

    it('should count audit logs filtered by admin ID', async () => {
      // Arrange
      (mockPrisma.adminAuditLog.count as any).mockResolvedValue(25);

      // Act
      const result = await adminRepo.countAuditLogs('admin123');

      // Assert
      expect(result).toBe(25);
      expect(mockPrisma.adminAuditLog.count).toHaveBeenCalledWith({
        where: { adminId: 'admin123' },
      });
    });

    it('should return zero when no logs exist', async () => {
      // Arrange
      (mockPrisma.adminAuditLog.count as any).mockResolvedValue(0);

      // Act
      const result = await adminRepo.countAuditLogs('admin999');

      // Assert
      expect(result).toBe(0);
    });

    it('should throw error if count fails', async () => {
      // Arrange
      (mockPrisma.adminAuditLog.count as any).mockRejectedValue(
        new Error('Connection timeout')
      );

      // Act & Assert
      await expect(adminRepo.countAuditLogs()).rejects.toThrow(
        'Failed to count audit logs: Connection timeout'
      );
    });
  });
});
