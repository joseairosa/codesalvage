/**
 * ApiKeysSection Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApiKeysSection } from '../ApiKeysSection';

const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);

const MOCK_KEYS = [
  {
    id: 'key1',
    name: 'CI pipeline',
    prefix: 'sk-abc123',
    status: 'active',
    lastUsedAt: null,
    usageCount: 0,
    expiresAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'key2',
    name: 'Local dev',
    prefix: 'sk-xyz789',
    status: 'active',
    lastUsedAt: '2026-03-01T00:00:00.000Z',
    usageCount: 42,
    expiresAt: null,
    createdAt: '2026-02-01T00:00:00.000Z',
  },
];

function makeGetResponse(keys = MOCK_KEYS) {
  return {
    ok: true,
    json: () => Promise.resolve({ apiKeys: keys }),
  };
}

function makePostResponse(overrides = {}) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        apiKey: 'sk-newkeyvalue',
        keyData: {
          id: 'key3',
          name: 'test',
          prefix: 'sk-newk',
          status: 'active',
          expiresAt: null,
          createdAt: new Date().toISOString(),
        },
        message: 'Save this key securely.',
        ...overrides,
      }),
  };
}

describe('ApiKeysSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ApiKeysSection />);
    expect(screen.getByText('Loading…')).toBeDefined();
  });

  it('shows existing API keys after load', async () => {
    mockFetch.mockResolvedValueOnce(makeGetResponse());
    render(<ApiKeysSection />);

    await waitFor(() => {
      expect(screen.getByText('CI pipeline')).toBeDefined();
      expect(screen.getByText('Local dev')).toBeDefined();
    });
  });

  it('shows prefix for each key', async () => {
    mockFetch.mockResolvedValueOnce(makeGetResponse());
    render(<ApiKeysSection />);

    await waitFor(() => {
      expect(screen.getByText('sk-abc123…')).toBeDefined();
    });
  });

  it('shows empty state when no keys', async () => {
    mockFetch.mockResolvedValueOnce(makeGetResponse([]));
    render(<ApiKeysSection />);

    await waitFor(() => {
      expect(screen.getByText('No API keys yet.')).toBeDefined();
    });
  });

  it('shows error when load fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });
    render(<ApiKeysSection />);

    await waitFor(() => {
      expect(
        screen.getByText(/Failed to load API keys \(undefined\)|Failed to load API keys/)
      ).toBeDefined();
    });
  });

  it('disables Create button when name is empty', async () => {
    mockFetch.mockResolvedValueOnce(makeGetResponse([]));
    render(<ApiKeysSection />);

    await waitFor(() => {
      expect(screen.getByText('No API keys yet.')).toBeDefined();
    });

    const button = screen.getByRole('button', { name: /create/i });
    expect(button).toHaveProperty('disabled', true);
  });

  it('enables Create button when name is filled', async () => {
    mockFetch.mockResolvedValueOnce(makeGetResponse([]));
    render(<ApiKeysSection />);

    await waitFor(() => screen.getByText('No API keys yet.'));

    const input = screen.getByPlaceholderText(/e.g. CI pipeline/i);
    fireEvent.change(input, { target: { value: 'My key' } });

    const button = screen.getByRole('button', { name: /create/i });
    expect(button).toHaveProperty('disabled', false);
  });

  it('reveals new key after successful creation', async () => {
    // GET → initial load (empty)
    mockFetch.mockResolvedValueOnce(makeGetResponse([]));
    render(<ApiKeysSection />);
    await waitFor(() => screen.getByText('No API keys yet.'));

    const input = screen.getByPlaceholderText(/e.g. CI pipeline/i);
    fireEvent.change(input, { target: { value: 'My key' } });

    // POST → create; GET → reload
    mockFetch.mockResolvedValueOnce(makePostResponse());
    mockFetch.mockResolvedValueOnce(makeGetResponse());

    const button = screen.getByRole('button', { name: /create/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('sk-newkeyvalue')).toBeDefined();
    });
  });

  it('shows creation error when POST fails', async () => {
    mockFetch.mockResolvedValueOnce(makeGetResponse([]));
    render(<ApiKeysSection />);
    await waitFor(() => screen.getByText('No API keys yet.'));

    const input = screen.getByPlaceholderText(/e.g. CI pipeline/i);
    fireEvent.change(input, { target: { value: 'My key' } });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Name already exists' }),
    });

    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText('Name already exists')).toBeDefined();
    });
  });

  it('shows "Never used" for keys with no lastUsedAt', async () => {
    mockFetch.mockResolvedValueOnce(makeGetResponse([MOCK_KEYS[0]!]));
    render(<ApiKeysSection />);

    await waitFor(() => {
      expect(screen.getByText('Never used')).toBeDefined();
    });
  });

  it('shows "Last used" date for keys that have been used', async () => {
    mockFetch.mockResolvedValueOnce(makeGetResponse([MOCK_KEYS[1]!]));
    render(<ApiKeysSection />);

    await waitFor(() => {
      expect(screen.getByText(/Last used/)).toBeDefined();
    });
  });
});
