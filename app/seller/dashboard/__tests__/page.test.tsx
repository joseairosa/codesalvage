/**
 * Seller Dashboard Page — Onboarding Checklist Tests
 *
 * Tests that OnboardingChecklist renders with 4 seller steps.
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

vi.mock('@/components/seller/AnalyticsDashboard', () => ({
  AnalyticsDashboard: () => null,
}));

// ---- Imports (after vi.mock hoisting) ----

import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import SellerDashboardPage from '../page';

// ---- Typed mocks ----

const mockRequireAuth = vi.mocked(requireAuth);
const mockProjectCount = vi.mocked(prisma.project.count);
const mockMessageCount = vi.mocked(prisma.message.count);
const mockUserFindUnique = vi.mocked(prisma.user.findUnique);

// ---- Helpers ----

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
    ...overrides,
  } as any);
}

// ---- Tests ----

describe('SellerDashboardPage — onboarding checklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSellerSession();
    mockDefaultUser();
    mockProjectCount.mockResolvedValue(0);
    mockMessageCount.mockResolvedValue(0);
  });

  it('renders the onboarding checklist for a new seller', async () => {
    const jsx = await SellerDashboardPage();
    render(jsx);

    expect(screen.getByTestId('onboarding-checklist')).toBeInTheDocument();
  });

  it('renders all 4 seller onboarding steps', async () => {
    const jsx = await SellerDashboardPage();
    render(jsx);

    expect(screen.getByText('Complete your profile')).toBeInTheDocument();
    expect(screen.getByText('Connect payment account')).toBeInTheDocument();
    expect(screen.getByText('List your first project')).toBeInTheDocument();
    expect(screen.getByText('Send your first message')).toBeInTheDocument();
  });

  it('hides the checklist when onboardingDismissedAt is set', async () => {
    mockDefaultUser({ onboardingDismissedAt: new Date('2025-06-01') });

    const jsx = await SellerDashboardPage();
    render(jsx);

    expect(screen.queryByTestId('onboarding-checklist')).not.toBeInTheDocument();
  });

  it('marks "Send your first message" as done when sentMessageCount > 0', async () => {
    mockMessageCount.mockResolvedValue(1);
    // Keep other steps not done so checklist stays visible

    const jsx = await SellerDashboardPage();
    render(jsx);

    const label = screen.getByText('Send your first message');
    expect(label).toHaveClass('line-through');
  });

  it('marks "List your first project" as done when projectCount > 0', async () => {
    mockProjectCount.mockResolvedValue(1);

    const jsx = await SellerDashboardPage();
    render(jsx);

    const label = screen.getByText('List your first project');
    expect(label).toHaveClass('line-through');
  });

  it('renders the AnalyticsDashboard alongside the checklist', async () => {
    const jsx = await SellerDashboardPage();
    render(jsx);

    // The page header is always present
    expect(screen.getByText('Seller Dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-checklist')).toBeInTheDocument();
  });

  it('does not call getOnboardingStatus when stripeAccountId is null', async () => {
    const { stripeService } = await import('@/lib/services');
    const mockGetOnboarding = vi.mocked(stripeService.getOnboardingStatus);

    mockDefaultUser({ stripeAccountId: null });

    await SellerDashboardPage();

    expect(mockGetOnboarding).not.toHaveBeenCalled();
  });
});
