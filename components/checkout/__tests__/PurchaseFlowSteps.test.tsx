import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PurchaseFlowSteps } from '../PurchaseFlowSteps';

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

const escrowDate = new Date('2026-03-01');

describe('PurchaseFlowSteps', () => {
  it('renders all 4 steps', () => {
    render(
      <PurchaseFlowSteps
        hasGithubRepo={true}
        escrowReleaseDate={escrowDate}
        formatDate={formatDate}
      />
    );
    expect(screen.getByText('Collaborator Access')).toBeInTheDocument();
    expect(screen.getByText('7-Day Review Period')).toBeInTheDocument();
    expect(screen.getByText('Ownership Transfer')).toBeInTheDocument();
    expect(screen.getByText('Funds Released')).toBeInTheDocument();
  });

  it('shows GitHub collaborator copy when hasGithubRepo is true', () => {
    render(
      <PurchaseFlowSteps
        hasGithubRepo={true}
        escrowReleaseDate={escrowDate}
        formatDate={formatDate}
      />
    );
    expect(screen.getByText(/added as a collaborator/i)).toBeInTheDocument();
  });

  it('shows download copy when hasGithubRepo is false', () => {
    render(
      <PurchaseFlowSteps
        hasGithubRepo={false}
        escrowReleaseDate={escrowDate}
        formatDate={formatDate}
      />
    );
    expect(screen.getByText(/download the project code/i)).toBeInTheDocument();
  });

  it('renders the formatted escrow release date', () => {
    render(
      <PurchaseFlowSteps
        hasGithubRepo={true}
        escrowReleaseDate={escrowDate}
        formatDate={formatDate}
      />
    );
    expect(screen.getByText('March 1, 2026')).toBeInTheDocument();
  });
});
