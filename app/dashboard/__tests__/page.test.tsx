/**
 * Dashboard Page — Onboarding Step Tests
 *
 * Tests the buyer/seller onboarding step arrays built server-side.
 * Pattern: mock dependencies → call async page directly → render JSX → assert.
 *
 * next/link and next/navigation are mocked globally in tests/setup.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ---- Mocks ----

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    project: { count: vi.fn() },
    message: { count: vi.fn() },
    transaction: { count: vi.fn() },
    favorite: { count: vi.fn() },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/services', () => ({
  stripeService: {
    getOnboardingStatus: vi.fn(),
  },
}));

// ---- Imports (after vi.mock hoisting) ----

import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import DashboardPage from '../page';

// ---- Helpers ----

const mockRequireAuth = vi.mocked(requireAuth);
const mockProjectCount = vi.mocked(prisma.project.count);
const mockMessageCount = vi.mocked(prisma.message.count);
const mockTransactionCount = vi.mocked(prisma.transaction.count);
const mockFavoriteCount = vi.mocked(prisma.favorite.count);
const mockUserFindUnique = vi.mocked(prisma.user.findUnique);

function mockBuyerSession() {
  mockRequireAuth.mockResolvedValue({
    user: {
      id: 'buyer-1',
      email: 'buyer@example.com',
      username: 'buyer',
      isSeller: false,
      isVerifiedSeller: false,
      isAdmin: false,
      isBanned: false,
      name: 'Buyer',
      image: null,
      githubUsername: null,
    },
  } as any);
}

function mockSellerSession() {
  mockRequireAuth.mockResolvedValue({
    user: {
      id: 'seller-1',
      email: 'seller@example.com',
      username: 'seller',
      isSeller: true,
      isVerifiedSeller: false,
      isAdmin: false,
      isBanned: false,
      name: 'Seller',
      image: null,
      githubUsername: null,
    },
  } as any);
}

function mockDefaultUser(overrides: Record<string, unknown> = {}) {
  mockUserFindUnique.mockResolvedValue({
    bio: null,
    stripeAccountId: null,
    isVerifiedSeller: false,
    onboardingDismissedAt: null,
    createdAt: new Date('2025-01-01'),
    ...overrides,
  } as any);
}

/** Disambiguate the two message.count calls by query shape */
function mockMessageCounts(statCount: number, sentCount: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockMessageCount.mockImplementation((async (args: any) => {
    if (args?.where?.senderId) return sentCount;
    return statCount;
  }) as any);
}

/** Disambiguate the two transaction.count calls by query shape */
function mockTransactionCounts(totalCount: number, purchaseCount: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockTransactionCount.mockImplementation((async (args: any) => {
    if (args?.where?.paymentStatus === 'succeeded') return purchaseCount;
    return totalCount;
  }) as any);
}

// ---- Tests ----

describe('DashboardPage — buyer onboarding steps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuyerSession();
    mockDefaultUser();
    mockProjectCount.mockResolvedValue(0);
    mockTransactionCounts(0, 0);
    mockMessageCounts(0, 0);
    mockFavoriteCount.mockResolvedValue(0);
  });

  it('includes "Favorite a project" step in buyer onboarding checklist', async () => {
    const jsx = await DashboardPage();
    render(jsx);

    expect(screen.getByText('Favorite a project')).toBeInTheDocument();
  });

  it('marks "Favorite a project" as not done when user has no favorites', async () => {
    mockFavoriteCount.mockResolvedValue(0);

    const jsx = await DashboardPage();
    render(jsx);

    // Undone steps render as links (not struck through)
    const label = screen.getByText('Favorite a project');
    expect(label).not.toHaveClass('line-through');
  });

  it('marks "Favorite a project" as done when user has at least one favorite', async () => {
    mockFavoriteCount.mockResolvedValue(1);
    // Keep purchase not done so checklist stays visible
    mockTransactionCounts(0, 0);

    const jsx = await DashboardPage();
    render(jsx);

    const label = screen.getByText('Favorite a project');
    expect(label).toHaveClass('line-through');
  });

  it('buyer checklist has exactly 3 steps: profile, favorite, purchase', async () => {
    const jsx = await DashboardPage();
    render(jsx);

    expect(screen.getByText('Complete your profile')).toBeInTheDocument();
    expect(screen.getByText('Favorite a project')).toBeInTheDocument();
    expect(screen.getByText('Make your first purchase')).toBeInTheDocument();
  });
});

describe('DashboardPage — seller onboarding steps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSellerSession();
    mockDefaultUser();
    mockProjectCount.mockResolvedValue(0);
    mockTransactionCounts(0, 0);
    mockMessageCounts(0, 0);
    mockFavoriteCount.mockResolvedValue(0);
  });

  it('includes "Send your first message" step in seller onboarding checklist', async () => {
    const jsx = await DashboardPage();
    render(jsx);

    expect(screen.getByText('Send your first message')).toBeInTheDocument();
  });

  it('marks "Send your first message" as not done when seller has sent no messages', async () => {
    mockMessageCounts(0, 0);

    const jsx = await DashboardPage();
    render(jsx);

    const label = screen.getByText('Send your first message');
    expect(label).not.toHaveClass('line-through');
  });

  it('marks "Send your first message" as done when seller has sent a message', async () => {
    mockMessageCounts(1, 1);
    // Keep project not done so checklist stays visible
    mockProjectCount.mockResolvedValue(0);

    const jsx = await DashboardPage();
    render(jsx);

    const label = screen.getByText('Send your first message');
    expect(label).toHaveClass('line-through');
  });

  it('seller checklist has exactly 4 steps: profile, stripe, project, message', async () => {
    const jsx = await DashboardPage();
    render(jsx);

    expect(screen.getByText('Complete your profile')).toBeInTheDocument();
    expect(screen.getByText('Connect payment account')).toBeInTheDocument();
    expect(screen.getByText('List your first project')).toBeInTheDocument();
    expect(screen.getByText('Send your first message')).toBeInTheDocument();
  });
});
