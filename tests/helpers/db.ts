/**
 * Database Test Helpers
 *
 * Utilities for managing test database state and transactions.
 *
 * Usage:
 * ```typescript
 * import { setupTestDatabase, cleanDatabase } from '@/tests/helpers/db';
 *
 * beforeAll(async () => {
 *   await setupTestDatabase();
 * });
 *
 * beforeEach(async () => {
 *   await cleanDatabase();
 * });
 * ```
 */

import { prisma } from '@/lib/prisma';

/**
 * Setup test database connection
 * Verifies connection is working
 */
export async function setupTestDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('[TestDB] Connected to test database');
  } catch (error) {
    console.error('[TestDB] Failed to connect to test database:', error);
    throw new Error(
      'Test database not available. Run `npm run test:db:setup` before running tests.'
    );
  }
}

/**
 * Disconnect from test database
 * Call this in afterAll() hooks
 */
export async function teardownTestDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log('[TestDB] Disconnected from test database');
}

/**
 * Clean all data from test database
 * Maintains schema but removes all records
 *
 * IMPORTANT: Call this in beforeEach() to ensure test isolation
 */
export async function cleanDatabase(): Promise<void> {
  // Disable foreign key checks temporarily for faster cleanup
  await prisma.$executeRawUnsafe('SET session_replication_role = replica;');

  // Delete data from all tables in dependency order
  const tables = [
    'seller_analytics',
    'favorites',
    'messages',
    'reviews',
    'transactions',
    'projects',
    'accounts',
    'sessions',
    'verification_tokens',
    'users',
  ];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
  }

  // Re-enable foreign key checks
  await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT;');
}

/**
 * Start a database transaction for test isolation
 * Use with withTransaction() helper for automatic rollback
 *
 * @example
 * ```typescript
 * it('should create user', async () => {
 *   await withTransaction(async (tx) => {
 *     const user = await tx.user.create({ data: { ... } });
 *     expect(user).toBeDefined();
 *     // Automatic rollback after test
 *   });
 * });
 * ```
 */
export async function withTransaction<T>(
  callback: (tx: typeof prisma) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(async (tx) => {
    return await callback(tx as typeof prisma);
  });
}

/**
 * Reset database sequences
 * Useful when you need predictable IDs in tests
 */
export async function resetSequences(): Promise<void> {
  // PostgreSQL doesn't use sequences for CUID/ULID primary keys
  // This is here for completeness if we add any serial columns later
  console.log('[TestDB] Sequence reset not needed (using CUID primary keys)');
}

/**
 * Check if test database is available
 * Returns true if connection works, false otherwise
 */
export async function isTestDatabaseAvailable(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/**
 * Get count of records in a table
 * Useful for assertions
 */
export async function getTableCount(tableName: string): Promise<number> {
  const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM "${tableName}"`
  );
  return Number(result[0].count);
}
