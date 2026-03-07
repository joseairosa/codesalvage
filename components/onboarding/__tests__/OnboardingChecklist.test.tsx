/**
 * OnboardingChecklist Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingChecklist } from '../OnboardingChecklist';
import type { OnboardingStep } from '../OnboardingChecklist';

const sellerSteps: OnboardingStep[] = [
  {
    id: 'profile',
    label: 'Complete your profile',
    description: 'Add a bio so buyers know who you are.',
    done: false,
    href: '/settings',
  },
  {
    id: 'stripe',
    label: 'Connect payment account',
    description: 'Required before buyers can purchase your projects.',
    done: true,
    href: '/seller/onboard',
  },
  {
    id: 'project',
    label: 'List your first project',
    description: 'Turn your unfinished code into revenue.',
    done: false,
    href: '/projects/new',
  },
];

const allDoneSteps: OnboardingStep[] = sellerSteps.map((s) => ({ ...s, done: true }));

describe('OnboardingChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the checklist when not dismissed and steps are incomplete', () => {
    render(<OnboardingChecklist steps={sellerSteps} dismissed={false} />);
    expect(screen.getByTestId('onboarding-checklist')).toBeInTheDocument();
    expect(screen.getByText('Get started on CodeSalvage')).toBeInTheDocument();
  });

  it('does not render when already dismissed', () => {
    render(<OnboardingChecklist steps={sellerSteps} dismissed={true} />);
    expect(screen.queryByTestId('onboarding-checklist')).not.toBeInTheDocument();
  });

  it('does not render when all steps are done', () => {
    render(<OnboardingChecklist steps={allDoneSteps} dismissed={false} />);
    expect(screen.queryByTestId('onboarding-checklist')).not.toBeInTheDocument();
  });

  it('shows correct completed count', () => {
    render(<OnboardingChecklist steps={sellerSteps} dismissed={false} />);
    // 1 of 3 done
    expect(screen.getByText('1 of 3 steps complete')).toBeInTheDocument();
  });

  it('renders incomplete step labels', () => {
    render(<OnboardingChecklist steps={sellerSteps} dismissed={false} />);
    expect(screen.getByText('Complete your profile')).toBeInTheDocument();
    expect(screen.getByText('List your first project')).toBeInTheDocument();
  });

  it('renders completed steps as struck-through text', () => {
    render(<OnboardingChecklist steps={sellerSteps} dismissed={false} />);
    const completedLabel = screen.getByText('Connect payment account');
    expect(completedLabel).toBeInTheDocument();
    expect(completedLabel).toHaveClass('line-through');
  });

  it('shows a dismiss button', () => {
    render(<OnboardingChecklist steps={sellerSteps} dismissed={false} />);
    expect(
      screen.getByRole('button', { name: /dismiss onboarding/i })
    ).toBeInTheDocument();
  });

  it('calls dismiss API and hides checklist when dismiss is clicked', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

    render(<OnboardingChecklist steps={sellerSteps} dismissed={false} />);
    await userEvent.click(screen.getByRole('button', { name: /dismiss onboarding/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/user/onboarding-dismiss',
        expect.objectContaining({ method: 'PATCH' })
      );
      expect(screen.queryByTestId('onboarding-checklist')).not.toBeInTheDocument();
    });
  });

  it('hides checklist even if dismiss API fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<OnboardingChecklist steps={sellerSteps} dismissed={false} />);
    await userEvent.click(screen.getByRole('button', { name: /dismiss onboarding/i }));

    await waitFor(() => {
      expect(screen.queryByTestId('onboarding-checklist')).not.toBeInTheDocument();
    });
  });

  it('renders the progress bar with correct aria attributes', () => {
    render(<OnboardingChecklist steps={sellerSteps} dismissed={false} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '1');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '3');
  });

  it('shows step descriptions', () => {
    render(<OnboardingChecklist steps={sellerSteps} dismissed={false} />);
    expect(screen.getByText('Add a bio so buyers know who you are.')).toBeInTheDocument();
  });
});
