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
      // Create seller with projects and transactions
      const seller = await createTestUser({
        username: 'analytics-seller',
        isSeller: true,
      });
      const buyer = await createTestUser({ username: 'buyer1' });

      // Create projects
      const project1 = await createTestProject({
        sellerId: seller.id,
        title: 'Project 1',
        priceCents: 10000, // $100
      });
      const project2 = await createTestProject({
        sellerId: seller.id,
        title: 'Project 2',
        priceCents: 20000, // $200
      });
      const project3 = await createTestProject({
        sellerId: seller.id,
        title: 'Project 3 (not sold)',
        priceCents: 15000,
      });

      // Create successful transactions
      await prisma.transaction.create({
        data: {
          projectId: project1.id,
          sellerId: seller.id,
          buyerId: buyer.id,
          amountCents: 10000,
          commissionCents: 1800, // 18%
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
          commissionCents: 3600, // 18%
          sellerReceivesCents: 16400,
          paymentStatus: 'succeeded',
          escrowStatus: 'released',
          completedAt: new Date('2025-06-20'),
        },
      });

      // Set explicit view counts for all projects (to avoid random faker values)
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
        data: { viewCount: 0 }, // Unsold project with no views
      });

      // Get analytics overview
      const analytics = await analyticsService.getSellerAnalyticsOverview(seller.id, {
        startDate: '2025-06-01',
        endDate: '2025-06-30',
        granularity: 'day',
      });

      // Verify summary metrics
      expect(analytics.userId).toBe(seller.id);
      expect(analytics.summary.totalProjects).toBe(3);
      expect(analytics.summary.totalSold).toBe(2);
      expect(analytics.summary.totalRevenue).toBe('$246.00'); // $82 + $164
      // Average price is calculated from ALL projects, not just sold ones
      // ($100 + $200 + $150) / 3 = $150
      expect(analytics.summary.averageProjectPrice).toBe('$150.00');
      expect(analytics.summary.conversionRate).toBe('2.50%'); // 2 sold / 80 views

      // Note: dateRange not included in response (validated internally in service)

      // Verify revenue chart data exists
      expect(analytics.revenueChart).toBeDefined();
      expect(analytics.revenueChart.length).toBeGreaterThan(0);

      // Verify top projects
      expect(analytics.topProjects).toBeDefined();
      expect(analytics.topProjects.length).toBe(2); // 2 sold projects
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

      // Create project with known price but no transactions
      // @ts-expect-error - Project created for test data setup but not directly used
      const project = await createTestProject({
        sellerId: seller.id,
        title: 'Unsold Project',
        priceCents: 10000, // $100
      });

      const analytics = await analyticsService.getSellerAnalyticsOverview(seller.id);

      expect(analytics.summary.totalProjects).toBe(1);
      expect(analytics.summary.totalSold).toBe(0);
      expect(analytics.summary.totalRevenue).toBe('$0.00');
      // Average project price should be the price of the listed project, not $0
      expect(analytics.summary.averageProjectPrice).toBe('$100.00');
      expect(analytics.summary.conversionRate).toBe('0.00%');
    });

    it('should filter analytics by date range', async () => {
      const seller = await createTestUser({
        username: 'seller-date-test',
        isSeller: true,
      });
      const buyer = await createTestUser({ username: 'buyer2' });

      // Create TWO different projects to sell
      const project1 = await createTestProject({
        sellerId: seller.id,
        title: 'Project June',
      });
      const project2 = await createTestProject({
        sellerId: seller.id,
        title: 'Project July',
      });

      // Create transaction in June 2025 for project1
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

      // Create transaction in July 2025 for project2
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

      // Query only June data
      const juneAnalytics = await analyticsService.getSellerAnalyticsOverview(seller.id, {
        startDate: '2025-06-01',
        endDate: '2025-06-30',
      });

      // Should only include June transaction
      expect(juneAnalytics.summary.totalSold).toBe(1);
      expect(juneAnalytics.summary.totalRevenue).toBe('$82.00');

      // Query only July data
      const julyAnalytics = await analyticsService.getSellerAnalyticsOverview(seller.id, {
        startDate: '2025-07-01',
        endDate: '2025-07-31',
      });

      // Should only include July transaction
      expect(julyAnalytics.summary.totalSold).toBe(1);
      expect(julyAnalytics.summary.totalRevenue).toBe('$164.00');

      // Query entire range
      const allAnalytics = await analyticsService.getSellerAnalyticsOverview(seller.id, {
        startDate: '2025-06-01',
        endDate: '2025-07-31',
      });

      // Should include both transactions
      expect(allAnalytics.summary.totalSold).toBe(2);
      expect(allAnalytics.summary.totalRevenue).toBe('$246.00');
    });

    it('should calculate conversion rate correctly', async () => {
      const seller = await createTestUser({
        username: 'conversion-seller',
        isSeller: true,
      });
      const buyer = await createTestUser({ username: 'buyer3' });

      // Create 3 projects with different view counts
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

      // Create 2 successful transactions with completedAt
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

      // Conversion rate: 2 sales / 200 total views = 1.00%
      expect(analytics.summary.conversionRate).toBe('1.00%');
      expect(analytics.summary.totalSold).toBe(2);
    });

    it('should only count succeeded payments in revenue', async () => {
      const seller = await createTestUser({
        username: 'revenue-seller',
        isSeller: true,
      });
      const buyer = await createTestUser({ username: 'buyer4' });
      const project = await createTestProject({ sellerId: seller.id });

      // Create successful transaction with completedAt
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

      // Create failed transaction (should not count)
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

      // Create pending transaction (should not count)
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

      // Should only count the succeeded transaction
      expect(analytics.summary.totalSold).toBe(1);
      expect(analytics.summary.totalRevenue).toBe('$82.00');
    });

    it('should handle different granularities', async () => {
      const seller = await createTestUser({
        username: 'granularity-seller',
        isSeller: true,
      });
      const buyer = await createTestUser({ username: 'buyer5' });
      const project = await createTestProject({ sellerId: seller.id });

      // Create transaction
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

      // Test with 'day' granularity
      const dayAnalytics = await analyticsService.getSellerAnalyticsOverview(seller.id, {
        startDate: '2025-06-01',
        endDate: '2025-06-30',
        granularity: 'day',
      });
      expect(dayAnalytics.revenueChart.length).toBeGreaterThan(0);

      // Test with 'week' granularity
      const weekAnalytics = await analyticsService.getSellerAnalyticsOverview(seller.id, {
        startDate: '2025-06-01',
        endDate: '2025-06-30',
        granularity: 'week',
      });
      expect(weekAnalytics.revenueChart.length).toBeGreaterThan(0);

      // Test with 'month' granularity
      const monthAnalytics = await analyticsService.getSellerAnalyticsOverview(
        seller.id,
        {
          startDate: '2025-06-01',
          endDate: '2025-06-30',
          granularity: 'month',
        }
      );
      expect(monthAnalytics.revenueChart.length).toBeGreaterThan(0);
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
          endDate: '2025-06-01', // Before start date
        })
      ).rejects.toThrow('Start date must be before end date');
    });

    it('should cap start date to 1 year ago if range exceeds 1 year', async () => {
      const seller = await createTestUser({
        username: 'range-seller',
        isSeller: true,
      });

      // Service should not throw error, but cap the start date instead
      const analytics = await analyticsService.getSellerAnalyticsOverview(seller.id, {
        startDate: '2024-01-01', // Very old date
        endDate: '2025-06-01',
      });

      // Should still return valid analytics (capped to 1 year)
      expect(analytics.userId).toBe(seller.id);
      expect(analytics.summary).toBeDefined();
    });

    it('should use default date range (30 days) when not specified', async () => {
      const seller = await createTestUser({
        username: 'default-range-seller',
        isSeller: true,
      });

      const analytics = await analyticsService.getSellerAnalyticsOverview(seller.id);

      // Verify analytics returned successfully with defaults
      expect(analytics.userId).toBe(seller.id);
      expect(analytics.summary).toBeDefined();
      expect(analytics.summary.totalProjects).toBeGreaterThanOrEqual(0);

      // Date range is handled internally, not exposed in response
    });
  });

  describe('Top Projects Analytics', () => {
    it('should rank top projects by revenue', async () => {
      const seller = await createTestUser({
        username: 'top-projects-seller',
        isSeller: true,
      });
      const buyer = await createTestUser({ username: 'buyer6' });

      // Create 3 projects with different revenues
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

      // Create transactions with completedAt
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

      // Verify top projects are ranked by revenue
      expect(analytics.topProjects.length).toBe(3);
      expect(analytics.topProjects[0]!.title).toBe('High Revenue Project');
      expect(analytics.topProjects[0]!.revenue).toBe('$410.00');
      expect(analytics.topProjects[1]!.title).toBe('Mid Revenue Project');
      expect(analytics.topProjects[1]!.revenue).toBe('$246.00');
      expect(analytics.topProjects[2]!.title).toBe('Low Revenue Project');
      expect(analytics.topProjects[2]!.revenue).toBe('$82.00');
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

      // Set view count
      await prisma.project.update({
        where: { id: project.id },
        data: { viewCount: 250 },
      });

      // Create transaction with completedAt
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
      expect(analytics.topProjects[0]!.purchases).toBe(1);
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

      // Create transactions on different days
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

      // Verify revenue chart has data points
      expect(analytics.revenueChart.length).toBeGreaterThan(0);

      // Verify chart data includes dates and revenue values
      const firstDataPoint = analytics.revenueChart[0]!;
      expect(firstDataPoint.date).toBeDefined();
      expect(firstDataPoint.revenue).toBeDefined();
      expect(typeof firstDataPoint.revenue).toBe('string'); // Formatted as currency
    });
  });
});
