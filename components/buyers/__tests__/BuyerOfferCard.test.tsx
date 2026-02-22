import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuyerOfferCard } from '../BuyerOfferCard';
import type { OfferItem } from '@/app/dashboard/offers/page';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }));
vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => React.createElement('img', { alt }),
}));

const baseOffer: OfferItem = {
  id: 'offer-1',
  projectId: 'project-1',
  buyerId: 'buyer-1',
  sellerId: 'seller-1',
  offeredPriceCents: 500000,
  originalPriceCents: 1200000,
  message: null,
  status: 'accepted',
  transactionId: null,
  respondedAt: null,
  expiresAt: '2026-03-01T00:00:00Z',
  parentOfferId: null,
  createdAt: '2026-02-11T00:00:00Z',
  project: {
    id: 'project-1',
    title: 'InfraLy Platform',
    priceCents: 1200000,
    thumbnailImageUrl: null,
    status: 'active',
  },
  seller: {
    id: 'seller-1',
    username: 'selleruser',
    fullName: 'Seller Name',
    avatarUrl: null,
    email: 'seller@example.com',
  },
  counterOffer: null,
};

const baseProps = {
  offer: baseOffer,
  isActionLoading: false,
  onWithdraw: vi.fn(),
  onAcceptCounter: vi.fn(),
  onRejectCounter: vi.fn(),
};

describe('BuyerOfferCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('accepted offer — no transaction (not yet purchased)', () => {
    it('shows Proceed to Checkout button', () => {
      render(<BuyerOfferCard {...baseProps} />);
      expect(
        screen.getByRole('button', { name: /proceed to checkout/i })
      ).toBeInTheDocument();
    });

    it('does not show View Purchase button', () => {
      render(<BuyerOfferCard {...baseProps} />);
      expect(
        screen.queryByRole('button', { name: /view purchase/i })
      ).not.toBeInTheDocument();
    });

    it('navigates to checkout on click', async () => {
      render(<BuyerOfferCard {...baseProps} />);
      await userEvent.click(screen.getByRole('button', { name: /proceed to checkout/i }));
      expect(mockPush).toHaveBeenCalledWith('/checkout/project-1?offerId=offer-1');
    });
  });

  describe('accepted offer — with transaction (already purchased)', () => {
    const purchasedOffer = { ...baseOffer, transactionId: 'txn-abc123' };

    it('shows View Purchase button', () => {
      render(<BuyerOfferCard {...baseProps} offer={purchasedOffer} />);
      expect(screen.getByRole('button', { name: /view purchase/i })).toBeInTheDocument();
    });

    it('does not show Proceed to Checkout button', () => {
      render(<BuyerOfferCard {...baseProps} offer={purchasedOffer} />);
      expect(
        screen.queryByRole('button', { name: /proceed to checkout/i })
      ).not.toBeInTheDocument();
    });

    it('navigates to transaction detail on click', async () => {
      render(<BuyerOfferCard {...baseProps} offer={purchasedOffer} />);
      await userEvent.click(screen.getByRole('button', { name: /view purchase/i }));
      expect(mockPush).toHaveBeenCalledWith('/transactions/txn-abc123');
    });
  });

  describe('pending offer', () => {
    const pendingOffer = { ...baseOffer, status: 'pending', transactionId: null };

    it('shows Withdraw button', () => {
      render(<BuyerOfferCard {...baseProps} offer={pendingOffer} />);
      expect(screen.getByRole('button', { name: /withdraw/i })).toBeInTheDocument();
    });

    it('calls onWithdraw with offer id', async () => {
      const onWithdraw = vi.fn();
      render(
        <BuyerOfferCard {...baseProps} offer={pendingOffer} onWithdraw={onWithdraw} />
      );
      await userEvent.click(screen.getByRole('button', { name: /withdraw/i }));
      expect(onWithdraw).toHaveBeenCalledWith('offer-1');
    });

    it('disables Withdraw while action is loading', () => {
      render(
        <BuyerOfferCard {...baseProps} offer={pendingOffer} isActionLoading={true} />
      );
      expect(screen.getByRole('button', { name: /withdraw/i })).toBeDisabled();
    });
  });

  describe('countered offer', () => {
    const counteredOffer: OfferItem = {
      ...baseOffer,
      status: 'countered',
      parentOfferId: null,
      counterOffer: {
        id: 'counter-1',
        offeredPriceCents: 700000,
        status: 'pending',
        message: 'How about this?',
      },
    };

    it('shows counter-offer section with Accept and Reject buttons', () => {
      render(<BuyerOfferCard {...baseProps} offer={counteredOffer} />);
      expect(screen.getByText(/counter-offer received/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
    });

    it('calls onAcceptCounter with counter offer id', async () => {
      const onAcceptCounter = vi.fn();
      render(
        <BuyerOfferCard
          {...baseProps}
          offer={counteredOffer}
          onAcceptCounter={onAcceptCounter}
        />
      );
      await userEvent.click(screen.getByRole('button', { name: /accept/i }));
      expect(onAcceptCounter).toHaveBeenCalledWith('counter-1');
    });

    it('calls onRejectCounter with counter offer id', async () => {
      const onRejectCounter = vi.fn();
      render(
        <BuyerOfferCard
          {...baseProps}
          offer={counteredOffer}
          onRejectCounter={onRejectCounter}
        />
      );
      await userEvent.click(screen.getByRole('button', { name: /reject/i }));
      expect(onRejectCounter).toHaveBeenCalledWith('counter-1');
    });
  });

  describe('card content', () => {
    it('renders project title', () => {
      render(<BuyerOfferCard {...baseProps} />);
      expect(screen.getByText('InfraLy Platform')).toBeInTheDocument();
    });

    it('renders offer message when present', () => {
      const offerWithMsg = { ...baseOffer, message: 'Please consider my offer' };
      render(<BuyerOfferCard {...baseProps} offer={offerWithMsg} />);
      expect(screen.getByText(/please consider my offer/i)).toBeInTheDocument();
    });
  });
});
