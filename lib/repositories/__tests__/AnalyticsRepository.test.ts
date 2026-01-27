/**
 * AnalyticsRepository Unit Tests
 *
 * Tests for seller analytics data access layer.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { AnalyticsRepository } from '../AnalyticsRepository';

// Mock Prisma Client
const mockPrismaClient = {
  project: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  transaction: {
    findMany: vi.fn(),
  },
} as unknown as PrismaClient;

describe('AnalyticsRepository', () => {
  let analyticsRepository: AnalyticsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    analyticsRepository = new AnalyticsRepository(mockPrismaClient);
  });

  describe('getSellerRevenueSummary', () => {
    it('should calculate revenue summary correctly', async () => {
      const sellerId = 'seller123';

      // Mock project count
      vi.mocked(mockPrismaClient.project.count).mockResolvedValue(5);

      // Mock transactions
      vi.mocked(mockPrismaClient.transaction.findMany).mockResolvedValue([
        {
          id: 'tx1',
          projectId: 'proj1',
          sellerReceivesCents: 8200,
        },
        {
          id: 'tx2',
          projectId: 'proj2',
          sellerReceivesCents: 16400,
        },
        {
          id: 'tx3',
          projectId: 'proj1', // Duplicate project (should count as 1 sale)
          sellerReceivesCents: 8200,
        },
      ] as any);

      // Mock projects for view count
      vi.mocked(mockPrismaClient.project.findMany).mockResolvedValue([
        { viewCount: 100, priceCents: 10000 },
        { viewCount: 200, priceCents: 20000 },
        { viewCount: 50, priceCents: 15000 },
        { viewCount: 75, priceCents: 12000 },
        { viewCount: 125, priceCents: 8000 },
      ] as any);

      const result = await analyticsRepository.getSellerRevenueSummary(sellerId);

      expect(result.totalProjects).toBe(5);
      expect(result.totalSold).toBe(2); // 2 unique projects sold
      expect(result.totalRevenueCents).toBe(32800); // 8200 + 16400 + 8200
      expect(result.averageProjectPriceCents).toBe(13000); // (10000+20000+15000+12000+8000)/5
      expect(result.conversionRate).toBeCloseTo(0.0036, 4); // 2 sales / 550 views
    });

    it('should handle zero transactions', async () => {
      vi.mocked(mockPrismaClient.project.count).mockResolvedValue(3);
      vi.mocked(mockPrismaClient.transaction.findMany).mockResolvedValue([]);
      vi.mocked(mockPrismaClient.project.findMany).mockResolvedValue([
        { viewCount: 100, priceCents: 10000 },
        { viewCount: 200, priceCents: 20000 },
        { viewCount: 50, priceCents: 15000 },
      ] as any);

      const result = await analyticsRepository.getSellerRevenueSummary('seller123');

      expect(result.totalProjects).toBe(3);
      expect(result.totalSold).toBe(0);
      expect(result.totalRevenueCents).toBe(0);
      expect(result.conversionRate).toBe(0);
    });

    it('should handle zero views', async () => {
      vi.mocked(mockPrismaClient.project.count).mockResolvedValue(2);
      vi.mocked(mockPrismaClient.transaction.findMany).mockResolvedValue([
        { id: 'tx1', projectId: 'proj1', sellerReceivesCents: 8200 },
      ] as any);
      vi.mocked(mockPrismaClient.project.findMany).mockResolvedValue([
        { viewCount: 0, priceCents: 10000 },
        { viewCount: 0, priceCents: 20000 },
      ] as any);

      const result = await analyticsRepository.getSellerRevenueSummary('seller123');

      expect(result.conversionRate).toBe(0); // 0 views = 0 conversion
    });

    it('should apply date range filter', async () => {
      const dateRange = {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
      };

      vi.mocked(mockPrismaClient.project.count).mockResolvedValue(2);
      vi.mocked(mockPrismaClient.transaction.findMany).mockResolvedValue([
        { id: 'tx1', projectId: 'proj1', sellerReceivesCents: 8200 },
      ] as any);
      vi.mocked(mockPrismaClient.project.findMany).mockResolvedValue([
        { viewCount: 100, priceCents: 10000 },
        { viewCount: 200, priceCents: 20000 },
      ] as any);

      await analyticsRepository.getSellerRevenueSummary('seller123', dateRange);

      // Verify date range was passed to queries
      expect(mockPrismaClient.project.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: dateRange.startDate,
              lte: dateRange.endDate,
            },
          }),
        })
      );
    });
  });

  describe('getRevenueOverTime', () => {
    it('should aggregate revenue by day', async () => {
      const dateRange = {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
      };

      vi.mocked(mockPrismaClient.transaction.findMany).mockResolvedValue([
        {
          completedAt: new Date('2026-01-10'),
          sellerReceivesCents: 8200,
        },
        {
          completedAt: new Date('2026-01-10'), // Same day
          sellerReceivesCents: 16400,
        },
        {
          completedAt: new Date('2026-01-15'),
          sellerReceivesCents: 12000,
        },
      ] as any);

      const result = await analyticsRepository.getRevenueOverTime(
        'seller123',
        dateRange,
        'day'
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '2026-01-10',
        revenueCents: 24600, // 8200 + 16400
        transactionCount: 2,
      });
      expect(result[1]).toEqual({
        date: '2026-01-15',
        revenueCents: 12000,
        transactionCount: 1,
      });
    });

    it('should sort results by date ascending', async () => {
      const dateRange = {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
      };

      vi.mocked(mockPrismaClient.transaction.findMany).mockResolvedValue([
        {
          completedAt: new Date('2026-01-20'),
          sellerReceivesCents: 8200,
        },
        {
          completedAt: new Date('2026-01-05'),
          sellerReceivesCents: 16400,
        },
        {
          completedAt: new Date('2026-01-15'),
          sellerReceivesCents: 12000,
        },
      ] as any);

      const result = await analyticsRepository.getRevenueOverTime(
        'seller123',
        dateRange,
        'day'
      );

      expect(result[0].date).toBe('2026-01-05');
      expect(result[1].date).toBe('2026-01-15');
      expect(result[2].date).toBe('2026-01-20');
    });

    it('should return empty array when no transactions', async () => {
      const dateRange = {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
      };

      vi.mocked(mockPrismaClient.transaction.findMany).mockResolvedValue([]);

      const result = await analyticsRepository.getRevenueOverTime('seller123', dateRange);

      expect(result).toEqual([]);
    });
  });

  describe('getTopProjects', () => {
    it('should return projects sorted by revenue', async () => {
      vi.mocked(mockPrismaClient.project.findMany).mockResolvedValue([
        {
          id: 'proj1',
          title: 'Project 1',
          viewCount: 100,
          favoriteCount: 10,
          transactions: [{ sellerReceivesCents: 8200 }, { sellerReceivesCents: 8200 }],
        },
        {
          id: 'proj2',
          title: 'Project 2',
          viewCount: 200,
          favoriteCount: 20,
          transactions: [{ sellerReceivesCents: 16400 }],
        },
        {
          id: 'proj3',
          title: 'Project 3',
          viewCount: 50,
          favoriteCount: 5,
          transactions: [
            { sellerReceivesCents: 8200 },
            { sellerReceivesCents: 8200 },
            { sellerReceivesCents: 8200 },
          ],
        },
      ] as any);

      const result = await analyticsRepository.getTopProjects('seller123', 10);

      expect(result).toHaveLength(3);
      // Highest revenue first
      expect(result[0].projectId).toBe('proj3'); // 24600
      expect(result[0].revenueCents).toBe(24600);
      expect(result[0].purchaseCount).toBe(3);
      expect(result[1].projectId).toBe('proj1'); // 16400
      expect(result[2].projectId).toBe('proj2'); // 16400
    });

    it('should calculate conversion rate correctly', async () => {
      vi.mocked(mockPrismaClient.project.findMany).mockResolvedValue([
        {
          id: 'proj1',
          title: 'Project 1',
          viewCount: 100,
          favoriteCount: 10,
          transactions: [{ sellerReceivesCents: 8200 }],
        },
      ] as any);

      const result = await analyticsRepository.getTopProjects('seller123', 10);

      expect(result[0].conversionRate).toBeCloseTo(0.01, 4); // 1 sale / 100 views = 1%
    });

    it('should limit results to specified count', async () => {
      const projects = Array.from({ length: 20 }, (_, i) => ({
        id: `proj${i}`,
        title: `Project ${i}`,
        viewCount: 100,
        favoriteCount: 10,
        transactions: [{ sellerReceivesCents: 8200 }],
      }));

      vi.mocked(mockPrismaClient.project.findMany).mockResolvedValue(projects as any);

      const result = await analyticsRepository.getTopProjects('seller123', 5);

      expect(result).toHaveLength(5);
    });

    it('should handle projects with zero views', async () => {
      vi.mocked(mockPrismaClient.project.findMany).mockResolvedValue([
        {
          id: 'proj1',
          title: 'Project 1',
          viewCount: 0,
          favoriteCount: 5,
          transactions: [{ sellerReceivesCents: 8200 }],
        },
      ] as any);

      const result = await analyticsRepository.getTopProjects('seller123', 10);

      expect(result[0].conversionRate).toBe(0); // 0 views = 0 conversion
    });
  });

  describe('getSellerAnalyticsOverview', () => {
    it('should return complete analytics overview', async () => {
      const dateRange = {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
      };

      // Mock all queries
      vi.mocked(mockPrismaClient.project.count).mockResolvedValue(5);
      vi.mocked(mockPrismaClient.transaction.findMany)
        .mockResolvedValueOnce([
          {
            id: 'tx1',
            projectId: 'proj1',
            sellerReceivesCents: 8200,
            completedAt: new Date('2026-01-10'),
          },
        ] as any)
        .mockResolvedValueOnce([
          {
            id: 'tx2',
            completedAt: new Date('2026-01-10'),
            sellerReceivesCents: 8200,
          },
        ] as any);

      vi.mocked(mockPrismaClient.project.findMany)
        .mockResolvedValueOnce([
          { viewCount: 100, priceCents: 10000, transactions: [] },
        ] as any)
        .mockResolvedValueOnce([
          {
            id: 'proj1',
            title: 'Project 1',
            viewCount: 100,
            favoriteCount: 10,
            transactions: [{ sellerReceivesCents: 8200 }],
          },
        ] as any);

      const result = await analyticsRepository.getSellerAnalyticsOverview(
        'seller123',
        dateRange
      );

      expect(result.userId).toBe('seller123');
      expect(result.summary).toBeDefined();
      expect(result.revenueOverTime).toBeDefined();
      expect(result.topProjects).toBeDefined();
    });
  });
});
