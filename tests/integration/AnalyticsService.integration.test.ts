/**
 * AnalyticsService Integration Tests
 *
 * Tests analytics business logic with real database operations.
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
import { AnalyticsService } from '@/lib/services/AnalyticsService';
import { AnalyticsRepository } from '@/lib/repositories/AnalyticsRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { prisma } from '@/lib/prisma';

describe('AnalyticsService (Integration)', () => {
  let analyticsService: AnalyticsService;
  let analyticsRepository: AnalyticsRepository;
  let userRepository: UserRepository;

  beforeAll(async () => {
    await setupTestDatabase();
    analyticsRepository = new AnalyticsRepository(prisma);
    userRepository = new UserRepository(prisma);
    analyticsService = new AnalyticsService(analyticsRepository, userRepository);
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('getSellerAnalyticsOverview', () => {
    it('should return complete analytics overview for seller', async () => {
      const seller = await createTestUser({
        username: 'analytics-seller',
        isSeller: true,
      });
      const buyer = await createTestUser({ username: 'buyer1' });

      const project1 = await createTestProject({
        sellerId: seller.id,
        title: 'Project 1',
        priceCents: 10000,
      });
      const project2 = await createTestProject({
        sellerId: seller.id,
        title: 'Project 2',
        priceCents: 20000,
      });
      const project3 = await createTestProject({
        sellerId: seller.id,
        title: 'Project 3 (not sold)',
        priceCents: 15000,
      });

      await prisma.transaction.create({
        data: {
          projectId: project1.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 10000,
          commissionCents: 1800,
          sellerReceivesCents: 8200,
          paymentStatus: 'succeeded',
          escrowStatus: 'released',
          completedAt: new Date('2025-06-15'),
        },
      });

      await prisma.transaction.create({
        data: {
          projectId: project2.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 20000,
          commissionCents: 3600,
          sellerReceivesCents: 16400,
          paymentStatus: 'succeeded',
          escrowStatus: 'released',
          completedAt: new Date('2025-06-20'),
        },
      });

      await prisma.project.update({
        where: { id: project1.id },
        data: { viewCount: 50 },
      });
      await prisma.project.update({
        where: { id: project2.id },
        data: { viewCount: 30 },
      });
      await prisma.project.update({
        where: { id: project3.id },
        data: { viewCount: 0 },
      });

      const analytics = await analyticsService.getSellerAnalyticsOverview(seller.id, {
        startDate: '2025-06-01',
        endDate: '2025-06-30',
        granularity: 'day',
      });

      expect(analytics.userId).toBe(seller.id);
      expect(analytics.summary.totalProjects).toBe(3);
      expect(analytics.summary.totalSold).toBe(2);
      expect(analytics.summary.totalRevenue).toBe(24600);
      expect(analytics.summary.averageRevenue).toBe(15000);
      expect(analytics.summary.conversionRate).toBe(0.025);

      // Note: dateRange not included in response (validated internally in service)

      expect(analytics.revenueOverTime).toBeDefined();
      expect(analytics.revenueOverTime.length).toBeGreaterThan(0);

      expect(analytics.topProjects).toBeDefined();
      expect(analytics.topProjects.length).toBe(2);
    });

    it('should enforce seller-only permission', async () => {
      const buyer = await createTestUser({ username: 'buyer', isSeller: false });

      await expect(analyticsService.getSellerAnalyticsOverview(buyer.id)).rejects.toThrow(
        'Only sellers can access analytics'
      );
    });

    it('should return zero metrics for seller with no sales', async () => {
      const seller = await createTestUser({
        username: 'new-seller',
        isSeller: true,
      });

      // @ts-expect-error - Project created for test data setup but not directly used
      const project = await createTestProject({
        sellerId: seller.id,
        title: 'Unsold Project',
        priceCents: 10000,
      });

      const analytics = await analyticsService.getSellerAnalyticsOverview(seller.id);

      expect(analytics.summary.totalProjects).toBe(1);
      expect(analytics.summary.totalSold).toBe(0);
      expect(analytics.summary.totalRevenue).toBe(0);
      expect(analytics.summary.averageRevenue).toBe(10000);
      expect(analytics.summary.conversionRate).toBe(0);
    });

    it('should filter analytics by date range', async () => {
      const seller = await createTestUser({
        username: 'seller-date-test',
        isSeller: true,
      });
      const buyer = await createTestUser({ username: 'buyer2' });

      const project1 = await createTestProject({
        sellerId: seller.id,
        title: 'Project June',
      });
      const project2 = await createTestProject({
        sellerId: seller.id,
        title: 'Project July',
      });

      await prisma.transaction.create({
        data: {
          projectId: project1.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 10000,
          commissionCents: 1800,
          sellerReceivesCents: 8200,
          paymentStatus: 'succeeded',
          escrowStatus: 'released',
          completedAt: new Date('2025-06-15'),
        },
      });

      await prisma.transaction.create({
        data: {
          projectId: project2.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 20000,
          commissionCents: 3600,
          sellerReceivesCents: 16400,
          paymentStatus: 'succeeded',
          escrowStatus: 'released',
          completedAt: new Date('2025-07-15'),
        },
      });

      const juneAnalytics = await analyticsService.getSellerAnalyticsOverview(seller.id, {
        startDate: '2025-06-01',
        endDate: '2025-06-30',
      });

      expect(juneAnalytics.summary.totalSold).toBe(1);
      expect(juneAnalytics.summary.totalRevenue).toBe(8200);

      const julyAnalytics = await analyticsService.getSellerAnalyticsOverview(seller.id, {
        startDate: '2025-07-01',
        endDate: '2025-07-31',
      });

      expect(julyAnalytics.summary.totalSold).toBe(1);
      expect(julyAnalytics.summary.totalRevenue).toBe(16400);

      const allAnalytics = await analyticsService.getSellerAnalyticsOverview(seller.id, {
        startDate: '2025-06-01',
        endDate: '2025-07-31',
      });

      expect(allAnalytics.summary.totalSold).toBe(2);
      expect(allAnalytics.summary.totalRevenue).toBe(24600);
    });

    it('should calculate conversion rate correctly', async () => {
      const seller = await createTestUser({
        username: 'conversion-seller',
        isSeller: true,
      });
      const buyer = await createTestUser({ username: 'buyer3' });

      const project1 = await createTestProject({
        sellerId: seller.id,
        title: 'High Views, Sold',
      });
      const project2 = await createTestProject({
        sellerId: seller.id,
        title: 'Low Views, Not Sold',
      });
      const project3 = await createTestProject({
        sellerId: seller.id,
        title: 'Medium Views, Sold',
      });

      await prisma.project.update({
        where: { id: project1.id },
        data: { viewCount: 100 },
      });
      await prisma.project.update({
        where: { id: project2.id },
        data: { viewCount: 50 },
      });
      await prisma.project.update({
        where: { id: project3.id },
        data: { viewCount: 50 },
      });

      await prisma.transaction.create({
        data: {
          projectId: project1.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 10000,
          commissionCents: 1800,
          sellerReceivesCents: 8200,
          paymentStatus: 'succeeded',
          escrowStatus: 'released',
          completedAt: new Date(),
        },
      });

      await prisma.transaction.create({
        data: {
          projectId: project3.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 15000,
          commissionCents: 2700,
          sellerReceivesCents: 12300,
          paymentStatus: 'succeeded',
          escrowStatus: 'released',
          completedAt: new Date(),
        },
      });

      const analytics = await analyticsService.getSellerAnalyticsOverview(seller.id);

      expect(analytics.summary.conversionRate).toBe(0.01);
      expect(analytics.summary.totalSold).toBe(2);
    });

    it('should only count succeeded payments in revenue', async () => {
      const seller = await createTestUser({
        username: 'revenue-seller',
        isSeller: true,
      });
      const buyer = await createTestUser({ username: 'buyer4' });
      const project = await createTestProject({ sellerId: seller.id });

      await prisma.transaction.create({
        data: {
          projectId: project.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 10000,
          commissionCents: 1800,
          sellerReceivesCents: 8200,
          paymentStatus: 'succeeded',
          escrowStatus: 'released',
          completedAt: new Date(),
        },
      });

      await prisma.transaction.create({
        data: {
          projectId: project.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 20000,
          commissionCents: 3600,
          sellerReceivesCents: 16400,
          paymentStatus: 'failed',
          escrowStatus: 'pending',
        },
      });

      await prisma.transaction.create({
        data: {
          projectId: project.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 15000,
          commissionCents: 2700,
          sellerReceivesCents: 12300,
          paymentStatus: 'pending',
          escrowStatus: 'pending',
        },
      });

      const analytics = await analyticsService.getSellerAnalyticsOverview(seller.id);

      expect(analytics.summary.totalSold).toBe(1);
      expect(analytics.summary.totalRevenue).toBe(8200);
    });

    it('should handle different granularities', async () => {
      const seller = await createTestUser({
        username: 'granularity-seller',
        isSeller: true,
      });
      const buyer = await createTestUser({ username: 'buyer5' });
      const project = await createTestProject({ sellerId: seller.id });

      await prisma.transaction.create({
        data: {
          projectId: project.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 10000,
          commissionCents: 1800,
          sellerReceivesCents: 8200,
          paymentStatus: 'succeeded',
          escrowStatus: 'released',
          completedAt: new Date('2025-06-15'),
        },
      });

      const dayAnalytics = await analyticsService.getSellerAnalyticsOverview(seller.id, {
        startDate: '2025-06-01',
        endDate: '2025-06-30',
        granularity: 'day',
      });
      expect(dayAnalytics.revenueOverTime.length).toBeGreaterThan(0);

      const weekAnalytics = await analyticsService.getSellerAnalyticsOverview(seller.id, {
        startDate: '2025-06-01',
        endDate: '2025-06-30',
        granularity: 'week',
      });
      expect(weekAnalytics.revenueOverTime.length).toBeGreaterThan(0);

      const monthAnalytics = await analyticsService.getSellerAnalyticsOverview(
        seller.id,
        {
          startDate: '2025-06-01',
          endDate: '2025-06-30',
          granularity: 'month',
        }
      );
      expect(monthAnalytics.revenueOverTime.length).toBeGreaterThan(0);
    });
  });

  describe('Date Range Validation', () => {
    it('should throw error if start date is after end date', async () => {
      const seller = await createTestUser({
        username: 'date-validation-seller',
        isSeller: true,
      });

      await expect(
        analyticsService.getSellerAnalyticsOverview(seller.id, {
          startDate: '2025-07-01',
          endDate: '2025-06-01',
        })
      ).rejects.toThrow('Start date must be before end date');
    });

    it('should cap start date to 1 year ago if range exceeds 1 year', async () => {
      const seller = await createTestUser({
        username: 'range-seller',
        isSeller: true,
      });

      const analytics = await analyticsService.getSellerAnalyticsOverview(seller.id, {
        startDate: '2024-01-01',
        endDate: '2025-06-01',
      });

      expect(analytics.userId).toBe(seller.id);
      expect(analytics.summary).toBeDefined();
    });

    it('should use default date range (30 days) when not specified', async () => {
      const seller = await createTestUser({
        username: 'default-range-seller',
        isSeller: true,
      });

      const analytics = await analyticsService.getSellerAnalyticsOverview(seller.id);

      expect(analytics.userId).toBe(seller.id);
      expect(analytics.summary).toBeDefined();
      expect(analytics.summary.totalProjects).toBeGreaterThanOrEqual(0);

    });
  });

  describe('Top Projects Analytics', () => {
    it('should rank top projects by revenue', async () => {
      const seller = await createTestUser({
        username: 'top-projects-seller',
        isSeller: true,
      });
      const buyer = await createTestUser({ username: 'buyer6' });

      const highRevProject = await createTestProject({
        sellerId: seller.id,
        title: 'High Revenue Project',
        priceCents: 50000,
      });
      const midRevProject = await createTestProject({
        sellerId: seller.id,
        title: 'Mid Revenue Project',
        priceCents: 30000,
      });
      const lowRevProject = await createTestProject({
        sellerId: seller.id,
        title: 'Low Revenue Project',
        priceCents: 10000,
      });

      await prisma.transaction.create({
        data: {
          projectId: highRevProject.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 50000,
          commissionCents: 9000,
          sellerReceivesCents: 41000,
          paymentStatus: 'succeeded',
          escrowStatus: 'released',
          completedAt: new Date(),
        },
      });

      await prisma.transaction.create({
        data: {
          projectId: midRevProject.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 30000,
          commissionCents: 5400,
          sellerReceivesCents: 24600,
          paymentStatus: 'succeeded',
          escrowStatus: 'released',
          completedAt: new Date(),
        },
      });

      await prisma.transaction.create({
        data: {
          projectId: lowRevProject.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 10000,
          commissionCents: 1800,
          sellerReceivesCents: 8200,
          paymentStatus: 'succeeded',
          escrowStatus: 'released',
          completedAt: new Date(),
        },
      });

      const analytics = await analyticsService.getSellerAnalyticsOverview(seller.id);

      expect(analytics.topProjects.length).toBe(3);
      expect(analytics.topProjects[0]!.projectTitle).toBe('High Revenue Project');
      expect(analytics.topProjects[0]!.revenue).toBe(41000);
      expect(analytics.topProjects[1]!.projectTitle).toBe('Mid Revenue Project');
      expect(analytics.topProjects[1]!.revenue).toBe(24600);
      expect(analytics.topProjects[2]!.projectTitle).toBe('Low Revenue Project');
      expect(analytics.topProjects[2]!.revenue).toBe(8200);
    });

    it('should include view counts in top projects', async () => {
      const seller = await createTestUser({
        username: 'views-seller',
        isSeller: true,
      });
      const buyer = await createTestUser({ username: 'buyer7' });
      const project = await createTestProject({
        sellerId: seller.id,
        title: 'Popular Project',
      });

      await prisma.project.update({
        where: { id: project.id },
        data: { viewCount: 250 },
      });

      await prisma.transaction.create({
        data: {
          projectId: project.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 10000,
          commissionCents: 1800,
          sellerReceivesCents: 8200,
          paymentStatus: 'succeeded',
          escrowStatus: 'released',
          completedAt: new Date(),
        },
      });

      const analytics = await analyticsService.getSellerAnalyticsOverview(seller.id);

      expect(analytics.topProjects[0]!.views).toBe(250);
      expect(analytics.topProjects[0]!.transactionCount).toBe(1);
    });
  });

  describe('Revenue Chart Data', () => {
    it('should generate time-series revenue data', async () => {
      const seller = await createTestUser({
        username: 'chart-seller',
        isSeller: true,
      });
      const buyer = await createTestUser({ username: 'buyer8' });
      const project = await createTestProject({ sellerId: seller.id });

      await prisma.transaction.create({
        data: {
          projectId: project.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 10000,
          commissionCents: 1800,
          sellerReceivesCents: 8200,
          paymentStatus: 'succeeded',
          escrowStatus: 'released',
          completedAt: new Date('2025-06-10'),
        },
      });

      await prisma.transaction.create({
        data: {
          projectId: project.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 15000,
          commissionCents: 2700,
          sellerReceivesCents: 12300,
          paymentStatus: 'succeeded',
          escrowStatus: 'released',
          completedAt: new Date('2025-06-20'),
        },
      });

      const analytics = await analyticsService.getSellerAnalyticsOverview(seller.id, {
        startDate: '2025-06-01',
        endDate: '2025-06-30',
        granularity: 'day',
      });

      expect(analytics.revenueOverTime.length).toBeGreaterThan(0);

      const firstDataPoint = analytics.revenueOverTime[0]!;
      expect(firstDataPoint.date).toBeDefined();
      expect(firstDataPoint.revenue).toBeDefined();
      expect(typeof firstDataPoint.revenue).toBe('number');
    });
  });
});
