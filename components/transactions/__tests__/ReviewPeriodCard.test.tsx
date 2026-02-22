import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewPeriodCard } from '../ReviewPeriodCard';
import type { TimelineStage } from '@/lib/services/RepositoryTransferService';

const activeStage: TimelineStage = {
  name: 'Project Review',
  status: 'active',
  description: '5 days remaining to review and raise any disputes',
  actions: [],
  metadata: {
    daysRemaining: 5,
    escrowReleaseDate: '2026-03-01T00:00:00Z',
  },
};

const completedStage: TimelineStage = {
  name: 'Project Review',
  status: 'completed',
  description: 'Project review period has ended',
  actions: [],
  metadata: { daysRemaining: 0 },
};

const upcomingStage: TimelineStage = {
  name: 'Project Review',
  status: 'upcoming',
  description: 'Project review begins after payment',
  actions: [],
};

describe('ReviewPeriodCard', () => {
  describe('card title', () => {
    it('shows "Project Review" as the heading', () => {
      render(
        <ReviewPeriodCard stage={activeStage} userRole="buyer" transactionId="txn-1" />
      );
      expect(screen.getByText('Project Review')).toBeInTheDocument();
    });
  });

  describe('seller — active stage', () => {
    it('shows Transfer Ownership Now button', () => {
      render(
        <ReviewPeriodCard stage={activeStage} userRole="seller" transactionId="txn-1" />
      );
      expect(
        screen.getByRole('button', { name: /transfer ownership now/i })
      ).toBeInTheDocument();
    });

    it('shows informational text about the dispute window', () => {
      render(
        <ReviewPeriodCard stage={activeStage} userRole="seller" transactionId="txn-1" />
      );
      expect(screen.getByText(/the buyer has until/i)).toBeInTheDocument();
    });

    it('opens confirmation dialog when button is clicked', async () => {
      render(
        <ReviewPeriodCard stage={activeStage} userRole="seller" transactionId="txn-1" />
      );
      await userEvent.click(
        screen.getByRole('button', { name: /transfer ownership now/i })
      );
      expect(screen.getByText(/transfer ownership now\?/i)).toBeInTheDocument();
    });

    it('shows irreversible warning in the dialog', async () => {
      render(
        <ReviewPeriodCard stage={activeStage} userRole="seller" transactionId="txn-1" />
      );
      await userEvent.click(
        screen.getByRole('button', { name: /transfer ownership now/i })
      );
      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
    });

    it('calls early-release API and onActionComplete on confirm', async () => {
      const onActionComplete = vi.fn();
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

      render(
        <ReviewPeriodCard
          stage={activeStage}
          userRole="seller"
          transactionId="txn-1"
          onActionComplete={onActionComplete}
        />
      );
      await userEvent.click(
        screen.getByRole('button', { name: /transfer ownership now/i })
      );
      await userEvent.click(
        screen.getByRole('button', { name: /yes, transfer ownership/i })
      );

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/transactions/txn-1/early-release',
        expect.objectContaining({ method: 'POST' })
      );
      expect(onActionComplete).toHaveBeenCalled();
    });
  });

  describe('buyer — active stage', () => {
    it('does not show Transfer Ownership button', () => {
      render(
        <ReviewPeriodCard stage={activeStage} userRole="buyer" transactionId="txn-1" />
      );
      expect(
        screen.queryByRole('button', { name: /transfer ownership/i })
      ).not.toBeInTheDocument();
    });

    it('does not show the dispute informational text', () => {
      render(
        <ReviewPeriodCard stage={activeStage} userRole="buyer" transactionId="txn-1" />
      );
      expect(screen.queryByText(/the buyer has until/i)).not.toBeInTheDocument();
    });
  });

  describe('completed stage', () => {
    it('shows "Review period complete"', () => {
      render(
        <ReviewPeriodCard
          stage={completedStage}
          userRole="buyer"
          transactionId="txn-1"
        />
      );
      expect(screen.getByText('Review period complete')).toBeInTheDocument();
    });

    it('does not show Transfer Ownership button when completed', () => {
      render(
        <ReviewPeriodCard
          stage={completedStage}
          userRole="seller"
          transactionId="txn-1"
        />
      );
      expect(
        screen.queryByRole('button', { name: /transfer ownership/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('upcoming stage', () => {
    it('does not show Transfer Ownership button', () => {
      render(
        <ReviewPeriodCard
          stage={upcomingStage}
          userRole="seller"
          transactionId="txn-1"
        />
      );
      expect(
        screen.queryByRole('button', { name: /transfer ownership/i })
      ).not.toBeInTheDocument();
    });
  });
});
