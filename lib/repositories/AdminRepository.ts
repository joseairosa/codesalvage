/**
 * AdminRepository - Admin Data Access Layer
 *
 * Responsibilities:
 * - Handle ALL direct database interactions for admin operations
 * - Provide clean interface for platform statistics
 * - Manage audit logs for admin actions
 * - Manage content reports and moderation
 * - Abstract Prisma implementation details from business logic
 *
 * Architecture:
 * - Repository Pattern (data access layer)
 * - Single Responsibility Principle (database operations only)
 * - Dependency injection (receives Prisma client)
 * - Returns domain models, not Prisma types
 *
 * @example
 * const adminRepo = new AdminRepository(prisma);
 * const stats = await adminRepo.getPlatformStats();
 */

import type { PrismaClient, AdminAuditLog, ContentReport, Prisma } from '@prisma/client';

/**
 * Platform statistics interface
 */
export interface PlatformStats {
  totalUsers: number;
  totalSellers: number;
  totalVerifiedSellers: number;
  totalBannedUsers: number;
  totalProjects: number;
  totalActiveProjects: number;
  totalSoldProjects: number;
  totalDraftProjects: number;
  totalTransactions: number;
  totalRevenueCents: number;
  totalPendingReports: number;
  totalResolvedReports: number;
  totalDismissedReports: number;
}

/**
 * Audit log creation input
 */
export interface CreateAuditLogInput {
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  metadata?: Prisma.JsonValue;
  ipAddress?: string;
}

/**
 * Content report creation input (for users reporting content)
 */
export interface CreateContentReportInput {
  reporterId: string;
  contentType: string;
  contentId: string;
  reason: string;
  description: string;
}

/**
 * Content report update input (for admins reviewing reports)
 */
export interface UpdateContentReportInput {
  status: string;
  reviewedBy: string;
  resolution?: string;
}

/**
 * Audit log with admin user relation
 */
export interface AuditLogWithAdmin extends AdminAuditLog {
  admin: {
    id: string;
    username: string;
    email: string;
  };
}

/**
 * Content report with reporter relation
 */
export interface ContentReportWithReporter extends ContentReport {
  reporter: {
    id: string;
    username: string;
    email: string;
  };
}

/**
 * Pagination options for admin queries
 */
export interface AdminPaginationOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * AdminRepository class
 */
export class AdminRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    console.log('[AdminRepository] Initialized');
  }

  /**
   * Get comprehensive platform statistics
   *
   * Aggregates data across all models to provide a dashboard overview.
   * Uses parallel queries for performance.
   *
   * @returns Platform statistics object
   * @throws Error if query fails
   *
   * @example
   * const stats = await adminRepo.getPlatformStats();
   * console.log(`Total users: ${stats.totalUsers}`);
   */
  async getPlatformStats(): Promise<PlatformStats> {
    console.log('[AdminRepository] getPlatformStats called');

    try {
      // Execute all queries in parallel for performance
      const [
        totalUsers,
        totalSellers,
        totalVerifiedSellers,
        totalBannedUsers,
        totalProjects,
        totalActiveProjects,
        totalSoldProjects,
        totalDraftProjects,
        totalTransactions,
        revenueAggregation,
        totalPendingReports,
        totalResolvedReports,
        totalDismissedReports,
      ] = await this.prisma.$transaction([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { isSeller: true } }),
        this.prisma.user.count({ where: { isVerifiedSeller: true } }),
        this.prisma.user.count({ where: { isBanned: true } }),
        this.prisma.project.count(),
        this.prisma.project.count({ where: { status: 'active' } }),
        this.prisma.project.count({ where: { status: 'sold' } }),
        this.prisma.project.count({ where: { status: 'draft' } }),
        this.prisma.transaction.count(),
        this.prisma.transaction.aggregate({
          _sum: { amountCents: true },
          where: { paymentStatus: 'succeeded' },
        }),
        this.prisma.contentReport.count({ where: { status: 'pending' } }),
        this.prisma.contentReport.count({ where: { status: 'resolved' } }),
        this.prisma.contentReport.count({ where: { status: 'dismissed' } }),
      ]);

      const stats: PlatformStats = {
        totalUsers,
        totalSellers,
        totalVerifiedSellers,
        totalBannedUsers,
        totalProjects,
        totalActiveProjects,
        totalSoldProjects,
        totalDraftProjects,
        totalTransactions,
        totalRevenueCents: revenueAggregation._sum.amountCents || 0,
        totalPendingReports,
        totalResolvedReports,
        totalDismissedReports,
      };

      console.log('[AdminRepository] Platform stats retrieved:', {
        totalUsers: stats.totalUsers,
        totalProjects: stats.totalProjects,
        totalRevenueCents: stats.totalRevenueCents,
      });

      return stats;
    } catch (error) {
      console.error('[AdminRepository] getPlatformStats failed:', error);
      throw new Error(
        `Failed to get platform stats: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create an audit log entry
   *
   * Records all administrative actions for compliance and debugging.
   * Logs are immutable once created.
   *
   * @param data - Audit log data
   * @returns Created audit log entry
   * @throws Error if creation fails
   *
   * @example
   * await adminRepo.createAuditLog({
   *   adminId: 'admin123',
   *   action: 'user.ban',
   *   targetType: 'user',
   *   targetId: 'user456',
   *   reason: 'Spam violation',
   *   ipAddress: '192.168.1.1'
   * });
   */
  async createAuditLog(data: CreateAuditLogInput): Promise<AdminAuditLog> {
    console.log('[AdminRepository] createAuditLog called:', {
      adminId: data.adminId,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
    });

    try {
      const auditLog = await this.prisma.adminAuditLog.create({
        data: {
          adminId: data.adminId,
          action: data.action,
          targetType: data.targetType,
          targetId: data.targetId,
          reason: data.reason,
          metadata: data.metadata,
          ipAddress: data.ipAddress,
        },
      });

      console.log('[AdminRepository] Audit log created:', auditLog.id);
      return auditLog;
    } catch (error) {
      console.error('[AdminRepository] createAuditLog failed:', error);
      throw new Error(
        `Failed to create audit log: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get audit logs with pagination
   *
   * Returns audit logs with admin user details.
   * Ordered by most recent first.
   *
   * @param options - Pagination and filtering options
   * @returns Array of audit logs with admin relations
   * @throws Error if query fails
   *
   * @example
   * const logs = await adminRepo.getAuditLogs({ limit: 50, offset: 0 });
   */
  async getAuditLogs(
    options: AdminPaginationOptions = {}
  ): Promise<AuditLogWithAdmin[]> {
    const { limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    console.log('[AdminRepository] getAuditLogs called:', { limit, offset });

    try {
      const auditLogs = await this.prisma.adminAuditLog.findMany({
        take: limit,
        skip: offset,
        orderBy: { [sortBy]: sortOrder },
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

      console.log('[AdminRepository] Audit logs retrieved:', auditLogs.length);
      return auditLogs as AuditLogWithAdmin[];
    } catch (error) {
      console.error('[AdminRepository] getAuditLogs failed:', error);
      throw new Error(
        `Failed to get audit logs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get audit logs filtered by admin ID
   *
   * @param adminId - Admin user ID to filter by
   * @param options - Pagination options
   * @returns Array of audit logs for specific admin
   * @throws Error if query fails
   *
   * @example
   * const adminLogs = await adminRepo.getAuditLogsByAdmin('admin123');
   */
  async getAuditLogsByAdmin(
    adminId: string,
    options: AdminPaginationOptions = {}
  ): Promise<AuditLogWithAdmin[]> {
    const { limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    console.log('[AdminRepository] getAuditLogsByAdmin called:', { adminId, limit, offset });

    try {
      const auditLogs = await this.prisma.adminAuditLog.findMany({
        where: { adminId },
        take: limit,
        skip: offset,
        orderBy: { [sortBy]: sortOrder },
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

      console.log('[AdminRepository] Admin audit logs retrieved:', auditLogs.length);
      return auditLogs as AuditLogWithAdmin[];
    } catch (error) {
      console.error('[AdminRepository] getAuditLogsByAdmin failed:', error);
      throw new Error(
        `Failed to get admin audit logs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get audit logs filtered by target
   *
   * @param targetType - Type of target (user, project, transaction, report)
   * @param targetId - ID of target entity
   * @param options - Pagination options
   * @returns Array of audit logs for specific target
   * @throws Error if query fails
   *
   * @example
   * const userLogs = await adminRepo.getAuditLogsByTarget('user', 'user123');
   */
  async getAuditLogsByTarget(
    targetType: string,
    targetId: string,
    options: AdminPaginationOptions = {}
  ): Promise<AuditLogWithAdmin[]> {
    const { limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    console.log('[AdminRepository] getAuditLogsByTarget called:', {
      targetType,
      targetId,
      limit,
      offset,
    });

    try {
      const auditLogs = await this.prisma.adminAuditLog.findMany({
        where: { targetType, targetId },
        take: limit,
        skip: offset,
        orderBy: { [sortBy]: sortOrder },
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

      console.log('[AdminRepository] Target audit logs retrieved:', auditLogs.length);
      return auditLogs as AuditLogWithAdmin[];
    } catch (error) {
      console.error('[AdminRepository] getAuditLogsByTarget failed:', error);
      throw new Error(
        `Failed to get target audit logs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create a content report (for users reporting content)
   *
   * @param data - Content report data
   * @returns Created content report
   * @throws Error if creation fails
   *
   * @example
   * await adminRepo.createContentReport({
   *   reporterId: 'user123',
   *   contentType: 'project',
   *   contentId: 'proj456',
   *   reason: 'spam',
   *   description: 'This project is spam'
   * });
   */
  async createContentReport(data: CreateContentReportInput): Promise<ContentReport> {
    console.log('[AdminRepository] createContentReport called:', {
      reporterId: data.reporterId,
      contentType: data.contentType,
      contentId: data.contentId,
    });

    try {
      const report = await this.prisma.contentReport.create({
        data: {
          reporterId: data.reporterId,
          contentType: data.contentType,
          contentId: data.contentId,
          reason: data.reason,
          description: data.description,
          status: 'pending',
        },
      });

      console.log('[AdminRepository] Content report created:', report.id);
      return report;
    } catch (error) {
      console.error('[AdminRepository] createContentReport failed:', error);
      throw new Error(
        `Failed to create content report: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get content reports with pagination and filtering
   *
   * Returns content reports with reporter details.
   * Ordered by most recent first.
   *
   * @param options - Pagination and filtering options
   * @param status - Optional status filter ('pending', 'reviewed', 'resolved', 'dismissed')
   * @param contentType - Optional content type filter ('project', 'user', 'review', 'message')
   * @returns Array of content reports with reporter relations
   * @throws Error if query fails
   *
   * @example
   * const pendingReports = await adminRepo.getContentReports({ limit: 20 }, 'pending');
   */
  async getContentReports(
    options: AdminPaginationOptions = {},
    status?: string,
    contentType?: string
  ): Promise<ContentReportWithReporter[]> {
    const { limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    console.log('[AdminRepository] getContentReports called:', {
      limit,
      offset,
      status,
      contentType,
    });

    // Build where clause
    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (contentType) {
      where.contentType = contentType;
    }

    try {
      const reports = await this.prisma.contentReport.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { [sortBy]: sortOrder },
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

      console.log('[AdminRepository] Content reports retrieved:', reports.length);
      return reports as ContentReportWithReporter[];
    } catch (error) {
      console.error('[AdminRepository] getContentReports failed:', error);
      throw new Error(
        `Failed to get content reports: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Update a content report (for admins reviewing reports)
   *
   * Updates the status and resolution of a report.
   * Sets reviewedAt timestamp automatically.
   *
   * @param id - Report ID
   * @param data - Update data (status, reviewedBy, resolution)
   * @returns Updated content report
   * @throws Error if report not found or update fails
   *
   * @example
   * await adminRepo.updateContentReport('report123', {
   *   status: 'resolved',
   *   reviewedBy: 'admin456',
   *   resolution: 'Content removed and user warned'
   * });
   */
  async updateContentReport(
    id: string,
    data: UpdateContentReportInput
  ): Promise<ContentReport> {
    console.log('[AdminRepository] updateContentReport called:', { id, status: data.status });

    try {
      const report = await this.prisma.contentReport.update({
        where: { id },
        data: {
          status: data.status,
          reviewedBy: data.reviewedBy,
          reviewedAt: new Date(),
          resolution: data.resolution,
        },
      });

      console.log('[AdminRepository] Content report updated:', report.id);
      return report;
    } catch (error) {
      console.error('[AdminRepository] updateContentReport failed:', error);
      throw new Error(
        `Failed to update content report: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Count content reports by status
   *
   * @param status - Report status to count
   * @returns Count of reports
   * @throws Error if query fails
   *
   * @example
   * const pendingCount = await adminRepo.countContentReports('pending');
   */
  async countContentReports(status?: string): Promise<number> {
    console.log('[AdminRepository] countContentReports called:', { status });

    try {
      const count = await this.prisma.contentReport.count({
        where: status ? { status } : undefined,
      });

      console.log('[AdminRepository] Content report count:', count);
      return count;
    } catch (error) {
      console.error('[AdminRepository] countContentReports failed:', error);
      throw new Error(
        `Failed to count content reports: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Count audit logs
   *
   * @param adminId - Optional admin ID filter
   * @returns Count of audit logs
   * @throws Error if query fails
   *
   * @example
   * const totalLogs = await adminRepo.countAuditLogs();
   */
  async countAuditLogs(adminId?: string): Promise<number> {
    console.log('[AdminRepository] countAuditLogs called:', { adminId });

    try {
      const count = await this.prisma.adminAuditLog.count({
        where: adminId ? { adminId } : undefined,
      });

      console.log('[AdminRepository] Audit log count:', count);
      return count;
    } catch (error) {
      console.error('[AdminRepository] countAuditLogs failed:', error);
      throw new Error(
        `Failed to count audit logs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
