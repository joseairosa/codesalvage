/**
 * StripeService Tests
 *
 * Focused on createAccountLink since that method was changed to re-throw
 * the original Stripe error (instead of wrapping it). The onboard route
 * relies on inspecting rawType/code to self-heal stale account IDs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAccountLinksCreate, mockAccountsCreate } = vi.hoisted(() => ({
  mockAccountLinksCreate: vi.fn(),
  mockAccountsCreate: vi.fn(),
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    accountLinks: { create: mockAccountLinksCreate },
    accounts: { create: mockAccountsCreate },
  },
  STRIPE_CONNECT_CONFIG: {
    controller: {},
    capabilities: {},
    businessType: 'individual',
  },
  calculateSellerPayout: vi.fn(),
}));

import { StripeService } from '../StripeService';

describe('StripeService', () => {
  let service: StripeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StripeService();
  });

  describe('createAccountLink', () => {
    it('returns the onboarding URL on success', async () => {
      mockAccountLinksCreate.mockResolvedValue({
        url: 'https://connect.stripe.com/onboard/acct_123',
        object: 'account_link',
        created: 0,
        expires_at: 0,
        type: 'account_onboarding',
      });

      const url = await service.createAccountLink(
        'acct_123',
        'https://example.com/return',
        'https://example.com/refresh'
      );

      expect(url).toBe('https://connect.stripe.com/onboard/acct_123');
      expect(mockAccountLinksCreate).toHaveBeenCalledWith({
        account: 'acct_123',
        return_url: 'https://example.com/return',
        refresh_url: 'https://example.com/refresh',
        type: 'account_onboarding',
      });
    });

    it('re-throws the original error (preserves rawType and code for self-heal logic)', async () => {
      // Simulate the invalid_request_error Stripe sends when a test-mode account
      // ID is used against a live-mode platform key.
      const originalError = Object.assign(
        new Error(
          'You requested an account link for an account that is not connected to your platform or does not exist.'
        ),
        {
          type: 'StripeInvalidRequestError',
          rawType: 'invalid_request_error',
        }
      );
      mockAccountLinksCreate.mockRejectedValue(originalError);

      await expect(
        service.createAccountLink(
          'acct_stale_test',
          'https://example.com/return',
          'https://example.com/refresh'
        )
      ).rejects.toThrow(originalError);
    });

    it('re-throws resource_missing error unchanged', async () => {
      const resourceMissingError = Object.assign(new Error('No such account: acct_gone'), {
        code: 'resource_missing',
      });
      mockAccountLinksCreate.mockRejectedValue(resourceMissingError);

      await expect(
        service.createAccountLink(
          'acct_gone',
          'https://example.com/return',
          'https://example.com/refresh'
        )
      ).rejects.toThrow(resourceMissingError);
    });
  });
});
