/**
 * DatabaseService - Singleton Prisma Client with Connection Pooling
 *
 * Responsibilities:
 * - Provide single Prisma Client instance (Singleton Pattern)
 * - Handle connection pooling for serverless environments
 * - Graceful error handling and logging
 * - Hot reload safe in development
 *
 * Architecture:
 * - Singleton pattern prevents multiple Prisma Client instances
 * - Global variable hack for development hot reload (Next.js specific)
 * - Production uses single instance
 */

import { PrismaClient } from '@prisma/client';
import { env } from '@/config/env';

/**
 * PrismaClient extension with custom logging
 */
const createPrismaClient = () => {
  return new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    errorFormat: env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
  });
};

/**
 * Extend global namespace for development hot reload
 * This prevents creating multiple Prisma Client instances during hot reload
 */
declare global {
  // eslint-disable-next-line no-var
  var prisma: ReturnType<typeof createPrismaClient> | undefined;
}

/**
 * Singleton Prisma Client instance
 *
 * In development: Uses global variable to survive hot reloads
 * In production: Creates single instance
 */
export const prisma = globalThis.prisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

/**
 * DatabaseService - Business logic wrapper for database operations
 *
 * Provides utility methods for common database operations with
 * proper error handling and logging.
 */
export class DatabaseService {
  private client: PrismaClient;

  constructor(client: PrismaClient = prisma) {
    this.client = client;
  }

  /**
   * Check database connection health
   *
   * @returns Promise<boolean> - true if database is connected
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      console.error('[DatabaseService] Health check failed:', error);
      return false;
    }
  }

  /**
   * Execute database operation with automatic retry logic
   *
   * Useful for handling transient database errors in serverless environments
   *
   * @param operation - Database operation to execute
   * @param maxRetries - Maximum number of retry attempts
   * @returns Result of the operation
   */
  async withRetry<T>(operation: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    let lastError: Error | unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(
          `[DatabaseService] Operation failed (attempt ${attempt}/${maxRetries}):`,
          error
        );

        if (attempt < maxRetries) {
          // Exponential backoff: 100ms, 200ms, 400ms
          const delayMs = 100 * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    throw lastError;
  }

  /**
   * Execute operation within a transaction
   *
   * Ensures ACID properties for multiple database operations
   *
   * @param callback - Transaction callback with Prisma client
   * @returns Result of the transaction
   */
  async transaction<T>(callback: (tx: PrismaClient) => Promise<T>): Promise<T> {
    try {
      return await this.client.$transaction(async (tx) => {
        // Type assertion needed because Prisma's transaction type is complex
        return await callback(tx as PrismaClient);
      });
    } catch (error) {
      console.error('[DatabaseService] Transaction failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from database
   *
   * Should be called when shutting down the application
   */
  async disconnect(): Promise<void> {
    await this.client.$disconnect();
  }

  /**
   * Get raw Prisma client for advanced operations
   *
   * Use sparingly - prefer using repository classes for data access
   */
  getClient(): PrismaClient {
    return this.client;
  }
}

/**
 * Singleton DatabaseService instance
 */
export const db = new DatabaseService(prisma);
