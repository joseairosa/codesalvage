/**
 * Seller Profile Page Tests
 *
 * Tests for:
 * - computeSubscriptionForCard utility (4 cases)
 * - notFound() for non-existent, non-seller, and banned users
 * - redirect() for mixed-case usernames
 * - generateMetadata() returns correct SEO shape
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted ensures these are available inside vi.mock factories
const {
  mockUserFindUnique,
  mockProjectFindMany,
  mockGetSellerRatingStats,
  mockGetSellerReviews,
  mockNotFound,
  mockRedirect,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockProjectFindMany: vi.fn(),
  mockGetSellerRatingStats: vi.fn(),
  mockGetSellerReviews: vi.fn(),
  mockNotFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
  mockRedirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); }),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique },
    project: { findMany: mockProjectFindMany },
  },
}));

vi.mock('@/lib/repositories/ReviewRepository', () => ({
  ReviewRepository: vi.fn().mockImplementation(() => ({
    getSellerRatingStats: mockGetSellerRatingStats,
    getSellerReviews: mockGetSellerReviews,
  })),
}));

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('@/components/projects/ProjectCard', () => ({ ProjectCard: () => null }));
vi.mock('@/components/profile/RatingBreakdown', () => ({ RatingBreakdown: () => null }));
vi.mock('@/components/profile/SellerReviewsSection', () => ({ SellerReviewsSection: () => null }));
vi.mock('@/components/seller/ProBadge', () => ({ ProBadge: () => null }));
vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => children,
  AvatarImage: () => null,
  AvatarFallback: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('lucide-react', () => ({
  CalendarDays: () => null,
  Star: () => null,
  Package: () => null,
}));

import SellerProfilePage, { generateMetadata, computeSubscriptionForCard } from '../page';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const mockUser = {
  id: 'user-1',
  username: 'testseller',
  fullName: 'Test Seller',
  bio: 'Building great things',
  avatarUrl: null,
  isSeller: true,
  isBanned: false,
  createdAt: new Date('2025-01-01'),
  subscription: null,
};

const emptyReviewData = {
  reviews: [],
  total: 0,
  page: 1,
  limit: 10,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
};

const emptyRatingStats = {
  averageRating: 0,
  totalReviews: 0,
  ratingBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
};

// ---------------------------------------------------------------------------
// computeSubscriptionForCard
// ---------------------------------------------------------------------------

describe('computeSubscriptionForCard', () => {
  it('returns null for null subscription', () => {
    expect(computeSubscriptionForCard(null)).toBeNull();
  });

  it('returns null for inactive subscription', () => {
    expect(computeSubscriptionForCard({ plan: 'pro', status: 'canceled' })).toBeNull();
  });

  it('returns all benefits false for active non-pro subscription', () => {
    const result = computeSubscriptionForCard({ plan: 'free', status: 'active' });
    expect(result).not.toBeNull();
    expect(result!.benefits).toEqual({
      verificationBadge: false,
      unlimitedProjects: false,
      advancedAnalytics: false,
      featuredListingDiscount: false,
    });
  });

  it('returns all benefits true for active pro subscription', () => {
    const result = computeSubscriptionForCard({ plan: 'pro', status: 'active' });
    expect(result).not.toBeNull();
    expect(result!.benefits).toEqual({
      verificationBadge: true,
      unlimitedProjects: true,
      advancedAnalytics: true,
      featuredListingDiscount: true,
    });
  });
});

// ---------------------------------------------------------------------------
// SellerProfilePage — 404 and redirect behaviours
// ---------------------------------------------------------------------------

describe('SellerProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-implement throws after clearAllMocks resets them
    mockNotFound.mockImplementation(() => { throw new Error('NEXT_NOT_FOUND'); });
    mockRedirect.mockImplementation((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); });
    mockProjectFindMany.mockResolvedValue([]);
    mockGetSellerRatingStats.mockResolvedValue(emptyRatingStats);
    mockGetSellerReviews.mockResolvedValue(emptyReviewData);
  });

  it('calls notFound() when user does not exist', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    await expect(
      SellerProfilePage({ params: Promise.resolve({ username: 'nobody' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalled();
  });

  it('calls notFound() when user is not a seller', async () => {
    mockUserFindUnique.mockResolvedValue({ ...mockUser, isSeller: false });
    await expect(
      SellerProfilePage({ params: Promise.resolve({ username: 'testseller' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalled();
  });

  it('calls notFound() when user is banned', async () => {
    mockUserFindUnique.mockResolvedValue({ ...mockUser, isBanned: true });
    await expect(
      SellerProfilePage({ params: Promise.resolve({ username: 'testseller' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalled();
  });

  it('redirects mixed-case username to lowercase canonical URL', async () => {
    await expect(
      SellerProfilePage({ params: Promise.resolve({ username: 'TestSeller' }) })
    ).rejects.toThrow('NEXT_REDIRECT:/u/testseller');
    expect(mockRedirect).toHaveBeenCalledWith('/u/testseller');
  });
});

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

describe('generateMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns not-found title when user does not exist', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const meta = await generateMetadata({ params: Promise.resolve({ username: 'nobody' }) });
    expect(meta.title).toMatch(/not found/i);
  });

  it('returns correct title for a valid seller', async () => {
    mockUserFindUnique.mockResolvedValue(mockUser);
    const meta = await generateMetadata({ params: Promise.resolve({ username: 'testseller' }) });
    expect(meta.title).toBe('testseller — CodeSalvage');
  });

  it('returns bio as description when present', async () => {
    mockUserFindUnique.mockResolvedValue(mockUser);
    const meta = await generateMetadata({ params: Promise.resolve({ username: 'testseller' }) });
    expect(meta.description).toBe('Building great things');
  });

  it('returns fallback description when bio is absent', async () => {
    mockUserFindUnique.mockResolvedValue({ ...mockUser, bio: null });
    const meta = await generateMetadata({ params: Promise.resolve({ username: 'testseller' }) });
    expect(meta.description).toContain('seller on CodeSalvage');
  });

  it('returns openGraph with type="profile"', async () => {
    mockUserFindUnique.mockResolvedValue(mockUser);
    const meta = await generateMetadata({ params: Promise.resolve({ username: 'testseller' }) });
    expect((meta.openGraph as { type: string }).type).toBe('profile');
  });

  it('includes og:title and og:description', async () => {
    mockUserFindUnique.mockResolvedValue(mockUser);
    const meta = await generateMetadata({ params: Promise.resolve({ username: 'testseller' }) });
    const og = meta.openGraph as { title?: string; description?: string };
    expect(og.title).toBeDefined();
    expect(og.description).toBeDefined();
  });
});
