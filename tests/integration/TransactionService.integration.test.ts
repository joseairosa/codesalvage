/**
 * TransactionService Integration Tests
 *
 * Tests transaction/payment business logic with real database operations.
 *
 * Prerequisites:
 * - Test database must be running: `npm run test:db:setup`
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanDatabase,
} from '@/tests/helpers/db';
import { createTestUser, createTestProject } from '@/tests/helpers/fixtures';
import { TransactionService } from '@/lib/services/TransactionService';
import { TransactionRepository } from '@/lib/repositories/TransactionRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { ProjectRepository } from '@/lib/repositories/ProjectRepository';
import { prisma } from '@/lib/prisma';

describe('TransactionService (Integration)', () => {
  let transactionService: TransactionService;
  let transactionRepository: TransactionRepository;
  let userRepository: UserRepository;
  let projectRepository: ProjectRepository;

  beforeAll(async () => {
    await setupTestDatabase();
    transactionRepository = new TransactionRepository(prisma);
    userRepository = new UserRepository(prisma);
    projectRepository = new ProjectRepository(prisma);
    transactionService = new TransactionService(
      transactionRepository,
      userRepository,
      projectRepository
    );
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('createTransaction', () => {
    it('should create transaction for active project', async () => {
      const seller = await createTestUser({ username: 'seller', isSeller: true });
      const buyer = await createTestUser({ username: 'buyer' });
      const project = await createTestProject({
        sellerId: seller.id,
        status: 'active',
        priceCents: 10000,
      });

      const transaction = await transactionService.createTransaction(buyer.id, {
        projectId: project.id,
        stripePaymentIntentId: 'pi_test123',
      });

      expect(transaction.id).toBeDefined();
      expect(transaction.projectId).toBe(project.id);
      expect(transaction.sellerId).toBe(seller.id);
      expect(transaction.buyerId).toBe(buyer.id);
      expect(transaction.amountCents).toBe(10000);
      expect(transaction.commissionCents).toBe(1800); // 18%
      expect(transaction.sellerReceivesCents).toBe(8200);
      expect(transaction.stripePaymentIntentId).toBe('pi_test123');

      // Verify in database
      const dbTransaction = await prisma.transaction.findUnique({
        where: { id: transaction.id },
      });
      expect(dbTransaction).toBeTruthy();
    });

    it('should calculate 18% commission correctly', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({
        sellerId: seller.id,
        status: 'active',
        priceCents: 100000, // $1000
      });

      const transaction = await transactionService.createTransaction(buyer.id, {
        projectId: project.id,
      });

      expect(transaction.commissionCents).toBe(18000); // 18% of 100000
      expect(transaction.sellerReceivesCents).toBe(82000); // 100000 - 18000
    });

    it('should set escrow release date to 7 days from now', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({
        sellerId: seller.id,
        status: 'active',
      });

      const transaction = await transactionService.createTransaction(buyer.id, {
        projectId: project.id,
      });

      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      // Check escrow release date is approximately 7 days from now (within 1 minute tolerance)
      const escrowDate = new Date(transaction.escrowReleaseDate!);
      const timeDiff = Math.abs(escrowDate.getTime() - sevenDaysFromNow.getTime());
      expect(timeDiff).toBeLessThan(60000); // Within 1 minute
    });

    it('should prevent buyer from purchasing own project', async () => {
      const seller = await createTestUser({ isSeller: true });
      const project = await createTestProject({
        sellerId: seller.id,
        status: 'active',
      });

      await expect(
        transactionService.createTransaction(seller.id, {
          projectId: project.id,
        })
      ).rejects.toThrow('Cannot purchase your own project');
    });

    it('should prevent purchasing inactive project', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({
        sellerId: seller.id,
        status: 'draft',
      });

      await expect(
        transactionService.createTransaction(buyer.id, {
          projectId: project.id,
        })
      ).rejects.toThrow('Project is not available for purchase');
    });

    it('should prevent duplicate purchases by same buyer', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({
        sellerId: seller.id,
        status: 'active',
      });

      // First purchase succeeds
      const transaction1 = await transactionService.createTransaction(buyer.id, {
        projectId: project.id,
      });

      // Update to succeeded payment
      await prisma.transaction.update({
        where: { id: transaction1.id },
        data: { paymentStatus: 'succeeded' },
      });

      // Second purchase fails
      await expect(
        transactionService.createTransaction(buyer.id, {
          projectId: project.id,
        })
      ).rejects.toThrow('You have already purchased this project');
    });
  });

  describe('getBuyerTransactions', () => {
    it('should get all transactions for buyer with pagination', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project1 = await createTestProject({ sellerId: seller.id, status: 'active' });
      const project2 = await createTestProject({ sellerId: seller.id, status: 'active' });

      await transactionService.createTransaction(buyer.id, {
        projectId: project1.id,
      });
      await transactionService.createTransaction(buyer.id, {
        projectId: project2.id,
      });

      const result = await transactionService.getBuyerTransactions(buyer.id);

      expect(result.transactions).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.transactions[0].buyerId).toBe(buyer.id);
    });
  });

  describe('getSellerTransactions', () => {
    it('should get all transactions for seller with pagination', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer1 = await createTestUser({ username: 'buyer1' });
      const buyer2 = await createTestUser({ username: 'buyer2' });
      const project = await createTestProject({ sellerId: seller.id, status: 'active' });

      await transactionService.createTransaction(buyer1.id, {
        projectId: project.id,
      });
      await transactionService.createTransaction(buyer2.id, {
        projectId: project.id,
      });

      const result = await transactionService.getSellerTransactions(seller.id);

      expect(result.transactions).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.transactions[0].sellerId).toBe(seller.id);
    });
  });

  describe('getTransactionById', () => {
    it('should allow buyer to view transaction', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id, status: 'active' });

      const created = await transactionService.createTransaction(buyer.id, {
        projectId: project.id,
      });

      const transaction = await transactionService.getTransactionById(
        created.id,
        buyer.id
      );

      expect(transaction.id).toBe(created.id);
      expect(transaction.buyerId).toBe(buyer.id);
    });

    it('should allow seller to view transaction', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id, status: 'active' });

      const created = await transactionService.createTransaction(buyer.id, {
        projectId: project.id,
      });

      const transaction = await transactionService.getTransactionById(
        created.id,
        seller.id
      );

      expect(transaction.id).toBe(created.id);
      expect(transaction.sellerId).toBe(seller.id);
    });

    it('should prevent unauthorized user from viewing transaction', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const randomUser = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id, status: 'active' });

      const transaction = await transactionService.createTransaction(buyer.id, {
        projectId: project.id,
      });

      await expect(
        transactionService.getTransactionById(transaction.id, randomUser.id)
      ).rejects.toThrow('You do not have access to this transaction');
    });
  });

  describe('releaseEscrow', () => {
    it('should release escrow for successful transaction', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id, status: 'active' });

      const transaction = await transactionService.createTransaction(buyer.id, {
        projectId: project.id,
      });

      // Update to succeeded payment
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { paymentStatus: 'succeeded', escrowStatus: 'held' },
      });

      await transactionService.releaseEscrow(transaction.id);

      const updated = await prisma.transaction.findUnique({
        where: { id: transaction.id },
      });

      expect(updated?.escrowStatus).toBe('released');
      expect(updated?.releasedToSellerAt).toBeTruthy();
    });

    it('should prevent releasing escrow for pending payment', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id, status: 'active' });

      const transaction = await transactionService.createTransaction(buyer.id, {
        projectId: project.id,
      });

      await expect(transactionService.releaseEscrow(transaction.id)).rejects.toThrow(
        'Cannot release escrow for unsuccessful payment'
      );
    });

    it('should skip if escrow already released', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id, status: 'active' });

      const transaction = await transactionService.createTransaction(buyer.id, {
        projectId: project.id,
      });

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          paymentStatus: 'succeeded',
          escrowStatus: 'released',
          releasedToSellerAt: new Date(),
        },
      });

      // Should not throw error
      await transactionService.releaseEscrow(transaction.id);

      // Verify still released
      const updated = await prisma.transaction.findUnique({
        where: { id: transaction.id },
      });
      expect(updated?.escrowStatus).toBe('released');
    });
  });

  describe('markCodeAccessed', () => {
    it('should allow buyer to mark code as accessed', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id, status: 'active' });

      const transaction = await transactionService.createTransaction(buyer.id, {
        projectId: project.id,
      });

      // Update to succeeded payment
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { paymentStatus: 'succeeded' },
      });

      await transactionService.markCodeAccessed(transaction.id, buyer.id);

      const updated = await prisma.transaction.findUnique({
        where: { id: transaction.id },
      });

      expect(updated?.codeAccessedAt).toBeTruthy();
      expect(updated?.codeDeliveryStatus).toBe('accessed');
    });

    it('should prevent seller from marking code as accessed', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id, status: 'active' });

      const transaction = await transactionService.createTransaction(buyer.id, {
        projectId: project.id,
      });

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { paymentStatus: 'succeeded' },
      });

      await expect(
        transactionService.markCodeAccessed(transaction.id, seller.id)
      ).rejects.toThrow('Only the buyer can access the code');
    });

    it('should prevent marking code accessed before successful payment', async () => {
      const seller = await createTestUser({ isSeller: true });
      const buyer = await createTestUser();
      const project = await createTestProject({ sellerId: seller.id, status: 'active' });

      const transaction = await transactionService.createTransaction(buyer.id, {
        projectId: project.id,
      });

      await expect(
        transactionService.markCodeAccessed(transaction.id, buyer.id)
      ).rejects.toThrow('Code cannot be accessed before successful payment');
    });
  });
});
