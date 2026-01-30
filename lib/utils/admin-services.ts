/**
 * Admin Services Initializer
 *
 * Centralized initialization of admin-related services to avoid code duplication.
 * Following DRY (Don't Repeat Yourself) and SRP (Single Responsibility Principle).
 *
 * Responsibilities:
 * - Initialize all repositories required for admin operations
 * - Initialize AdminService with proper dependency injection
 * - Provide singleton instances for performance
 *
 * @example
 * import { getAdminService } from '@/lib/utils/admin-services';
 * const adminService = getAdminService();
 * const stats = await adminService.getPlatformStats();
 */

import { prisma } from '@/lib/prisma';
import {
  AdminRepository,
  UserRepository,
  ProjectRepository,
  TransactionRepository,
} from '@/lib/repositories';
import { AdminService, emailService } from '@/lib/services';

// Singleton instances (initialized once, reused across requests)
let adminServiceInstance: AdminService | null = null;
let adminRepositoryInstance: AdminRepository | null = null;
let userRepositoryInstance: UserRepository | null = null;
let projectRepositoryInstance: ProjectRepository | null = null;
let transactionRepositoryInstance: TransactionRepository | null = null;

/**
 * Get AdminRepository instance (singleton)
 *
 * @returns AdminRepository instance
 */
export function getAdminRepository(): AdminRepository {
  if (!adminRepositoryInstance) {
    adminRepositoryInstance = new AdminRepository(prisma);
  }
  return adminRepositoryInstance;
}

/**
 * Get UserRepository instance (singleton)
 *
 * @returns UserRepository instance
 */
export function getUserRepository(): UserRepository {
  if (!userRepositoryInstance) {
    userRepositoryInstance = new UserRepository(prisma);
  }
  return userRepositoryInstance;
}

/**
 * Get ProjectRepository instance (singleton)
 *
 * @returns ProjectRepository instance
 */
export function getProjectRepository(): ProjectRepository {
  if (!projectRepositoryInstance) {
    projectRepositoryInstance = new ProjectRepository(prisma);
  }
  return projectRepositoryInstance;
}

/**
 * Get TransactionRepository instance (singleton)
 *
 * @returns TransactionRepository instance
 */
export function getTransactionRepository(): TransactionRepository {
  if (!transactionRepositoryInstance) {
    transactionRepositoryInstance = new TransactionRepository(prisma);
  }
  return transactionRepositoryInstance;
}

/**
 * Get AdminService instance (singleton)
 *
 * Initializes AdminService with all required repository dependencies.
 *
 * @returns AdminService instance
 */
export function getAdminService(): AdminService {
  if (!adminServiceInstance) {
    adminServiceInstance = new AdminService(
      getAdminRepository(),
      getUserRepository(),
      getProjectRepository(),
      getTransactionRepository(),
      emailService
    );
  }
  return adminServiceInstance;
}
