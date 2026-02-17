/**
 * AdminService - Admin Business Logic Layer
 *
 * Responsibilities:
 * - Orchestrate admin operations across multiple repositories
 * - Implement business rules and validation for admin actions
 * - Create audit logs for ALL admin actions
 * - Send email notifications for user-facing actions (ban/unban)
 * - Handle transactions across multiple database operations
 *
 * Architecture:
 * - Service Layer (business logic only, no direct DB access)
 * - Single Responsibility Principle (admin operations only)
 * - Dependency injection (receives repositories)
 * - Comprehensive error handling with custom error classes
 *
 * @example
 * const adminService = new AdminService(adminRepo, userRepo, projectRepo, transactionRepo, emailService);
 * await adminService.banUser(adminId, userId, reason, ipAddress);
 */

import type {
  AdminRepository,
  PlatformStats,
  EscrowAnalytics,
  AuditLogWithAdmin,
  ContentReportWithReporter,
  AdminPaginationOptions,
} from '@/lib/repositories/AdminRepository';
import type { UserRepository } from '@/lib/repositories/UserRepository';
import type { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import type { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import type { EmailService, RefundEmailData } from '@/lib/services/EmailService';
import type { StripeService } from '@/lib/services/StripeService';
import type { User, Project, Transaction } from '@prisma/client';

/**
 * Custom error for admin validation failures
 */
export class AdminValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminValidationError';
  }
}

/**
 * Custom error for admin authorization failures
 */
export class AdminAuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminAuthorizationError';
  }
}

/**
 * AdminService class
 */
export class AdminService {
  constructor(
    private adminRepository: AdminRepository,
    private userRepository: UserRepository,
    private projectRepository: ProjectRepository,
    private transactionRepository: TransactionRepository,
    private emailService: EmailService,
    private stripeService: StripeService
  ) {
    console.log('[AdminService] Initialized');
  }

  /**
   * Get comprehensive platform statistics
   *
   * @returns Platform statistics
   * @throws Error if query fails
   *
   * @example
   * const stats = await adminService.getPlatformStats();
   */
  async getPlatformStats(): Promise<PlatformStats> {
    console.log('[AdminService] getPlatformStats called');

    try {
      return await this.adminRepository.getPlatformStats();
    } catch (error) {
      console.error('[AdminService] getPlatformStats failed:', error);
      throw error;
    }
  }

  /**
   * Ban a user with audit logging and email notification
   *
   * Business rules:
   * - Reason must be at least 10 characters
   * - User must exist and not be already banned
   * - Cannot ban admin users (safety measure)
   * - Creates audit log
   * - Sends email notification to banned user
   *
   * @param adminId - Admin user ID performing the ban
   * @param userId - User ID to ban
   * @param reason - Reason for ban (min 10 chars)
   * @param ipAddress - Optional IP address of admin
   * @returns Banned user
   * @throws AdminValidationError if validation fails
   *
   * @example
   * await adminService.banUser('admin123', 'user456', 'Repeated spam violations', '192.168.1.1');
   */
  async banUser(
    adminId: string,
    userId: string,
    reason: string,
    ipAddress?: string
  ): Promise<User> {
    console.log('[AdminService] banUser called:', { adminId, userId, reason });

    if (!reason || reason.trim().length < 10) {
      throw new AdminValidationError('Ban reason must be at least 10 characters');
    }

    if (adminId === userId) {
      throw new AdminValidationError('Cannot ban yourself');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AdminValidationError('User not found');
    }

    if (user.isBanned) {
      throw new AdminValidationError('User is already banned');
    }

    if (user.isAdmin) {
      throw new AdminAuthorizationError(
        'Cannot ban admin users. Revoke admin status first.'
      );
    }

    try {
      const bannedUser = await this.userRepository.banUser(userId, adminId, reason);

      await this.adminRepository.createAuditLog({
        adminId,
        action: 'user.ban',
        targetType: 'user',
        targetId: userId,
        reason,
        metadata: {
          username: user.username,
          email: user.email,
          isSeller: user.isSeller,
        },
        ...(ipAddress ? { ipAddress } : {}),
      });

      try {
        await this.emailService.sendUserBannedNotification(
          { email: user.email, name: user.fullName || user.username },
          {
            username: user.username,
            reason,
            bannedAt: new Date().toISOString(),
            supportEmail: 'support@codesalvage.com',
          }
        );
      } catch (emailError) {
        console.error('[AdminService] Failed to send ban email:', emailError);
      }

      console.log('[AdminService] User banned successfully:', userId);
      return bannedUser;
    } catch (error) {
      console.error('[AdminService] banUser failed:', error);
      throw error;
    }
  }

  /**
   * Unban a user with audit logging and email notification
   *
   * Business rules:
   * - User must exist and be currently banned
   * - Creates audit log
   * - Sends email notification to unbanned user
   *
   * @param adminId - Admin user ID performing the unban
   * @param userId - User ID to unban
   * @param ipAddress - Optional IP address of admin
   * @returns Unbanned user
   * @throws AdminValidationError if validation fails
   *
   * @example
   * await adminService.unbanUser('admin123', 'user456', '192.168.1.1');
   */
  async unbanUser(adminId: string, userId: string, ipAddress?: string): Promise<User> {
    console.log('[AdminService] unbanUser called:', { adminId, userId });

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AdminValidationError('User not found');
    }

    if (!user.isBanned) {
      throw new AdminValidationError('User is not currently banned');
    }

    try {
      const unbannedUser = await this.userRepository.unbanUser(userId);

      await this.adminRepository.createAuditLog({
        adminId,
        action: 'user.unban',
        targetType: 'user',
        targetId: userId,
        metadata: {
          username: user.username,
          email: user.email,
          previousBanReason: user.bannedReason,
          bannedBy: user.bannedBy,
        },
        ...(ipAddress ? { ipAddress } : {}),
      });

      try {
        await this.emailService.sendUserUnbannedNotification(
          { email: user.email, name: user.fullName || user.username },
          {
            username: user.username,
            unbannedAt: new Date().toISOString(),
          }
        );
      } catch (emailError) {
        console.error('[AdminService] Failed to send unban email:', emailError);
      }

      console.log('[AdminService] User unbanned successfully:', userId);
      return unbannedUser;
    } catch (error) {
      console.error('[AdminService] unbanUser failed:', error);
      throw error;
    }
  }

  /**
   * Approve a project with audit logging
   *
   * Business rules:
   * - Project must exist and not be already active
   * - Creates audit log
   * - Could send email to seller (optional, not implemented)
   *
   * @param adminId - Admin user ID performing the approval
   * @param projectId - Project ID to approve
   * @param ipAddress - Optional IP address of admin
   * @returns Approved project
   * @throws AdminValidationError if validation fails
   *
   * @example
   * await adminService.approveProject('admin123', 'proj456', '192.168.1.1');
   */
  async approveProject(
    adminId: string,
    projectId: string,
    ipAddress?: string
  ): Promise<Project> {
    console.log('[AdminService] approveProject called:', { adminId, projectId });

    const project = await this.projectRepository.findById(projectId, true);
    if (!project) {
      throw new AdminValidationError('Project not found');
    }

    if (project.status === 'active') {
      throw new AdminValidationError('Project is already active');
    }

    try {
      const approvedProject = await this.projectRepository.approveProject(
        projectId,
        adminId
      );

      await this.adminRepository.createAuditLog({
        adminId,
        action: 'project.approve',
        targetType: 'project',
        targetId: projectId,
        metadata: {
          title: project.title,
          sellerId: project.sellerId,
          previousStatus: project.status,
        },
        ...(ipAddress ? { ipAddress } : {}),
      });

      console.log('[AdminService] Project approved successfully:', projectId);
      return approvedProject;
    } catch (error) {
      console.error('[AdminService] approveProject failed:', error);
      throw error;
    }
  }

  /**
   * Reject a project with audit logging
   *
   * Business rules:
   * - Project must exist
   * - Reason must be provided if rejecting active project
   * - Creates audit log
   *
   * @param adminId - Admin user ID performing the rejection
   * @param projectId - Project ID to reject
   * @param reason - Reason for rejection
   * @param ipAddress - Optional IP address of admin
   * @returns Rejected project
   * @throws AdminValidationError if validation fails
   *
   * @example
   * await adminService.rejectProject('admin123', 'proj456', 'Violates content policy', '192.168.1.1');
   */
  async rejectProject(
    adminId: string,
    projectId: string,
    reason: string,
    ipAddress?: string
  ): Promise<Project> {
    console.log('[AdminService] rejectProject called:', { adminId, projectId, reason });

    if (!reason || reason.trim().length < 10) {
      throw new AdminValidationError('Rejection reason must be at least 10 characters');
    }

    const project = await this.projectRepository.findById(projectId, true);
    if (!project) {
      throw new AdminValidationError('Project not found');
    }

    try {
      const rejectedProject = await this.projectRepository.rejectProject(
        projectId,
        reason
      );

      await this.adminRepository.createAuditLog({
        adminId,
        action: 'project.reject',
        targetType: 'project',
        targetId: projectId,
        reason,
        metadata: {
          title: project.title,
          sellerId: project.sellerId,
          previousStatus: project.status,
        },
        ...(ipAddress ? { ipAddress } : {}),
      });

      console.log('[AdminService] Project rejected successfully:', projectId);
      return rejectedProject;
    } catch (error) {
      console.error('[AdminService] rejectProject failed:', error);
      throw error;
    }
  }

  /**
   * Toggle featured status for a project with audit logging
   *
   * Business rules:
   * - Project must exist
   * - Project must be active to be featured
   * - Creates audit log
   *
   * @param adminId - Admin user ID performing the action
   * @param projectId - Project ID to feature/unfeature
   * @param featured - Whether to feature or unfeature
   * @param featuredDays - Number of days to feature (default 30)
   * @param ipAddress - Optional IP address of admin
   * @returns Updated project
   * @throws AdminValidationError if validation fails
   *
   * @example
   * await adminService.toggleProjectFeatured('admin123', 'proj456', true, 30, '192.168.1.1');
   */
  async toggleProjectFeatured(
    adminId: string,
    projectId: string,
    featured: boolean,
    featuredDays: number = 30,
    ipAddress?: string
  ): Promise<Project> {
    console.log('[AdminService] toggleProjectFeatured called:', {
      adminId,
      projectId,
      featured,
      featuredDays,
    });

    const project = await this.projectRepository.findById(projectId, true);
    if (!project) {
      throw new AdminValidationError('Project not found');
    }

    if (featured && project.status !== 'active') {
      throw new AdminValidationError('Can only feature active projects');
    }

    if (featured && featuredDays <= 0) {
      throw new AdminValidationError('Featured days must be positive');
    }

    try {
      const updatedProject = await this.projectRepository.toggleFeatured(
        projectId,
        featured,
        adminId,
        featuredDays
      );

      await this.adminRepository.createAuditLog({
        adminId,
        action: featured ? 'project.feature' : 'project.unfeature',
        targetType: 'project',
        targetId: projectId,
        metadata: {
          title: project.title,
          sellerId: project.sellerId,
          ...(featured && featuredDays ? { featuredDays } : {}),
          previouslyFeatured: project.isFeatured,
        },
        ...(ipAddress ? { ipAddress } : {}),
      });

      console.log(
        '[AdminService] Project featured status toggled successfully:',
        projectId,
        featured
      );
      return updatedProject;
    } catch (error) {
      console.error('[AdminService] toggleProjectFeatured failed:', error);
      throw error;
    }
  }

  /**
   * Get all users with admin-level access
   *
   * @param options - Filtering and pagination options
   * @returns Array of users
   *
   * @example
   * const bannedUsers = await adminService.getUsers({ isBanned: true });
   */
  async getUsers(
    options?: Parameters<UserRepository['getAllUsers']>[0]
  ): Promise<User[]> {
    console.log('[AdminService] getUsers called');
    return await this.userRepository.getAllUsers(options);
  }

  /**
   * Get all projects with admin-level access
   *
   * @param options - Filtering and pagination options
   * @returns Array of projects
   *
   * @example
   * const draftProjects = await adminService.getProjects({ status: 'draft' });
   */
  async getProjects(
    options?: Parameters<ProjectRepository['getAllProjects']>[0]
  ): Promise<Project[]> {
    console.log('[AdminService] getProjects called');
    return await this.projectRepository.getAllProjects(options);
  }

  /**
   * Get all transactions with admin-level access
   *
   * @param options - Filtering and pagination options
   * @returns Array of transactions with relations
   *
   * @example
   * const heldEscrow = await adminService.getTransactions({ escrowStatus: 'held' });
   */
  async getTransactions(
    options?: Parameters<TransactionRepository['getAllTransactions']>[0]
  ): Promise<Awaited<ReturnType<TransactionRepository['getAllTransactions']>>> {
    console.log('[AdminService] getTransactions called');
    return await this.transactionRepository.getAllTransactions(options);
  }

  /**
   * Get audit logs
   *
   * @param options - Pagination options
   * @returns Array of audit logs
   *
   * @example
   * const recentLogs = await adminService.getAuditLogs({ limit: 100 });
   */
  async getAuditLogs(options?: AdminPaginationOptions): Promise<AuditLogWithAdmin[]> {
    console.log('[AdminService] getAuditLogs called');
    return await this.adminRepository.getAuditLogs(options);
  }

  /**
   * Get content reports
   *
   * @param options - Pagination options
   * @param status - Optional status filter
   * @param contentType - Optional content type filter
   * @returns Array of content reports
   *
   * @example
   * const pendingReports = await adminService.getContentReports({}, 'pending');
   */
  async getContentReports(
    options?: AdminPaginationOptions,
    status?: string,
    contentType?: string
  ): Promise<ContentReportWithReporter[]> {
    console.log('[AdminService] getContentReports called');
    return await this.adminRepository.getContentReports(options, status, contentType);
  }

  /**
   * Resolve a content report with audit logging
   *
   * Business rules:
   * - Report must exist and be pending
   * - Resolution must be provided
   * - Creates audit log
   *
   * @param adminId - Admin user ID resolving the report
   * @param reportId - Content report ID
   * @param resolution - Resolution description
   * @param status - New status ('resolved' or 'dismissed')
   * @param ipAddress - Optional IP address of admin
   * @returns Updated content report
   * @throws AdminValidationError if validation fails
   *
   * @example
   * await adminService.resolveContentReport('admin123', 'report456', 'User warned', 'resolved');
   */
  async resolveContentReport(
    adminId: string,
    reportId: string,
    resolution: string,
    status: 'resolved' | 'dismissed',
    ipAddress?: string
  ): Promise<Awaited<ReturnType<AdminRepository['updateContentReport']>>> {
    console.log('[AdminService] resolveContentReport called:', {
      adminId,
      reportId,
      status,
    });

    if (!resolution || resolution.trim().length < 5) {
      throw new AdminValidationError('Resolution must be at least 5 characters');
    }

    try {
      const updatedReport = await this.adminRepository.updateContentReport(reportId, {
        status,
        reviewedBy: adminId,
        resolution,
      });

      await this.adminRepository.createAuditLog({
        adminId,
        action: 'report.resolve',
        targetType: 'report',
        targetId: reportId,
        metadata: {
          status,
          resolution,
          contentType: updatedReport.contentType,
          contentId: updatedReport.contentId,
        },
        ...(ipAddress ? { ipAddress } : {}),
      });

      console.log('[AdminService] Content report resolved successfully:', reportId);
      return updatedReport;
    } catch (error) {
      console.error('[AdminService] resolveContentReport failed:', error);
      throw error;
    }
  }

  /**
   * Manually release escrow for a transaction (dispute resolution)
   *
   * Business rules:
   * - Transaction must exist
   * - Escrow must be currently held
   * - Creates audit log
   *
   * @param adminId - Admin user ID performing the action
   * @param transactionId - Transaction ID
   * @param reason - Reason for manual release
   * @param ipAddress - Optional IP address of admin
   * @returns Updated transaction
   * @throws AdminValidationError if validation fails
   *
   * @example
   * await adminService.releaseEscrowManually('admin123', 'tx456', 'Resolved dispute in seller favor');
   */
  async releaseEscrowManually(
    adminId: string,
    transactionId: string,
    reason: string,
    ipAddress?: string
  ): Promise<Transaction> {
    console.log('[AdminService] releaseEscrowManually called:', {
      adminId,
      transactionId,
      reason,
    });

    if (!reason || reason.trim().length < 10) {
      throw new AdminValidationError('Release reason must be at least 10 characters');
    }

    try {
      const transaction =
        await this.transactionRepository.releaseEscrowManually(transactionId);

      await this.adminRepository.createAuditLog({
        adminId,
        action: 'transaction.escrow_release',
        targetType: 'transaction',
        targetId: transactionId,
        reason,
        metadata: {
          amountCents: transaction.amountCents,
          sellerId: transaction.sellerId,
          buyerId: transaction.buyerId,
          projectId: transaction.projectId,
        },
        ...(ipAddress ? { ipAddress } : {}),
      });

      console.log('[AdminService] Escrow released manually:', transactionId);
      return transaction;
    } catch (error) {
      console.error('[AdminService] releaseEscrowManually failed:', error);
      throw error;
    }
  }

  /**
   * Refund a transaction (admin-initiated)
   *
   * Business rules:
   * - Reason must be at least 10 characters
   * - Transaction must exist
   * - Transaction paymentStatus must be 'succeeded'
   * - Transaction escrowStatus must be 'held' or 'pending'
   * - Transaction must have a stripePaymentIntentId
   * - Calls Stripe refund FIRST, then updates DB atomically
   * - Creates audit log with action 'transaction.refund'
   * - Sends buyer email notification (non-blocking)
   *
   * @param adminId - Admin user ID performing the refund
   * @param transactionId - Transaction ID to refund
   * @param reason - Reason for refund (min 10 chars)
   * @param ipAddress - Optional IP address of admin
   * @returns Refunded transaction and optional warning
   */
  async refundTransaction(
    adminId: string,
    transactionId: string,
    reason: string,
    ipAddress?: string
  ): Promise<{ transaction: Transaction; warning?: string }> {
    console.log('[AdminService] refundTransaction called:', {
      adminId,
      transactionId,
      reason,
    });

    if (!reason || reason.trim().length < 10) {
      throw new AdminValidationError('Refund reason must be at least 10 characters');
    }

    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      throw new AdminValidationError('Transaction not found');
    }

    if (transaction.paymentStatus !== 'succeeded') {
      throw new AdminValidationError(
        'Transaction payment status must be succeeded to refund'
      );
    }

    if (transaction.escrowStatus !== 'held' && transaction.escrowStatus !== 'pending') {
      throw new AdminValidationError('Transaction escrow has already been released');
    }

    if (!transaction.stripePaymentIntentId) {
      throw new AdminValidationError('Transaction has no Stripe payment intent ID');
    }

    const codeAccessWarning =
      transaction.codeDeliveryStatus === 'accessed' || transaction.githubAccessGrantedAt
        ? 'Buyer has already received code access'
        : undefined;

    await this.stripeService.refundPayment(transaction.stripePaymentIntentId, reason);

    const refundedTransaction =
      await this.transactionRepository.markRefunded(transactionId);

    await this.adminRepository.createAuditLog({
      adminId,
      action: 'transaction.refund',
      targetType: 'transaction',
      targetId: transactionId,
      reason,
      metadata: {
        amountCents: transaction.amountCents,
        sellerId: transaction.sellerId,
        buyerId: transaction.buyerId,
        projectId: transaction.projectId,
        stripePaymentIntentId: transaction.stripePaymentIntentId,
        ...(codeAccessWarning ? { warning: codeAccessWarning } : {}),
      },
      ...(ipAddress ? { ipAddress } : {}),
    });

    try {
      const buyer = transaction.buyer;
      if (buyer?.email) {
        const refundData: RefundEmailData = {
          buyerName: buyer.fullName || buyer.username || 'Buyer',
          projectTitle: transaction.project?.title || 'Project',
          amountCents: transaction.amountCents,
          refundDate: new Date().toISOString(),
          transactionId: transaction.id,
          reason,
        };
        await this.emailService.sendRefundNotification(
          { email: buyer.email, name: refundData.buyerName },
          refundData
        );
      }
    } catch (emailError) {
      console.error('[AdminService] Failed to send refund email:', emailError);
    }

    console.log('[AdminService] Transaction refunded successfully:', transactionId);

    return {
      transaction: refundedTransaction,
      ...(codeAccessWarning ? { warning: codeAccessWarning } : {}),
    };
  }

  /**
   * Get escrow analytics
   *
   * Returns aggregated escrow metrics for the admin dashboard.
   *
   * @returns EscrowAnalytics object with counts and amounts
   */
  async getEscrowAnalytics(): Promise<EscrowAnalytics> {
    console.log('[AdminService] getEscrowAnalytics called');
    return this.adminRepository.getEscrowAnalytics();
  }
}
