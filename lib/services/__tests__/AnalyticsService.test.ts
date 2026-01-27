/**
 * AnalyticsService Unit Tests
 *
 * Tests business logic for seller analytics operations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AnalyticsService,
  AnalyticsPermissionError,
  AnalyticsValidationError,
} from '../AnalyticsService';
import type { AnalyticsRepository } from '../../repositories/AnalyticsRepository';
import type { UserRepository } from '../../repositories/UserRepository';

// Mock repositories
const mockAnalyticsRepository = {
  getSellerRevenueSummary: vi.fn(),
  getRevenueOverTime: vi.fn(),
  getTopProjects: vi.fn(),
  getSellerAnalyticsOverview: vi.fn(),
} as unknown as AnalyticsRepository;

const mockUserRepository = {
  findById: vi.fn(),
} as unknown as UserRepository;

// Mock user data
const createMockUser = (overrides = {}) => ({
  id: 'user123',
  email: 'test@example.com',
  username: 'testuser',
  isSeller: true,
  ...overrides,
});

// Mock analytics data
const mockRevenueSummary = {
  totalProjects: 10,
  totalSold: 5,
  totalRevenueCents: 50000, // $500
  averageProjectPriceCents: 10000, // $100
  conversionRate: 0.05, // 5%
};

const mockRevenueOverTime = [
  { date: '2026-01-10', revenueCents: 10000, transactionCount: 1 },
  { date: '2026-01-15', revenueCents: 20000, transactionCount: 2 },
];

const mockTopProjects = [
  {
    projectId: 'proj1',
    title: 'Project 1',
    viewCount: 100,
    favoriteCount: 10,
    purchaseCount: 2,
    revenueCents: 20000,
    conversionRate: 0.02,
  },
  {
    projectId: 'proj2',
    title: 'Project 2',
    viewCount: 200,
    favoriteCount: 20,
    purchaseCount: 3,
    revenueCents: 30000,
    conversionRate: 0.015,
  },
];

const mockAnalyticsOverview = {
  userId: 'user123',
  summary: mockRevenueSummary,
  revenueOverTime: mockRevenueOverTime,
  topProjects: mockTopProjects,
};

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;

  beforeEach(() => {
    vi.clearAllMocks();
    analyticsService = new AnalyticsService(mockAnalyticsRepository, mockUserRepository);
  });

  describe('getSellerAnalyticsOverview', () => {
    it('should return formatted analytics overview', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(createMockUser() as any);
      vi.mocked(mockAnalyticsRepository.getSellerAnalyticsOverview).mockResolvedValue(
        mockAnalyticsOverview
      );

      const result = await analyticsService.getSellerAnalyticsOverview('user123', {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(result.userId).toBe('user123');
      expect(result.summary.totalProjects).toBe(10);
      expect(result.summary.totalSold).toBe(5);
      expect(result.summary.totalRevenue).toBe('$500.00');
      expect(result.summary.averageProjectPrice).toBe('$100.00');
      expect(result.summary.conversionRate).toBe('5.00%');
      expect(result.revenueChart).toHaveLength(2);
      expect(result.topProjects).toHaveLength(2);
    });

    it('should format currency correctly', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(createMockUser() as any);
      vi.mocked(mockAnalyticsRepository.getSellerAnalyticsOverview).mockResolvedValue({
        ...mockAnalyticsOverview,
        summary: {
          ...mockRevenueSummary,
          totalRevenueCents: 123456, // $1,234.56
        },
      });

      const result = await analyticsService.getSellerAnalyticsOverview('user123');

      expect(result.summary.totalRevenue).toBe('$1,234.56');
    });

    it('should format percentages correctly', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(createMockUser() as any);
      vi.mocked(mockAnalyticsRepository.getSellerAnalyticsOverview).mockResolvedValue({
        ...mockAnalyticsOverview,
        summary: {
          ...mockRevenueSummary,
          conversionRate: 0.1234, // 12.34%
        },
      });

      const result = await analyticsService.getSellerAnalyticsOverview('user123');

      expect(result.summary.conversionRate).toBe('12.34%');
    });

    it('should throw AnalyticsPermissionError if user is not a seller', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(
        createMockUser({ isSeller: false }) as any
      );

      await expect(
        analyticsService.getSellerAnalyticsOverview('user123')
      ).rejects.toThrow(AnalyticsPermissionError);

      await expect(
        analyticsService.getSellerAnalyticsOverview('user123')
      ).rejects.toThrow('Only sellers can access analytics');
    });

    it('should throw AnalyticsPermissionError if user not found', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null);

      await expect(
        analyticsService.getSellerAnalyticsOverview('user123')
      ).rejects.toThrow(AnalyticsPermissionError);
    });

    it('should use default date range (last 30 days) if not provided', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(createMockUser() as any);
      vi.mocked(mockAnalyticsRepository.getSellerAnalyticsOverview).mockResolvedValue(
        mockAnalyticsOverview
      );

      await analyticsService.getSellerAnalyticsOverview('user123');

      expect(mockAnalyticsRepository.getSellerAnalyticsOverview).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        })
      );

      // Verify date range is approximately 30 days
      const call = vi.mocked(mockAnalyticsRepository.getSellerAnalyticsOverview).mock
        .calls[0];
      const dateRange = call[1];
      const daysDiff = Math.round(
        (dateRange.endDate.getTime() - dateRange.startDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      expect(daysDiff).toBeCloseTo(30, 0);
    });

    it('should throw AnalyticsValidationError for invalid start date', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(createMockUser() as any);

      await expect(
        analyticsService.getSellerAnalyticsOverview('user123', {
          startDate: 'invalid-date',
        })
      ).rejects.toThrow(AnalyticsValidationError);

      await expect(
        analyticsService.getSellerAnalyticsOverview('user123', {
          startDate: 'invalid-date',
        })
      ).rejects.toThrow('Invalid start date format');
    });

    it('should throw AnalyticsValidationError for invalid end date', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(createMockUser() as any);

      await expect(
        analyticsService.getSellerAnalyticsOverview('user123', {
          endDate: 'invalid-date',
        })
      ).rejects.toThrow(AnalyticsValidationError);

      await expect(
        analyticsService.getSellerAnalyticsOverview('user123', {
          endDate: 'invalid-date',
        })
      ).rejects.toThrow('Invalid end date format');
    });

    it('should throw AnalyticsValidationError if start date is after end date', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(createMockUser() as any);

      await expect(
        analyticsService.getSellerAnalyticsOverview('user123', {
          startDate: '2026-01-31',
          endDate: '2026-01-01',
        })
      ).rejects.toThrow(AnalyticsValidationError);

      await expect(
        analyticsService.getSellerAnalyticsOverview('user123', {
          startDate: '2026-01-31',
          endDate: '2026-01-01',
        })
      ).rejects.toThrow('Start date must be before end date');
    });

    it('should limit date range to 1 year', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(createMockUser() as any);
      vi.mocked(mockAnalyticsRepository.getSellerAnalyticsOverview).mockResolvedValue(
        mockAnalyticsOverview
      );

      // Request 2 years ago to now
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      await analyticsService.getSellerAnalyticsOverview('user123', {
        startDate: twoYearsAgo.toISOString(),
        endDate: new Date().toISOString(),
      });

      // Verify start date was adjusted to 1 year ago
      const call = vi.mocked(mockAnalyticsRepository.getSellerAnalyticsOverview).mock
        .calls[0];
      const dateRange = call[1];
      const yearsDiff =
        (dateRange.endDate.getTime() - dateRange.startDate.getTime()) /
        (1000 * 60 * 60 * 24 * 365);
      expect(yearsDiff).toBeLessThanOrEqual(1.1); // Allow small margin
    });
  });

  describe('getSellerRevenueSummary', () => {
    it('should return formatted revenue summary', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(createMockUser() as any);
      vi.mocked(mockAnalyticsRepository.getSellerRevenueSummary).mockResolvedValue(
        mockRevenueSummary
      );

      const result = await analyticsService.getSellerRevenueSummary('user123', {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(result.totalProjects).toBe(10);
      expect(result.totalSold).toBe(5);
      expect(result.totalRevenue).toBe('$500.00');
      expect(result.averageProjectPrice).toBe('$100.00');
      expect(result.conversionRate).toBe('5.00%');
    });

    it('should throw AnalyticsPermissionError if user is not a seller', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(
        createMockUser({ isSeller: false }) as any
      );

      await expect(analyticsService.getSellerRevenueSummary('user123')).rejects.toThrow(
        AnalyticsPermissionError
      );
    });

    it('should apply date range filter', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(createMockUser() as any);
      vi.mocked(mockAnalyticsRepository.getSellerRevenueSummary).mockResolvedValue(
        mockRevenueSummary
      );

      await analyticsService.getSellerRevenueSummary('user123', {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(mockAnalyticsRepository.getSellerRevenueSummary).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        })
      );
    });
  });

  describe('getTopProjects', () => {
    it('should return formatted top projects', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(createMockUser() as any);
      vi.mocked(mockAnalyticsRepository.getTopProjects).mockResolvedValue(
        mockTopProjects
      );

      const result = await analyticsService.getTopProjects('user123', 10, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(result).toHaveLength(2);
      expect(result[0].projectId).toBe('proj1');
      expect(result[0].title).toBe('Project 1');
      expect(result[0].views).toBe(100);
      expect(result[0].favorites).toBe(10);
      expect(result[0].purchases).toBe(2);
      expect(result[0].revenue).toBe('$200.00');
      expect(result[0].conversionRate).toBe('2.00%');
    });

    it('should throw AnalyticsPermissionError if user is not a seller', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(
        createMockUser({ isSeller: false }) as any
      );

      await expect(analyticsService.getTopProjects('user123', 10)).rejects.toThrow(
        AnalyticsPermissionError
      );
    });

    it('should pass limit parameter to repository', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(createMockUser() as any);
      vi.mocked(mockAnalyticsRepository.getTopProjects).mockResolvedValue(
        mockTopProjects
      );

      await analyticsService.getTopProjects('user123', 5);

      expect(mockAnalyticsRepository.getTopProjects).toHaveBeenCalledWith(
        'user123',
        5,
        expect.any(Object)
      );
    });

    it('should default to 10 projects if limit not provided', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(createMockUser() as any);
      vi.mocked(mockAnalyticsRepository.getTopProjects).mockResolvedValue(
        mockTopProjects
      );

      await analyticsService.getTopProjects('user123');

      expect(mockAnalyticsRepository.getTopProjects).toHaveBeenCalledWith(
        'user123',
        10,
        expect.any(Object)
      );
    });

    it('should apply date range filter', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(createMockUser() as any);
      vi.mocked(mockAnalyticsRepository.getTopProjects).mockResolvedValue(
        mockTopProjects
      );

      await analyticsService.getTopProjects('user123', 10, {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      expect(mockAnalyticsRepository.getTopProjects).toHaveBeenCalledWith(
        'user123',
        10,
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        })
      );
    });
  });

  describe('Date Range Normalization', () => {
    it('should parse valid ISO date strings', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(createMockUser() as any);
      vi.mocked(mockAnalyticsRepository.getSellerAnalyticsOverview).mockResolvedValue(
        mockAnalyticsOverview
      );

      // Use dates from mid-2025 (safely in the past and within 1 year)
      await analyticsService.getSellerAnalyticsOverview('user123', {
        startDate: '2025-06-01',
        endDate: '2025-06-30',
      });

      const call = vi.mocked(mockAnalyticsRepository.getSellerAnalyticsOverview).mock
        .calls[0];
      const dateRange = call[1];

      expect(dateRange.startDate).toBeInstanceOf(Date);
      expect(dateRange.endDate).toBeInstanceOf(Date);
      expect(dateRange.startDate.getMonth()).toBe(5); // June (0-indexed)
      expect(dateRange.endDate.getMonth()).toBe(5); // June
    });

    it('should handle date-only strings (without time)', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(createMockUser() as any);
      vi.mocked(mockAnalyticsRepository.getSellerAnalyticsOverview).mockResolvedValue(
        mockAnalyticsOverview
      );

      await analyticsService.getSellerAnalyticsOverview('user123', {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      const call = vi.mocked(mockAnalyticsRepository.getSellerAnalyticsOverview).mock
        .calls[0];
      const dateRange = call[1];

      expect(dateRange.startDate).toBeInstanceOf(Date);
      expect(dateRange.endDate).toBeInstanceOf(Date);
    });
  });

  describe('Currency Formatting', () => {
    it('should format zero cents as $0.00', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(createMockUser() as any);
      vi.mocked(mockAnalyticsRepository.getSellerAnalyticsOverview).mockResolvedValue({
        ...mockAnalyticsOverview,
        summary: {
          ...mockRevenueSummary,
          totalRevenueCents: 0,
        },
      });

      const result = await analyticsService.getSellerAnalyticsOverview('user123');

      expect(result.summary.totalRevenue).toBe('$0.00');
    });

    it('should format large amounts with commas', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(createMockUser() as any);
      vi.mocked(mockAnalyticsRepository.getSellerAnalyticsOverview).mockResolvedValue({
        ...mockAnalyticsOverview,
        summary: {
          ...mockRevenueSummary,
          totalRevenueCents: 123456789, // $1,234,567.89
        },
      });

      const result = await analyticsService.getSellerAnalyticsOverview('user123');

      expect(result.summary.totalRevenue).toBe('$1,234,567.89');
    });
  });

  describe('Percentage Formatting', () => {
    it('should format zero as 0.00%', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(createMockUser() as any);
      vi.mocked(mockAnalyticsRepository.getSellerAnalyticsOverview).mockResolvedValue({
        ...mockAnalyticsOverview,
        summary: {
          ...mockRevenueSummary,
          conversionRate: 0,
        },
      });

      const result = await analyticsService.getSellerAnalyticsOverview('user123');

      expect(result.summary.conversionRate).toBe('0.00%');
    });

    it('should format very small percentages correctly', async () => {
      vi.mocked(mockUserRepository.findById).mockResolvedValue(createMockUser() as any);
      vi.mocked(mockAnalyticsRepository.getSellerAnalyticsOverview).mockResolvedValue({
        ...mockAnalyticsOverview,
        summary: {
          ...mockRevenueSummary,
          conversionRate: 0.0012, // 0.12%
        },
      });

      const result = await analyticsService.getSellerAnalyticsOverview('user123');

      expect(result.summary.conversionRate).toBe('0.12%');
    });
  });
});
