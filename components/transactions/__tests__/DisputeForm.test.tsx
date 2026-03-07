/**
 * DisputeForm Component Tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DisputeForm } from '../DisputeForm';

// Radix UI Select requires these pointer event stubs in jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

describe('DisputeForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders the "Open Dispute" trigger button', () => {
    render(<DisputeForm transactionId="tx1" onDisputeOpened={vi.fn()} />);
    expect(screen.getByRole('button', { name: /open dispute/i })).toBeInTheDocument();
  });

  it('opens the dialog when trigger is clicked', async () => {
    render(<DisputeForm transactionId="tx1" onDisputeOpened={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /open dispute/i }));
    expect(screen.getByText('Open a Dispute')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit dispute/i })).toBeInTheDocument();
  });

  it('disables submit when no reason or description is provided', async () => {
    render(<DisputeForm transactionId="tx1" onDisputeOpened={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /open dispute/i }));
    expect(screen.getByRole('button', { name: /submit dispute/i })).toBeDisabled();
  });

  it('disables submit when description is too short (< 20 chars)', async () => {
    render(<DisputeForm transactionId="tx1" onDisputeOpened={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /open dispute/i }));

    // Type a short description
    await userEvent.type(screen.getByRole('textbox'), 'Too short');
    expect(screen.getByRole('button', { name: /submit dispute/i })).toBeDisabled();
  });

  it('shows character count as description is typed', async () => {
    render(<DisputeForm transactionId="tx1" onDisputeOpened={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /open dispute/i }));

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'Hello');
    expect(screen.getByText(/5 \/ 20 characters minimum/i)).toBeInTheDocument();
  });

  it('shows the reason dropdown options', async () => {
    render(<DisputeForm transactionId="tx1" onDisputeOpened={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /open dispute/i }));

    // Open the select
    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.getByText("Project doesn't match description")).toBeInTheDocument();
    expect(screen.getByText('Code is not functional as described')).toBeInTheDocument();
    expect(screen.getByText('Other reason')).toBeInTheDocument();
  });

  it('enables submit when reason is selected and description meets minimum length', async () => {
    render(<DisputeForm transactionId="tx1" onDisputeOpened={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /open dispute/i }));

    // Select a reason
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByText("Project doesn't match description"));

    // Type a long enough description
    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'The code does not match what was advertised at all.');

    expect(screen.getByRole('button', { name: /submit dispute/i })).not.toBeDisabled();
  });

  it('calls the dispute API and invokes onDisputeOpened on success', async () => {
    const onDisputeOpened = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'dispute1', status: 'pending' }),
    });

    render(<DisputeForm transactionId="tx1" onDisputeOpened={onDisputeOpened} />);
    await userEvent.click(screen.getByRole('button', { name: /open dispute/i }));

    // Select a reason
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByText("Project doesn't match description"));

    // Fill description
    await userEvent.type(
      screen.getByRole('textbox'),
      'The code does not match what was advertised at all.'
    );

    // Submit
    await userEvent.click(screen.getByRole('button', { name: /submit dispute/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/transactions/tx1/dispute',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('description_mismatch'),
        })
      );
      expect(onDisputeOpened).toHaveBeenCalled();
    });
  });

  it('shows success message after dispute is submitted', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'dispute1', status: 'pending' }),
    });

    render(<DisputeForm transactionId="tx1" onDisputeOpened={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /open dispute/i }));

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByText("Project doesn't match description"));
    await userEvent.type(
      screen.getByRole('textbox'),
      'The code does not match what was advertised at all.'
    );
    await userEvent.click(screen.getByRole('button', { name: /submit dispute/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/dispute filed/i)
      ).toBeInTheDocument();
    });
  });

  it('shows error message when API returns an error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Transaction not in review window' }),
    });

    render(<DisputeForm transactionId="tx1" onDisputeOpened={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /open dispute/i }));

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByText("Project doesn't match description"));
    await userEvent.type(
      screen.getByRole('textbox'),
      'The code does not match what was advertised at all.'
    );
    await userEvent.click(screen.getByRole('button', { name: /submit dispute/i }));

    await waitFor(() => {
      expect(screen.getByText('Transaction not in review window')).toBeInTheDocument();
    });
  });
});
